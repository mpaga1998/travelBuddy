# Backpack Map — Hardening & Launch Roadmap

Sequential plan to take the app from working MVP to investor/launch-ready.
Do phases top-to-bottom; each assumes the previous is done.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

**Progress:** 14 / 50 steps complete — **Phase 1 ✅ · Phase 2 ✅**

---

## Phase 1 — Critical security

Nothing else matters until this is done.

> **Deploy target:** Vercel serverless (`api/`) is the single source of truth.
> The duplicate Express backend (`server/`) was deleted once we unified Phase 1
> across both code paths — see 1.3.

- [x] **1.1** Create `requireAuth` — JWT verification that returns the verified user or 401s. Shipped as `api/lib/requireAuth.ts` (serverless-shaped) and previously `server/middleware/requireAuth.ts` (Express).
- [x] **1.2** Apply `requireAuth` to every protected route (`/api/itinerary`, `/api/itinerary/save`).
- [x] **1.3** Stop trusting client-sent `userId`. Every handler now pulls ownership from `req.user.id` (the verified JWT) and fetches `firstName` server-side from the `profiles` table. In the process, unified on Vercel serverless and deleted `server/` + Express deps.
- [x] **1.4** Switch backend Supabase client to `service_role` key. `api/lib/supabaseServer.ts` now prefers `SUPABASE_SERVICE_ROLE_KEY` (server-only name, no VITE_ prefix), falls back to the legacy `VITE_SUPABASE_SERVICE_KEY` with a warning, and fails closed in production if neither is set. `.env.example` documents the new var. Vercel env var added; RLS fixes applied (profiles SELECT locked to self, pin_bookmarks SELECT narrowed to authenticated).
- [x] **1.5** Frontend sends JWT. `src/features/itinerary/itineraryApi.ts` grabs the session token and attaches `Authorization: Bearer <token>` on both calls. (Shipped alongside 1.3.)
- [x] **1.6** Per-user sliding-window rate limiter on `/api/itinerary` (10/hour). Backed by a `rate_limits` table in Supabase — chosen over Upstash to avoid a new vendor. Shipped as `api/lib/rateLimit.ts` + `supabase/migrations/20260421_add_rate_limits.sql` (applied). Fails **open** on DB error (cost-protection limiter should never lock a paying user out because Postgres hiccuped). Sets `X-RateLimit-*` + `Retry-After` headers.
- [x] **1.7** Request size limits. `api/lib/validateBodySize.ts` rejects bodies >100 KB with 413 before any JSON parse / DB call / OpenAI call. Checks `Content-Length` first, falls back to measuring the parsed body (catches chunked uploads and lying clients). Applied to both `/api/itinerary` and `/api/itinerary/save`.
- [x] **1.8** Verified git history clean across all 173 commits / all 22 refs (local + origin). `.env` never tracked (confirmed via `git log --all -- .env` + `git ls-files`, and it's gitignored at `.gitignore:26`). Pickaxe search (`git log -S`) for the live OpenAI key prefix and the Supabase project ref returned zero hits. `.env.example` contains only `sk-...` / `eyJ...` placeholders — no real values. The worktree `.env` holds real secrets but is properly ignored. If any branch is ever force-pushed or rebased, re-run these checks before merging.

## Phase 2 — Refactor the giants

So future changes don't require rewriting 1,800-line files.

- [x] **2.1** Split `MapView.tsx` (1,812 → 850 lines). New files under `src/features/map/`: `MapCanvas.tsx` (pure Mapbox instance + lifecycle), `PinLayer.tsx` (marker cache + popup lifecycle via `createRoot`), `PinPopup.tsx` (real React component — killed the 300-line escaped-HTML string), `FilterBar.tsx` (controlled top bar + mobile drawer), `hooks/useMapPins.ts` (pins + filter state), `hooks/useBookmarks.ts` (bookmark set + toggle), plus `mapConstants.ts` + `hooks/useIsMobile.ts`. Draft-pin modal, tips viewer, delete confirmation, and lightbox were NOT in 2.1's scope so they remain as file-local components in `MapView.tsx` — obvious follow-up.
- [x] **2.2** Native clustering shipped in `PinLayer`. Replaced per-pin `mapboxgl.Marker` elements with a single GeoJSON source (`cluster: true`, `clusterRadius: 50`, `clusterMaxZoom: 14`). Four GL layers: cluster circle (graduated color/size by `point_count`), cluster count label, unclustered point circle (blue / black-for-hostels, keeps the 2.1 look), emoji symbol layer. Cluster click calls `getClusterExpansionZoom` + `easeTo`; point click looks the pin up by id from a ref and delegates to `onSelect` so the popup lifecycle is unchanged. Removes the ~2k-pin DOM wall.
- [x] **2.3** Split `ItineraryModal.tsx` (1,393 lines) into: form component (`ItineraryForm.tsx`), preview/render component (`ItineraryPreview.tsx`), save-to-profile flow, and `useItineraryDraft` hook. Also fixed the venue-link bug: react-markdown v9 was stripping our custom `mapbox:` URL scheme — added `urlTransform={(url) => url}` in `ItineraryPreview` so the link component can route via `openVenueInMapsSync`.
- [x] **2.4** Split `profileModal.tsx` (1,414 → 346-line shell) into `tabs/` subcomponents: `ProfileInfoTab.tsx` (avatar upload + form + password reset + sign-out), `BookmarkedPinsTab.tsx` (saved pins grid + detail view), `SavedItinerariesTab.tsx` (saved itineraries list + markdown detail view). Shared style helpers in `tabs/profileStyles.ts` + `tabs/Field.tsx`. Each tab owns its own data load + error state; the shell only handles open/close, base-profile load, and tab routing.
- [x] **2.5** Extract inline styles. Done in two phases: **2.5a** installed Tailwind v3.4.19 + PostCSS + autoprefixer, generated `tailwind.config.js` (content globs for `index.html` + `src/**/*.{ts,tsx}`), wired `@tailwind base/components/utilities` into `src/index.css`. **2.5b** migrated ~258 inline `style={...}` props across 11 feature files to Tailwind utility classes in 11 atomic commits: `MapCanvas` (1), `LoadingPage` (5), `AuthPage` (7), `ItineraryModal` (15), `ItineraryPreview` (17), `PinPopup` (20), `FilterBar` (27 → 1 kept for per-tab dynamic bg color), `MapView` (41, kept one global `<style>` block for Mapbox popup selectors + imperative lightbox DOM mutations), `InitialPage` (31), `SavedItinerariesTab` (41), `ItineraryForm` (53). Extracted shared className helpers (`topRoundBtnClass`, `copyBtnClass`/`deleteBtnClass`, `pillBtnClass`, `ageRangeBtnClass`, input/label/chip helpers in ItineraryForm) to avoid repeating long utility lists. `hover:`/`active:` variants replaced imperative `onMouseEnter`/`onMouseLeave` handlers throughout. Unblocks the design refresh.
- [x] **2.6** Added error boundaries around each top-level feature. New `src/components/FeatureErrorBoundary.tsx` — reusable class component with `featureName`, optional `onError` sink, dev-only error message, and a reset button. Wrapped in `App.tsx` (Home page, Map page), `InitialPage.tsx` (ItineraryModal, ProfileModal — conditional-mount so boundary resets on re-open), and `MapView.tsx` (ItineraryModal — same conditional-mount pattern). One crashed feature no longer blanks the whole app.

## Phase 3 — Data + UX at scale

So the app doesn't die at 10k pins.

- [x] **3.1** Bounding-box pin queries. `listPins()` accepts viewport bounds; fetch only pins in view plus buffer. Debounced re-fetch on pan/zoom end.
- [x] **3.2** Server-side filtering. Move category / age / creator-type filters to SQL instead of fetching everything and filtering client-side.
- [ ] **3.3** Replace `alert()` with toasts. Install `sonner` or `react-hot-toast`. Every `alert(...)` and `confirm(...)` becomes a toast/modal.
- [ ] **3.4** Add loading skeletons for map, profile, itinerary views. Replace "Loading…" text.
- [ ] **3.5** Image handling. Enforce ~5MB max upload, use Supabase image transformation URLs for thumbnails, add client-side compression before upload.

## Phase 4 — Moderation

Before you ever go public. User-generated map + images + no moderation = trouble.

- [ ] **4.1** Create `pin_reports` table (`pin_id`, `reporter_id`, `reason`, `created_at`) + cached count column on `pins`.
- [ ] **4.2** Add "Report pin" button in the pin popup.
- [ ] **4.3** Auto-hide at threshold. `is_hidden` column on pins; trigger or cron sets true when reports ≥ N. Filter from `listPins`.
- [ ] **4.4** OpenAI moderation on submission. Free endpoint, one call. Reject flagged pins/itineraries with clear error.
- [ ] **4.5** Basic admin view at `/admin`. Lists reported/hidden pins with restore/remove actions. Gate on `is_admin` boolean in profiles.
- [ ] **4.6** Terms of Service + Community Guidelines pages.

## Phase 5 — The community layer

This is what makes it a "community" app. Currently missing despite the pitch.

- [ ] **5.1** Public user profile pages at `/u/:handle`. Add unique `handle` column to profiles. Show avatar, bio, pins, saved itineraries.
- [ ] **5.2** Follow system. `follows` table (`follower_id`, `followee_id`, `created_at`). Follow/unfollow button on profiles. Cached counts.
- [ ] **5.3** Activity feed at `/feed`. Pins from people you follow, newest first. Start chronological, no ranking.
- [ ] **5.4** Notifications. `notifications` table + triggers on: like, bookmark, follow. Bell icon + unread count in header.
- [ ] **5.5** Pin comments. `pin_comments` table (flat threading is fine). Moderation applies.

## Phase 6 — Observability + testing

Before real users land.

- [ ] **6.1** Structured logging. Replace every `console.log` in `api/` with `pino`. Tag logs with request IDs (use Vercel's `x-vercel-id` header or generate one).
- [ ] **6.2** Error tracking. Drop Sentry into frontend (`@sentry/react`) and backend (`@sentry/node`). ~10 min of setup.
- [ ] **6.3** Baseline analytics. PostHog or Plausible. Track: signup, pin created, itinerary generated/saved, follow, pin reported.
- [ ] **6.4** Smoke tests in Playwright: sign up, log in, create pin, generate itinerary, save itinerary.
- [ ] **6.5** GitHub Actions CI. Lint + typecheck + Playwright tests. Block merge on failure.
- [ ] **6.6** Pre-commit lint/typecheck via `husky` + `lint-staged`.

## Phase 7 — Product wedge

Can happen in parallel with earlier phases, but must be decided before fundraising.

- [ ] **7.1** Pick a niche and commit. Candidates: backpacker/hostel 18-35 (half-built already), solo-travel safety + community, long-term nomad routes. Rewrite landing page and empty states around it.
- [ ] **7.2** Reshape onboarding for the wedge. E.g. backpacker-focused signup asks "what region next?" and seeds map + suggests people to follow.
- [ ] **7.3** Seed content in chosen wedge. Manually add 100-300 high-quality pins in target region(s) before launch. A community map with zero pins is dead on arrival.
- [ ] **7.4** Unit economics doc. Avg OpenAI cost/active user/month. Free tier cap. Where paid starts. One page for the investor deck.

## Phase 8 — Launch prep

- [ ] **8.1** Deploy backend. Railway / Fly / Render for Express. Vercel for frontend. Env vars via hosting dashboard, never in git.
- [ ] **8.2** Fix CORS. Replace hardcoded `localhost:5173` / ngrok URL with `process.env.ALLOWED_ORIGINS` (comma-separated).
- [ ] **8.3** Real README. Setup, env vars, local run, tests, deployment. New engineer productive in 30 min.
- [ ] **8.4** Custom domain + HTTPS.
- [ ] **8.5** Legal pages. Privacy policy, ToS, cookie notice. Termly or iubenda generates acceptable boilerplate.
- [ ] **8.6** App store prep (if mobile). PWA install prompts, or wrap in Expo / React Native shell.

## Phase 9 — Polish

- [ ] **9.1** Design system. shadcn/ui (free, good) or similar. Replace inline-styled buttons/inputs/modals.
- [ ] **9.2** Accessibility pass. ARIA labels on icon buttons, keyboard nav in modals, visible focus states, contrast audit.
- [ ] **9.3** Empty states everywhere. "You haven't X yet — here's how to start" with CTAs.
- [ ] **9.4** Performance pass. Lighthouse run, fix obvious wins (lazy-load itinerary modal, memoize marker list, etc.).

---

## Rough effort estimates

| Phase | Effort | Blocking for launch? |
|-------|--------|----------------------|
| 1. Security | ~1 week | **Complete ✅** |
| 2. Refactor | ~1 week | No, but everything later gets slower without it |
| 3. Scale | ~3 days | Only if you expect >1k pins at launch |
| 4. Moderation | ~1 week | Yes for public launch |
| 5. Community | 2-3 weeks | Yes if pitching "community app" |
| 6. Observability + testing | ~1 week | Yes before paid users |
| 7. Product wedge | Ongoing | Yes before fundraising |
| 8. Launch prep | ~3 days | Yes obviously |
| 9. Polish | Ongoing | No |

**Non-negotiable before any real user:** ~~Phase 1~~ (done) + Phase 4.

---

*Last updated: 2026-04-23 (Phase 2.3 / 2.4 / 2.6 shipped — ItineraryModal + profileModal split + feature error boundaries; 2.5 Tailwind migration deferred pending npm install on Windows)*
