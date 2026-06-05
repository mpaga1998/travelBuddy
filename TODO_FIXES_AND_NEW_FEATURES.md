# nook — Fix-It To-Do + Two New Features (build spec)

Actionable, ordered checklist. Three parts:
- **Part A** — step-by-step to resolve the weaknesses from the review.
- **Part B** — Feature 1: extract a place/pin from IG Reels / TikTok / Pinterest.
- **Part C** — Feature 2: a personal "want-to-visit" map fed by Feature 1, by
  saving public pins, or by adding places manually.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done. Each item names the file(s)
to touch and a **Done when** check.

---

## Part A — Resolve the weaknesses (do these first; they de-risk everything else)

### A0. Repo hygiene & cruft (½ day, do today)

- [x] **A0.1 Delete dead/empty files.** Remove `src/features/pins/pinStore.ts`
  (0 lines), `src/features/map/MapView.tsx.bak`, and `src/app/App.tsx` +
  `src/app/routes.tsx` if empty/unused. **Done when** `grep -rn "pinStore" src/`
  is empty and the build still passes.
- [x] **A0.2 Stop committing build artifacts.** Add `dist/`, `build.log`,
  `test-results/`, `playwright-report/` to `.gitignore` and `git rm -r --cached`
  them. **Done when** `git status` shows them ignored.
- [x] **A0.3 Real README** (also roadmap 8.3). Replace the Vite template with:
  what nook is, stack, env vars (point at `.env.example`), `npm i` → `dev` →
  `test:e2e`, deploy notes. **Done when** a new dev can run it in <30 min.

### A1. Correctness bugs that will bite in production

- [x] **A1.1 Pin down the OpenAI model.** `api/lib/openai.ts` defaults to
  `'gpt-5.4-mini'` while `.env.example` says `gpt-3.5-turbo`/`gpt-4-turbo`.
  Choose the real model, set it in one constant, document it in `.env.example`.
  **Done when** model name appears in exactly one place and matches the deployed
  env. 
- [x] **A1.2 Kill the dead second generation pipeline.** Decide: text-stream
  (`openai.ts`) is the live path. Either wire up or delete the `dayBased*` set
  (`dayBasedGeneration/Prompt/Rendering/Validation` + `structuredPrompts`,
  `itinerarySchema`). **Done when** there's one generation path and no
  unreferenced exports (`npx ts-prune` is clean).
- [ ] **A1.3 Replace the Italy-only travel-time matrix.** `dayBasedValidation.ts`
  hardcodes `REALISTIC_TRAVEL_TIMES` for 5 Italian cities only — silently wrong
  for the rest of Europe. Swap for Mapbox Directions (driving/transit) distance,
  or haversine + mode heuristic, cached per city-pair. **Done when** a Berlin→
  Prague trip validates without the matrix. *(If A1.2 deletes the structured path,
  fold this into whatever validation the live path keeps.)*

### A2. Security & launch gaps (roadmap 8.x carried forward)

- [ ] **A2.1 Lock CORS** (roadmap 8.2). Replace `Access-Control-Allow-Origin: *`
  in every `api/*` handler with an allowlist from `process.env.ALLOWED_ORIGINS`.
  Centralize in one `api/lib/cors.ts` helper. **Done when** a disallowed origin
  is rejected and the prod origin works.
- [ ] **A2.2 Privacy policy + cookie notice** (roadmap 8.5) — needed before any
  real users, especially EU audience. **Done when** `/privacy` ships next to the
  existing `/terms` and `/guidelines`.

### A3. Observability & quality (so you can debug + not regress)

- [ ] **A3.1 Structured logging** (roadmap 6.1). Replace `console.log` in `api/`
  with `pino`, tag every request with `x-vercel-id` (or a generated id). One
  `api/lib/log.ts`. **Done when** logs are JSON with a request id.
- [ ] **A3.2 AI eval harness.** `tests/evals/` with 20–30 trip inputs + a
  rubric (has real venues, geocodes, respects budget/pace, no banned vocab).
  Run on prompt/model change. **Done when** `npm run eval` prints pass/fail per
  case. *Protects the moat — highest-value test work.*
- [ ] **A3.3 Unit tests for the pure logic** that has no coverage:
  `inputValidation`, `budgetContext`, `travelContext`, `extractPlaces` parsing,
  geocoding fallbacks. **Done when** Vitest covers these branches.

### A4. Robustness & cost (compounds with the new features)

- [ ] **A4.1 Model abstraction + fallback.** Wrap OpenAI behind
  `api/lib/llm.ts`; add a secondary model/provider for outages. **Done when**
  flipping an env var switches provider with no call-site changes.
- [ ] **A4.2 Itinerary + geocode cache.** Cache geocoding results (Mapbox) and
  itineraries by normalized trip signature in a Supabase `*_cache` table or KV.
  **Done when** a repeat geocode/trip is served without an upstream call.
- [ ] **A4.3 Router refactor + lazy routes** (unblocks perf 9.4 *and* Feature
  shareable pages). Adopt a small router; `React.lazy` each feature route.
  **Done when** initial JS bundle drops measurably (Lighthouse before/after).
- [ ] **A4.4 Accessibility pass** (roadmap 9.2) — ARIA on icon buttons, modal
  keyboard nav, focus states. **Done when** axe-core shows no critical issues on
  the main flows.

> **Suggested order:** A0 → A1 → A2 → A3.1/A3.2 → A4. A0–A2 are days; A3–A4 are
> the ongoing hardening that runs alongside Parts B & C.

---

## Part B — Feature 1: Extract a place/pin from a Reel / TikTok / Pinterest

**Goal:** user pastes a social URL → nook returns one or more candidate places
with coordinates → user confirms → it lands on their "want-to-visit" map (Part C)
and can optionally be published as a public community pin.

**Big advantage:** the hard parts already exist. The itinerary feature already
does *named-place → structured JSON → Mapbox geocode with proximity bias*
(`api/lib/extractPlaces.ts`, `api/itinerary/extract.ts`, `src/lib/venueGeocoding.ts`,
including the careful "don't embed the city hint in the query" bug-fix). Feature 1
swaps the *input* from itinerary markdown to a social caption/transcript and
reuses the rest.

### B0. The one real decision: how do we get text out of a social post?

Getting a usable signal out of the URL is the crux. Three tiers — **ship Tier 1
first**:

- **Tier 1 — metadata only (caption / title / description).** Fetch the post's
  oEmbed / OpenGraph tags server-side, feed that text to the existing LLM
  extractor. Cheap, fast, lowest legal risk.
  - TikTok: public oEmbed `https://www.tiktok.com/oembed?url=…` (title + author).
  - Pinterest: pins expose OG tags + a source link; richest of the three.
  - Instagram: oEmbed now needs a Meta app + `oembed_read` token, and many posts
    are login-walled — **expect IG to be the weakest** in Tier 1. Document it.
- **Tier 2 — on-screen text + audio (better recall).** Download a keyframe set +
  audio (only via compliant means), OCR the frames, Whisper-transcribe the audio,
  then extract. Catches places shown but never typed in the caption. **Higher
  cost + ToS sensitivity — gate behind a flag, legal review first.**
- **Tier 3 — vision model on frames** for "what landmark is this." Most expensive,
  least reliable. Backlog only.

> **Recommendation:** build Tier 1 end-to-end, ship it, measure hit rate. Only add
> Tier 2 for the platforms where Tier 1 under-delivers (likely IG).

### B0.1 Legal / ToS guardrails (non-negotiable)

- [ ] Use **official oEmbed/Graph/Pinterest APIs** wherever they exist; never bulk
  scrape; only **user-initiated, single-URL** requests.
- [ ] Store and display **attribution** (source URL + author handle) on any pin
  created this way.
- [ ] Respect robots/ratelimits; cache responses to avoid re-fetching.
- [ ] Add a short ToS/legal review checkpoint before Tier 2 (video/audio download).

### B1. Backend — new extraction endpoint

- [ ] **B1.1** `api/lib/socialFetch.ts` — `fetchSocialMetadata(url)`:
  detect platform from the host, call the right oEmbed/OG path, return
  `{ platform, author, caption, thumbnailUrl, sourceUrl, detectedCity? }`.
  Best-effort, typed, times out (reuse the 2–3 s `AbortController` pattern from
  `extract.ts`).
- [ ] **B1.2** `api/social/extract.ts` (POST, copy the guard stack from
  `api/itinerary/extract.ts`: `requireAuth` → `validateBodySize` → **rate limit**
  (new low cap, e.g. 20/hr, reuse `rateLimit.ts`) → **moderation** on the caption
  via `moderation.ts`). Flow: `fetchSocialMetadata` → reuse the LLM place
  extractor (generalize `extractPlacesOnly` to accept arbitrary text) → Mapbox
  geocode each candidate with proximity bias to `detectedCity` → return ranked
  `candidates[]` with `{ name, lat, lng, type, confidence, context }`.
- [ ] **B1.3** Generalize `extractPlaces.ts`: rename the core to
  `extractPlacesFromText(text, biasLat, biasLng)` so both itinerary markdown and
  social captions use it. Keep `type` mapping aligned to `PinCategory`
  (food/nightlife/sight/shop/beach/other).
- **Done when** `POST /api/social/extract { url }` returns geocoded candidates for
  a public TikTok/Pinterest URL, 401s without auth, 429s past the cap, and rejects
  flagged captions.

### B2. Frontend — paste-and-confirm flow

- [ ] **B2.1** `src/features/import/socialImportApi.ts` — `extractFromUrl(url)`
  attaching the JWT (mirror `itineraryApi.ts`).
- [ ] **B2.2** `src/features/import/ImportFromLinkModal.tsx` — input for the URL
  (+ paste button), loading state, then a **candidate list**: thumbnail, name,
  detected city, mini-map preview, confidence. User picks/edits the right one
  (disambiguation matters — geocoding is fuzzy). On confirm → call Part C's
  `addSavedPlace(...)` with `source = platform`, `source_url = url`.
- [ ] **B2.3** Entry points: a "＋ Import from link" button on the map top bar
  (`FilterBar`) and in the "My Map" view (Part C). Optional: a PWA share-target so
  users can share a reel straight into nook (manifest `share_target`).
- **Done when** pasting a link adds a confirmed place to the user's map with
  correct coords + attribution.

### B3. (Optional) publish to the community

- [ ] **B3.1** On confirm, offer "Also share as a public pin." If yes, call the
  existing `createPin(...)` (already has moderation + image handling). Keeps the
  community map growing from imports — feeds the seed-content problem (roadmap
  7.3). **Done when** an imported place can become a public pin in one tap.

---

## Part C — Feature 2: The "want-to-visit" personal map

**Goal:** every user has their own map/list of places they want to visit, filled
three ways: (1) imported via Feature 1, (2) saved from public community pins,
(3) added manually. Plus a "visited" toggle so it doubles as a travel log.

### C0. Data model decision

Today, `pin_bookmarks` already saves *public* pins (and powers `bookmark_count`
+ the public-profile "Bookmarked" tab — a social signal). But a wishlist must also
hold **private/external places** (imports, manual drops) that aren't in the public
`pins` table.

> **Recommendation:** add a new owner-private `saved_places` table as the wishlist
> superset; **keep `pin_bookmarks` as-is** (it's the public "save" count). Saving a
> community pin "to my map" creates a `saved_places` row with `pin_id` set. This
> avoids a risky data migration. (Unifying the two is a fine *later* cleanup —
> note it, don't block on it.)

### C1. Migration

- [ ] **C1.1** `supabase/migrations/<date>_add_saved_places.sql`:
  ```
  saved_places(
    id uuid pk default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    pin_id uuid null references pins(id) on delete set null,  -- when saved from a community pin
    title text not null,
    note text null,
    category text null,           -- mirrors PinCategory
    lat double precision not null,
    lng double precision not null,
    city text null, country text null,
    source text not null,         -- 'manual'|'reel'|'tiktok'|'pinterest'|'community_pin'|'itinerary'
    source_url text null,         -- attribution for imports
    source_author text null,
    visited boolean not null default false,
    created_at timestamptz default now()
  )
  ```
  Indexes: `(user_id, created_at desc)`, `(user_id, visited)`, a bbox index on
  `(lat,lng)` (mirror `20260424_add_pins_lat_lng_idx.sql`). **RLS: owner-only** for
  ALL of SELECT/INSERT/UPDATE/DELETE (`auth.uid() = user_id`) — unlike bookmarks,
  this list is private. **Done when** the migration applies and RLS blocks cross-
  user reads.

### C2. Backend / data access

- [ ] **C2.1** `src/features/savedPlaces/savedPlacesApi.ts`:
  `listSavedPlaces(bounds?, { visited? })`, `addSavedPlace(input)`,
  `updateSavedPlace(id, patch)` (note/visited/category), `deleteSavedPlace(id)`,
  `saveCommunityPin(pin)` (writes a row with `pin_id` + `source:'community_pin'`).
  Reuse the bounding-box query shape from `pinApi.listPins`. **Done when** CRUD
  works and bbox filtering returns only in-view places.
- [ ] **C2.2** `src/features/savedPlaces/useSavedPlaces.ts` — hook mirroring
  `useBookmarks` (owns the set + optimistic toggles for `visited` and add/remove).

### C3. Frontend — the map + list

- [ ] **C3.1 "My Map" mode.** Add a toggle on the map (Community ⇄ My Map) in
  `FilterBar`. In My-Map mode, `MapView` renders `saved_places` through the
  existing `PinLayer`/clustering with a **distinct marker style** (e.g. ★/heart,
  greyed when `visited`). Reuse everything — `PinLayer` already takes a pin list.
  **Done when** saved places cluster and render with their own style.
- [ ] **C3.2 Manual add.** Reuse the existing draft-pin drop flow in `MapView`
  (long-press / "drop a pin" → the draft form), but in My-Map mode it writes to
  `saved_places` instead of public `pins`. Add a place search box (Mapbox
  geocoder) so users can add by name, not just by dropping. **Done when** a user
  can add a place by dropping a pin *and* by searching a name.
- [ ] **C3.3 Save from community.** Add a "Save to my map" (★) button in
  `PinPopup` next to the existing bookmark/report actions → `saveCommunityPin`.
  **Done when** a public pin appears on My Map with a back-reference.
- [ ] **C3.4 List view + travel log.** New profile tab "My Places" (clone
  `BookmarkedPinsTab` layout): grid/list of saved places, filter by
  want-to-visit / visited / city, edit note, toggle visited, "View on map",
  delete. **Done when** the tab lists, filters, and edits saved places.
- [ ] **C3.5 Feed itineraries.** "Add to my map" on extracted itinerary places
  (`itinerary_places` already exist) → `saved_places` with `source:'itinerary'`.
  Closes the loop: planned trip → saved places → mark visited → pin it publicly.

### C4. Cross-feature glue

- [ ] **C4.1** Feature 1's confirm step (B2.2) calls `addSavedPlace` — the import
  *is* a write into this table. The two features share one destination.
- [ ] **C4.2** Optional nicety: surface a small count badge ("12 places saved")
  and a "plan a trip around my saved places" button that pre-fills the itinerary
  form with the user's saved places as `desiredAttractions`. Strong tie-in with
  the existing AI generator and a real retention hook.

---

## Suggested build order (end to end)

1. **A0 + A1.1** (hygiene + model pin-down) — clears noise, ~1 day.
2. **C1 + C2** (saved_places table + API) — the foundation both features write to.
3. **B1** (social extract backend, Tier 1) — reuses the itinerary extractor.
4. **C3.1–C3.4** (My Map UI: render, manual add, save-from-community, list).
5. **B2 + B3** (import modal + optional publish) — now it has somewhere to land.
6. **A2 (CORS/privacy)** before exposing to real users.
7. **A3.2 eval harness + A1.2/A1.3** (kill dead path, fix travel times) in parallel.
8. **C4.2 + A4** (saved-places → itinerary tie-in, router/perf/cache) as polish.

**Why this order:** Part C's table is the shared sink, so it goes first; Feature 1
is mostly a new *input* into an extractor you already have; the weakness-fixes that
gate real users (CORS, privacy, model correctness) interleave so you're never
shipping a known-broken thing to actual traffic.
