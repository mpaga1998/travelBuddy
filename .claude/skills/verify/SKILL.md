---
name: verify
description: How to verify nook changes end-to-end (Vercel serverless + Supabase auth boundary)
---

# Verifying nook changes

## Surfaces

- **Frontend-only changes** (pure UI, no `api/` involved): `npm run dev:frontend` (Vite,
  http://localhost:5173). Serverless routes are ABSENT — any `/api/*` call fails.
- **Anything touching `api/`** (itinerary, social import, moderation, admin): needs the
  serverless runtime. Two handles:
  1. `npm run dev` (= `vercel dev`) — requires `.env` with real keys (Supabase, OpenAI,
     Mapbox; see `.env.example`) and the Vercel CLI linked.
  2. Push the branch → Vercel auto-builds a preview deployment (the user's usual flow;
     they test from the preview URL, often on a phone).

## Hard boundary: authentication

Nearly every flow requires a signed-in Supabase session. Credentials are user-held —
the agent must NOT create accounts or enter passwords. Verification of authed flows is
therefore collaborative: the agent prepares an exact drive script (steps + expected
observations + probes + SQL spot-checks) and the user executes it, or the user signs in
inside the shared browser pane and the agent drives from there.

## DB spot-checks

Supabase SQL editor is the fastest oracle for write paths, e.g.:
`select ... from pins order by created_at desc limit 5;`
Remember RLS: the dashboard runs as service role and sees everything.

## Gotchas

- Migrations are applied MANUALLY by the user via the dashboard SQL editor (the CLI is
  not linked) — a new column referenced in a SELECT will 400 until the migration ran.
  Verify migration state before blaming code.
- `tsc`/eslint run in CI and pre-commit — do not count them as verification.
