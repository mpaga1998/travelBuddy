# travelBuddy

A full-stack travel planning app that combines an interactive map UI with authenticated user profiles and AI-assisted itinerary generation.

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node/Express (TypeScript)
- **Auth & DB:** Supabase
- **Maps:** Mapbox GL
- **AI:** OpenAI (server-side)
- **State:** Zustand

---

## Features

- **Supabase Auth** (login/signup) and session-based routing
- **User Profiles** in a `profiles` table (auto-created if missing)
- **Map-based UI** (Mapbox GL) for exploring / planning travel
- **AI itinerary generation** via a server-side OpenAI integration
- Optional dev helpers for **ngrok** tunneling during development

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite dev server

### Backend
- Express server written in TypeScript
- Loads environment variables and calls OpenAI from the server (so your API key stays off the client)

### Data/Auth
- Supabase (`@supabase/supabase-js`)
- Uses a `profiles` table and a small “self-heal” flow to create a row if one doesn’t exist.

---

## Repository Structure (high level)

- `src/` – React frontend
  - `src/lib/supabaseClient.ts` – creates the Supabase client (requires env vars)
  - `src/lib/ensureProfile.ts` – ensures the authenticated user has a `profiles` row
  - `src/features/...` – app features (auth, map, profile, etc.)
- `server/` – Express backend (TypeScript)
  - `server/index.ts` – backend entrypoint (started by `npm run dev`)
  - `server/services/openaiService.ts` – OpenAI itinerary generation logic
- `api/` – serverless-style API code (used for deployment patterns like Vercel)
  - `api/lib/openai.ts` – OpenAI itinerary generation pipeline utilities
- `supabase/` – local Supabase config / seed
- `SUPABASE_MIGRATION.md` – notes for updating the DB schema (example: DOB field)

---

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

You will need **Supabase** + **OpenAI** environment variables.

Create a `.env` file in the repo root (or use your platform’s env var UI in production):

```bash
# Supabase (frontend + server)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI (server only)
OPENAI_API_KEY=your_openai_api_key

# Optional (model override)
OPENAI_FALLBACK_MODEL=gpt-3.5-turbo
```

Notes:
- `VITE_...` variables are exposed to the frontend by Vite.
- `OPENAI_API_KEY` must **never** be used in the browser—this project reads it server-side.

### 3) Run the app (recommended)

Runs backend + frontend together:

```bash
npm run dev:all
```

This starts:
- Backend on `http://localhost:3000`
- Frontend on `http://localhost:5173`

### Alternative: run separately

Frontend only:

```bash
npm run dev:frontend
```

Backend only:

```bash
npm run dev
```

---

## Supabase setup

You’ll need a Supabase project with a `profiles` table.

### Migration example: Date of Birth (DOB)

If you want to add DOB support, see:
- `SUPABASE_MIGRATION.md`

---

## Deployment notes

This repo includes both:
- `server/` (Express server) for local/full server deployments
- `api/` (serverless-style code) which can be used for platforms like Vercel

Pick one deployment approach and ensure environment variables are set in the hosting provider.

---

## Troubleshooting

### “Missing Supabase env vars…”

Make sure you set:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The app throws early if these are missing (see `src/lib/supabaseClient.ts`).

### “OPENAI_API_KEY is not set…”

Set `OPENAI_API_KEY` in the backend/server environment.

---

## Scripts

- `npm run dev` – run backend (Express + TS)
- `npm run dev:frontend` – run frontend (Vite)
- `npm run dev:all` – run both concurrently
- `npm run dev:ngrok` – backend + frontend + ngrok tunnels
- `npm run build` – typecheck + build frontend
- `npm run lint` – run ESLint
- `npm run preview` – preview the built frontend

---

## License

Add a license if you plan to open-source this project (e.g., MIT).