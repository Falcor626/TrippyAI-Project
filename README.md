# TripAI / TrippyAI

TripAI is a React and Flask travel-planning app. It supports Supabase authentication, onboarding and trip questionnaires, saved trip requests, OpenAI-backed itinerary generation and refinement, itinerary version history, trip-scoped Trippy chat, maps, weather, flights, hotels, attractions, and account/profile settings.

## Developers

David Barrios, Daniel Marinca, Dean Martin Solideo, and Aidan Wallis.

## Local Setup

Install Node dependencies from the repo root:

```bash
npm install
```

Install backend dependencies in your Python environment:

```bash
pip install -r backend/requirements.txt
```

Create a local `.env` file for credentials and service URLs:

```env
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_key
REACT_APP_SERPAPI_KEY=your_serpapi_key
OPENAI_API_KEY=your_openai_key

# Required only for account deletion from the settings page
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional local overrides
REACT_APP_TRIPPY_API_URL=http://localhost:5000
REACT_APP_SERPAPI_PROXY_URL=http://localhost:5051/serpapi
TRIPPY_BACKEND_PORT=5000
SERPAPI_PROXY_PORT=5051
OPENAI_MODEL=gpt-3.5-turbo
```

`REACT_APP_TRIPPI_API_URL` is still supported as a fallback for older local `.env` files, but new setup should use `REACT_APP_TRIPPY_API_URL`.

## Run The App

Use the full development stack for normal work:

```bash
npm run dev
```

This starts:

- React app: http://localhost:3000
- Trippy Flask backend: http://localhost:5000
- SerpApi proxy: http://localhost:5051

You can also run services individually:

```bash
npm start
npm run chatbot-backend
npm run serpapi-proxy
```

## Supabase Data Model

The app expects these Supabase tables:

- `userProfiles`
- `traveler_preferences`
- `trip_requests`
- `itineraries`
- `itinerary_versions`
- `chat_sessions`
- `chat_messages`
- `itinerary_feedback`

It also expects a `profile-pictures` storage bucket for profile avatars. The current app stores the active itinerary snapshot in `itineraries` and version history in `itinerary_versions`; removed model/source metadata columns are not required by the frontend.

## Validation

Build the frontend:

```bash
npm run build
```

The default Create React App sample test was removed because it did not cover TripAI behavior. Add focused tests for auth, questionnaire submission, itinerary persistence, or travel-data rendering before relying on `npm test` as a real regression gate.
