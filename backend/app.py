from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
from dotenv import load_dotenv
import os
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta

load_dotenv()

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
PORT = int(os.getenv("TRIPPY_BACKEND_PORT") or os.getenv("PORT") or 5000)
ITINERARY_JSON_ERROR = "Trippy could not format the itinerary response. Please try again with a shorter refinement request."
SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("REACT_APP_SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or ""
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("REACT_APP_SUPABASE_ANON_KEY") or ""

INTEREST_LABELS = {
    "adventure": "Adventure",
    "culture": "Culture",
    "food": "Food & Drink",
    "nature": "Nature",
    "nightlife": "Nightlife",
    "relaxation": "Relaxation",
    "shopping": "Shopping",
    "photography": "Photography",
}

BUDGET_LABELS = {
    "budget": "Budget-friendly under $1,000",
    "moderate": "Moderate, $1,000 to $3,000",
    "comfort": "Comfort-focused, $3,000 to $7,000",
    "luxury": "Luxury, $7,000+",
}


def supabase_json_request(method, path, key, data=None, bearer=None, query=None):
    if not SUPABASE_URL:
        raise ValueError("Supabase URL is not configured.")

    url = f"{SUPABASE_URL}{path}"
    if query:
        url = f"{url}?{query}"

    body = json.dumps(data).encode("utf-8") if data is not None else None
    request = urllib.request.Request(url, data=body, method=method)
    request.add_header("apikey", key)
    request.add_header("Authorization", f"Bearer {bearer or key}")
    request.add_header("Content-Type", "application/json")
    request.add_header("Accept", "application/json")
    if method == "DELETE":
        request.add_header("Prefer", "return=minimal")

    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            response_body = response.read().decode("utf-8")
            return json.loads(response_body) if response_body else None
    except urllib.error.HTTPError as error:
        details = error.read().decode("utf-8", errors="replace")
        raise ValueError(f"Supabase request failed ({error.code}): {details}") from error


def delete_supabase_rows(table, query):
    encoded_table = urllib.parse.quote(table, safe="")
    supabase_json_request(
        "DELETE",
        f"/rest/v1/{encoded_table}",
        SUPABASE_SERVICE_ROLE_KEY,
        query=query,
    )


def get_authenticated_user_from_token(access_token):
    key = SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
    user = supabase_json_request("GET", "/auth/v1/user", key, bearer=access_token)
    if not user or not user.get("id"):
        raise ValueError("Unable to verify the current user.")
    return user


def delete_user_owned_data(user_id):
    user_filter = f"user_id=eq.{urllib.parse.quote(user_id)}"
    profile_filter = f"id=eq.{urllib.parse.quote(user_id)}"

    itineraries = supabase_json_request(
        "GET",
        "/rest/v1/itineraries",
        SUPABASE_SERVICE_ROLE_KEY,
        query=f"select=id&{user_filter}",
    ) or []
    itinerary_ids = [item.get("id") for item in itineraries if item.get("id")]

    delete_supabase_rows("chat_messages", user_filter)
    delete_supabase_rows("chat_sessions", user_filter)

    if itinerary_ids:
        encoded_ids = ",".join(urllib.parse.quote(str(item)) for item in itinerary_ids)
        delete_supabase_rows("itinerary_versions", f"itinerary_id=in.({encoded_ids})")

    delete_supabase_rows("itineraries", user_filter)
    delete_supabase_rows("traveler_preferences", user_filter)
    delete_supabase_rows("trip_requests", user_filter)
    delete_supabase_rows("userProfiles", profile_filter)


def delete_auth_user(user_id):
    supabase_json_request(
        "DELETE",
        f"/auth/v1/admin/users/{urllib.parse.quote(user_id)}",
        SUPABASE_SERVICE_ROLE_KEY,
    )


def trip_day_count(start_date, end_date):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        return max(1, (end - start).days + 1)
    except Exception:
        return 3


def trip_dates(start_date, day_count):
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        return [(start + timedelta(days=index)).strftime("%Y-%m-%d") for index in range(day_count)]
    except Exception:
        return [f"Day {index + 1}" for index in range(day_count)]


def normalize_interests(interests):
    return [INTEREST_LABELS.get(interest, interest) for interest in interests or []]


def extract_json_object(content):
    if not content:
        raise ValueError("AI returned an empty itinerary.")

    last_error = None
    candidates = [content.strip()]
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        extracted = content[start : end + 1]
        if extracted != candidates[0]:
            candidates.append(extracted)

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as error:
            last_error = error

    raise ValueError("AI returned invalid itinerary JSON.") from last_error


def client_safe_error_message(error):
    message = str(error) or "Unable to complete this request right now."
    parser_fragments = [
        "Expecting",
        "JSONDecodeError",
        "invalid itinerary JSON",
        "Unterminated",
        "Extra data",
        "incomplete itinerary",
    ]
    if any(fragment in message for fragment in parser_fragments):
        return "I couldn't fully update the itinerary. Please try again."
    return message


def repair_json_object(content):
    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You repair invalid JSON. Return only one complete valid JSON object. "
                        "Do not add markdown, explanation, or extra text."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Repair this TripAI itinerary JSON so it parses correctly:\n{content}",
                },
            ],
            temperature=0,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        return extract_json_object(response.choices[0].message.content.strip())
    except Exception as error:
        raise ValueError(ITINERARY_JSON_ERROR) from error


def parse_itinerary_json(content):
    try:
        return extract_json_object(content)
    except ValueError:
        return repair_json_object(content)


def day_has_complete_activities(day):
    activities = day.get("activities") if isinstance(day, dict) else []
    if not isinstance(activities, list) or len(activities) < 3:
        return False

    complete_activities = [
        activity
        for activity in activities
        if isinstance(activity, dict) and activity.get("title") and (activity.get("description") or activity.get("detail"))
    ]
    return len(complete_activities) >= 3


def itinerary_has_complete_days(raw_itinerary, trip):
    day_count = trip_day_count(trip.get("startDate"), trip.get("endDate"))
    days = raw_itinerary.get("days") if isinstance(raw_itinerary.get("days"), list) else []
    checklist = raw_itinerary.get("travelChecklist") if isinstance(raw_itinerary.get("travelChecklist"), dict) else {}
    required_checklist_keys = ["documents", "packing", "weatherPrep", "reservations", "localLogistics"]

    if len(days) < day_count:
        return False

    if not all(
        isinstance(checklist.get(key), list) and len(checklist.get(key)) > 0
        for key in required_checklist_keys
    ):
        return False

    return all(day_has_complete_activities(day) for day in days[:day_count])


def complete_itinerary_days(raw_itinerary, trip):
    if itinerary_has_complete_days(raw_itinerary, trip):
        return raw_itinerary

    day_count = trip_day_count(trip.get("startDate"), trip.get("endDate"))
    dates = trip_dates(trip.get("startDate"), day_count)

    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You complete incomplete TripAI itinerary JSON. "
                    "Return only valid JSON matching the original schema. No markdown."
                ),
            },
            {
                "role": "user",
                "content": f"""
The itinerary below is incomplete. Return one complete itinerary JSON object.

Trip constraints:
- Destination: {trip.get("destination")}
- Departure city: {trip.get("departureCity") or "Not specified"}
- Travelers: {trip.get("travelerCount") or 1}
- Dates: {trip.get("startDate")} to {trip.get("endDate")}
- Required day count: {day_count}
- Required dates in order: {", ".join(dates)}
- Budget: {BUDGET_LABELS.get(trip.get("budget"), trip.get("budget") or "not specified")}
- Interests: {", ".join(normalize_interests(trip.get("interests"))) or "not specified"}

Rules:
- The days array must contain exactly {day_count} day objects.
- Every day must include at least 3 activities: morning, afternoon, and evening.
- Every activity must include time, title, description, location, and estimatedCost.
- Preserve useful existing day details, but fill every missing or sparse day.
- Include meals, tips, packingList, generalTips, travelChecklist, and estimatedTotalBudget.
- Include changeSummary with a short 2-4 word label for this version.
- Return only valid JSON. No markdown.

Incomplete itinerary JSON:
{json.dumps(raw_itinerary, indent=2)}
""",
            },
        ],
        temperature=0.55,
        max_tokens=4000,
        response_format={"type": "json_object"},
    )

    completed = parse_itinerary_json(response.choices[0].message.content.strip())
    if not itinerary_has_complete_days(completed, trip):
        print("Incomplete itinerary completion response:")
        print(json.dumps(completed, indent=2))
        raise ValueError("I couldn't fully update the itinerary. Please try again.")

    return completed


def coerce_itinerary(raw_itinerary, trip):
    day_count = trip_day_count(trip.get("startDate"), trip.get("endDate"))
    dates = trip_dates(trip.get("startDate"), day_count)
    days = raw_itinerary.get("days") if isinstance(raw_itinerary.get("days"), list) else []

    normalized_days = []
    for index in range(day_count):
        source_day = days[index] if index < len(days) and isinstance(days[index], dict) else {}
        activities = source_day.get("activities") if isinstance(source_day.get("activities"), list) else []
        meals = source_day.get("meals") if isinstance(source_day.get("meals"), list) else []
        tips = source_day.get("tips") if isinstance(source_day.get("tips"), list) else []

        normalized_days.append(
            {
                "day": index + 1,
                "date": source_day.get("date") or dates[index],
                "theme": source_day.get("theme") or f"Explore {trip.get('destination', 'the destination')}",
                "activities": activities[:5],
                "meals": meals[:3],
                "tips": tips[:4],
            }
        )

    checklist = raw_itinerary.get("travelChecklist") if isinstance(raw_itinerary.get("travelChecklist"), dict) else {}

    return {
        "title": raw_itinerary.get("title") or f"{trip.get('destination', 'Trip')} Itinerary",
        "summary": raw_itinerary.get("summary") or "A personalized itinerary generated from the saved trip request.",
        "changeSummary": raw_itinerary.get("changeSummary") or "Initial Plan",
        "days": normalized_days,
        "packingList": raw_itinerary.get("packingList") if isinstance(raw_itinerary.get("packingList"), list) else [],
        "generalTips": raw_itinerary.get("generalTips") if isinstance(raw_itinerary.get("generalTips"), list) else [],
        "travelChecklist": {
            "documents": checklist.get("documents") if isinstance(checklist.get("documents"), list) else [],
            "packing": checklist.get("packing") if isinstance(checklist.get("packing"), list) else [],
            "weatherPrep": checklist.get("weatherPrep") if isinstance(checklist.get("weatherPrep"), list) else [],
            "reservations": checklist.get("reservations") if isinstance(checklist.get("reservations"), list) else [],
            "localLogistics": checklist.get("localLogistics") if isinstance(checklist.get("localLogistics"), list) else [],
        },
        "estimatedTotalBudget": raw_itinerary.get("estimatedTotalBudget") or "Varies by booking choices",
    }


def build_itinerary_prompt(trip):
    day_count = trip_day_count(trip.get("startDate"), trip.get("endDate"))
    interests = ", ".join(normalize_interests(trip.get("interests"))) or "balanced sightseeing, food, and local culture"
    budget = BUDGET_LABELS.get(trip.get("budget"), trip.get("budget") or "not specified")
    traveler_count = trip.get("travelerCount") or 1
    update_instruction = trip.get("metadataUpdateInstruction") or ""

    return f"""
Create a practical {day_count}-day travel itinerary for {trip.get("destination")}.

Trip constraints:
- Plan name: {trip.get("planName") or "Untitled trip"}
- Departure city: {trip.get("departureCity") or "Not specified"}
- Travelers: {traveler_count}
- Dates: {trip.get("startDate")} to {trip.get("endDate")}
- Budget: {budget}
- Interests: {interests}
- Update request: {update_instruction or "None"}

Rules:
- Plan around the selected destination. Do not replace it with another destination.
- If an update request is provided, apply it while respecting the updated trip constraints.
- Use realistic pacing for non-technical travelers who want a simple all-in-one plan.
- The days array must contain exactly {day_count} day objects.
- Include morning, afternoon, and evening activities for every day, not just the first day.
- Every activity must include time, title, description, location, and estimatedCost.
- Include meals, local logistics, booking priorities, packing items, and practical tips.
- Include a travel checklist with documents, packing, weather preparation, reservations, and local logistics.
- Include changeSummary with a short 2-4 word label for this version, such as "Initial Plan".
- Keep recommendations concise and actionable.
- Return only valid JSON. No markdown.

JSON schema:
{{
  "title": "string",
  "summary": "string",
  "changeSummary": "string",
  "days": [
    {{
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "string",
      "activities": [
        {{
          "time": "HH:MM",
          "title": "string",
          "description": "string",
          "location": "string",
          "estimatedCost": "string"
        }}
      ],
      "meals": [
        {{
          "type": "breakfast|lunch|dinner",
          "recommendation": "string",
          "estimatedCost": "string"
        }}
      ],
      "tips": ["string"]
    }}
  ],
  "packingList": ["string"],
  "generalTips": ["string"],
  "travelChecklist": {{
    "documents": ["string"],
    "packing": ["string"],
    "weatherPrep": ["string"],
    "reservations": ["string"],
    "localLogistics": ["string"]
  }},
  "estimatedTotalBudget": "string"
}}
"""


def build_refinement_prompt(trip, current_itinerary, instruction):
    return f"""
Refine this existing TripAI itinerary according to the user's confirmed change request.

Confirmed itinerary change request:
{instruction}

Trip constraints:
- Destination: {trip.get("destination")}
- Departure city: {trip.get("departureCity") or "Not specified"}
- Dates: {trip.get("startDate")} to {trip.get("endDate")}
- Travelers: {trip.get("travelerCount") or 1}
- Budget: {BUDGET_LABELS.get(trip.get("budget"), trip.get("budget") or "not specified")}
- Interests: {", ".join(normalize_interests(trip.get("interests"))) or "not specified"}

Current itinerary JSON:
{json.dumps(current_itinerary, indent=2)}

Rules:
- Return a complete updated itinerary JSON object, not a partial patch.
- The confirmed change request above is the user's actual itinerary update intent.
- Keep the same destination and trip dates unless the instruction explicitly asks to change them.
- Preserve useful parts of the current itinerary when they still fit the instruction.
- Keep the result concise, realistic, and easy to follow.
- Include title, summary, changeSummary, days, packingList, generalTips, travelChecklist, and estimatedTotalBudget.
- Set changeSummary to a short 2-4 word label describing what changed, such as "Cheaper Flights", "More Relaxed Pace", or "Food-Focused".
- Return only valid JSON. No markdown.
"""


@app.route("/chat", methods=["POST"])

def chat():
    data = request.get_json() 
    user_message = data.get("message", "") # gets the message from the user
    history = data.get("history", []) # gets the previous message(s) for context
    questionnaire_context = data.get("questionnaireContext")

    if not user_message: # if the user didn't provide a message, return an error
        return jsonify({"error": "No message provided, please provide one!"}), 400 # bad-request, clinet sent something wrong...
    try:
        context_prompt = ""
        if questionnaire_context:
            context_prompt = (
                "\n\nThe user is currently completing TripAI's quick-start questionnaire. "
                "Use this live questionnaire state to make your answer specific, practical, and easy to apply. "
                "Help them choose destinations, dates, budget, interests, and plan details. "
                "If a destination is already provided, plan around that destination instead of recommending a replacement. "
                "You may mention nearby areas, neighborhoods, or day trips, but label them as additions to the selected destination. "
                "Only suggest alternative destination cities if the user explicitly asks for alternatives or has not chosen a destination yet. "
                "If fields are missing, ask at most one focused follow-up question or suggest concrete options. "
                "Current questionnaire state:\n"
                f"{json.dumps(questionnaire_context, indent=2)}"
            )

        messages = [
            {
                "role": "system",
                "content": (
                    "You are Trippy, a friendly and knowledgeable travel assistant. "
                    "Help users plan trips, suggest destinations, recommend things to do, "
                    "places to eat, hotels to stay, packing tips, and general travel advice. "
                    "Keep your answers concise, helpful, and engaging. "
                    "When helping with a saved or in-progress questionnaire, prioritize the user's selected destination, dates, budget, and interests. "
                    "If asked about something unrelated to travel, politely steer the conversation back to travel topics."
                    f"{context_prompt}"
                )
            },
            *history,
            {"role": "user", "content": user_message}
        ]

        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=messages
        )

        reply = response.choices[0].message.content.strip()
        return jsonify({"reply": reply})

    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": str(e)}), 500 # 500 means server error


@app.route("/delete-account", methods=["POST"])
def delete_account():
    auth_header = request.headers.get("Authorization", "")
    access_token = auth_header.replace("Bearer ", "", 1).strip()

    if not access_token:
        return jsonify({"error": "You must be logged in to delete your account."}), 401

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return jsonify({
            "error": (
                "Account deletion requires server-side Supabase admin credentials. "
                "Set SUPABASE_SERVICE_ROLE_KEY in the backend environment."
            )
        }), 500

    try:
        user = get_authenticated_user_from_token(access_token)
        user_id = user["id"]
        delete_user_owned_data(user_id)
        delete_auth_user(user_id)
        return jsonify({"success": True})
    except Exception as e:
        print(f"Account deletion error: {e}")
        return jsonify({"error": "Failed to fully delete account. Please try again."}), 500


@app.route("/generate-itinerary", methods=["POST"])
def generate_itinerary():
    data = request.get_json() or {}
    trip = data.get("trip") or {}

    required_fields = ["destination", "startDate", "endDate", "budget"]
    missing_fields = [field for field in required_fields if not trip.get(field)]
    if missing_fields:
        return jsonify({"error": f"Missing required trip fields: {', '.join(missing_fields)}"}), 400

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are TripAI's itinerary generation engine. "
                        "Generate structured, personalized travel itineraries from validated questionnaire data. "
                        "Return only JSON that matches the requested schema."
                    ),
                },
                {"role": "user", "content": build_itinerary_prompt(trip)},
            ],
            temperature=0.7,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content.strip()
        raw_itinerary = complete_itinerary_days(parse_itinerary_json(content), trip)
        itinerary = coerce_itinerary(raw_itinerary, trip)
        return jsonify({"itinerary": itinerary, "model": OPENAI_MODEL})
    except Exception as e:
        print(f"Itinerary generation error: {e}")
        return jsonify({"error": client_safe_error_message(e)}), 500


@app.route("/refine-itinerary", methods=["POST"])
def refine_itinerary():
    data = request.get_json() or {}
    trip = data.get("trip") or {}
    current_itinerary = data.get("itinerary") or {}
    instruction = (data.get("instruction") or "").strip()

    if not instruction:
        return jsonify({"error": "A refinement instruction is required."}), 400

    if not current_itinerary:
        return jsonify({"error": "An existing itinerary is required before refinement."}), 400

    required_fields = ["destination", "startDate", "endDate", "budget"]
    missing_fields = [field for field in required_fields if not trip.get(field)]
    if missing_fields:
        return jsonify({"error": f"Missing required trip fields: {', '.join(missing_fields)}"}), 400

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are TripAI's itinerary refinement engine. "
                        "Revise existing travel itineraries from user instructions. "
                        "Return only JSON that matches the existing itinerary schema."
                    ),
                },
                {"role": "user", "content": build_refinement_prompt(trip, current_itinerary, instruction)},
            ],
            temperature=0.65,
            max_tokens=4000,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content.strip()
        raw_itinerary = complete_itinerary_days(parse_itinerary_json(content), trip)
        itinerary = coerce_itinerary(raw_itinerary, trip)
        return jsonify({"itinerary": itinerary, "model": OPENAI_MODEL})
    except Exception as e:
        print(f"Itinerary refinement error: {e}")
        return jsonify({"error": client_safe_error_message(e)}), 500
    
if __name__ == "__main__":
    print(f"Trippy backend running on http://localhost:{PORT}")
    app.run(debug=False, port=PORT)
