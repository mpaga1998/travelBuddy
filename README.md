# nook

A community map for travelers. Drop pins on places you love — restaurants, viewpoints, beaches, hidden gems — with photos, tips, and reactions. Browse what other travelers and local hostels have pinned, plan trips with AI-generated itineraries, and build a personal "want-to-visit" list.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + TypeScript, Vite |
| Map | Mapbox GL JS |
| Backend (API routes) | Vercel Serverless Functions (`api/`) |
| Database + Auth | Supabase (Postgres + Row-Level Security) |
| AI | OpenAI (itinerary generation, place extraction) |
| Error tracking | Sentry (optional) |
| E2E tests | Playwright |

## Getting started

### 1. Prerequisites

- Node 18+
- A [Supabase](https://supabase.com) project
- A [Mapbox](https://mapbox.com) account (public token)
- An [OpenAI](https://platform.openai.com) API key
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`) for local API routes

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in every value in `.env` — see `.env.example` for descriptions. The required ones are:

| Variable | Where to get it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API (**server-only, never commit**) |
| `VITE_MAPBOX_TOKEN` | Mapbox → Tokens |
| `OPENAI_API_KEY` | platform.openai.com → API keys |

`VITE_SENTRY_DSN` and `SENTRY_DSN` are optional — leave empty to disable error tracking.

### 3. Database

Apply all migrations in order:

```bash
supabase db push
# or manually run files in supabase/migrations/ against your project
```

### 4. Install & run

```bash
npm install

# Full local dev (frontend + API routes via Vercel dev server):
npm run dev

# Frontend only (no API routes):
npm run dev:frontend
```

The app runs at `http://localhost:3000` (Vercel dev) or `http://localhost:5173` (Vite only).

### 5. E2E tests

```bash
# First time only — install Playwright browsers:
npm run test:e2e:install

# Run all tests (headless):
npm run test:e2e

# Interactive UI mode:
npm run test:e2e:ui
```

Tests expect the dev server to be running on `http://localhost:3000`.

## Deploying to Vercel

1. Push the repo to GitHub and import it in the [Vercel dashboard](https://vercel.com/new).
2. Set all environment variables from `.env.example` in **Project Settings → Environment Variables**.
3. Vercel auto-detects the Vite frontend and serves `api/` as serverless functions — no extra config needed.
4. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_MAPBOX_TOKEN` for the **Production** environment; `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` for **Server** (non-VITE) only.

## Project structure

```
src/
  app/            # (reserved)
  components/     # Shared UI primitives
  features/       # Feature modules (map, pins, itinerary, profile, …)
  lib/            # Shared utilities and Supabase client
  pages/          # Top-level page components
api/
  lib/            # Shared server utilities (auth, rate limiting, OpenAI, …)
  itinerary/      # AI itinerary generation endpoints
  pins/           # Pin CRUD endpoints
  social/         # (upcoming) Social URL extraction
supabase/
  migrations/     # Postgres migrations (apply in order)
```
