from flask import Flask, request, jsonify # flask is usefl for creating the backend server and managing the APIs
from flask_cors import CORS
from openai import OpenAI # using openai for the actual chat interactions
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)
CORS(app)

# PRIVATE KEY DON'T SHOW ANYONE!!!!!
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route("/chat", methods=["POST"])

def chat():
    data = request.get_json() 
    user_message = data.get("message", "") # gets the message from the user
    history = data.get("history", []) # gets the previous message(s) for context

    if not user_message: # if the user didn't provide a message, return an error
        return jsonify({"error": "No message provided, please provide one!"}), 400 # bad-request, clinet sent something wrong...
    try:
        messages = [
            {
                "role": "system",
                "content": (
                    # i used claude.ai to generate this prompt. i asked it to generate a prompt for this AI-model and use keywords. super helpful
                    "You are Trippi, a friendly and knowledgeable travel assistant. "
                    "Help users plan trips, suggest destinations, recommend things to do, "
                    "places to eat, hotels to stay, packing tips, and general travel advice. "
                    "Keep your answers concise, helpful, and engaging. "
                    "If asked about something unrelated to travel, politely steer the conversation back to travel topics."
                )
            },
            *history,
            {"role": "user", "content": user_message}
        ]

        # send msg to OpenAI and wait for a response back
        response = client.chat.completions.create(
            model="gpt-3.5-turbo", # using a downgraded model bc it's faster and cheaper
            messages=messages
        )

        # Get the text from OpenAI's response and send it back to the React
        reply = response.choices[0].message.content.strip()
        return jsonify({"reply": reply})

    # If an error occurs, print it and return it to React. Super helpful keep this in.
    except Exception as e:
        print(f"Chat error: {e}")
        return jsonify({"error": str(e)}), 500 # 500 means server error
    
if __name__ == "__main__":
    print("Trippi backend, running on http://localhost:5000")
    app.run(debug=False, port=5000)