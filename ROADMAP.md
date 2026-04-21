# Backpack Map — Hardening & Launch Roadmap

Sequential plan to take the app from working MVP to investor/launch-ready.
Do phases top-to-bottom; each assumes the previous is done.

**Legend:** `[ ]` not started · `[~]` in progress · `[x]` done

**Progress:** 4 / 50 steps complete

---

## Phase 1 — Critical security

Nothing else matters until this is done.

> **Deploy target:** Vercel serverless (`api/`) is the single source of truth.
> The duplicate Express backend (`server/`) was deleted once we unified Phase 1
> across both code paths — see 1.3.

- [x] **1.1** Create `requireAuth` — JWT verification that returns the verified user or 401s. Shipped as `api/lib/requireAuth.ts` (serverless-shaped) and previously `server/middleware/requireAuth.ts` (Express).
- [x] **1.2** Apply `requireAuth` to every protected route (`/api/itinerary`, `/api/itinerary/save`).
- [x] **1.3** Stop trusting client-sent `userId`. Every handler now pulls ownership from `req.user.id` (the verified JWT) and fetches `firstName` server-side from the `profiles` table. In the process, unified on Vercel serverless and deleted `server/` + Express deps.
- [ ] **1.4** Switch backend Supabase client to `service_role` key. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` and `.env.example`. Update `api/lib/supabaseServer.ts`. Review RLS policies now that the backend bypasses them.
- [x] **1.5** Frontend sends JWT. `src/features/itinerary/itineraryApi.ts` grabs the session token and attaches `Authorization: Bearer <token>` on both calls. (Shipped alongside 1.3.)
- [ ] **1.6** Add per-user rate limiting on `/api/itinerary`. Serverless-friendly options: Upstash Redis `@upstash/ratelimit`, or a `rate_limits` table in Supabase keyed on `req.user.id`. Cap ~10 itineraries/user/hour. Protects OpenAI bill.
- [ ] **1.7** Add request size limits. Reject bodies >100 KB early in each handler (or configure at the Vercel project level).
- [ ] **1.8** Verify no secrets in git history (`git log --all -- .env`). Already clean, re-verify after any rebasing.

## Phase 2 — Refactor the giants

So future changes don't require rewriting 1,800-line files.

- [ ] **2.1** Split `MapView.tsx` (1,812 lines) into: `MapCanvas.tsx` (pure Mapbox instance), `PinLayer.tsx` (markers + clustering), `PinPopup.tsx` (React component, not HTML string), `FilterBar.tsx`, `hooks/useMapPins.ts`, `hooks/useBookmarks.ts`.
- [ ] **2.2** Enable Mapbox native clustering in `PinLayer`. Use `cluster: true` on the GeoJSON source. Map dies past ~2k pins without this.
- [ ] **2.3** Split `ItineraryModal.tsx` (1,393 lines) into: form component, preview/render component, save-to-profile flow, `useItineraryDraft` hook.
- [ ] **2.4** Split `profileModal.tsx` (1,414 lines) into tabbed subcomponents: profile info, saved itineraries list, bookmarked pins list.
- [ ] **2.5** Extract inline styles. Move to Tailwind utility classes or CSS modules. Unblocks a design refresh later.
- [ ] **2.6** Add error boundaries around each top-level feature (Map, Itinerary, Profile) so one crash doesn't blank the app.

## Phase 3 — Data + UX at scale

So the app doesn't die at 10k pins.

- [ ] **3.1** Bounding-box pin queries. `listPins()` accepts viewport bounds; fetch only pins in view plus buffer. Debounced re-fetch on pan/zoom end.
- [ ] **3.2** Server-side filtering. Move category / age / creator-type filters to SQL instead of fetching everything and filtering client-side.
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
| 1. Security | ~1 week | Yes — don't put users on the current backend |
| 2. Refactor | ~1 week | No, but everything later gets slower without it |
| 3. Scale | ~3 days | Only if you expect >1k pins at launch |
| 4. Moderation | ~1 week | Yes for public launch |
| 5. Community | 2-3 weeks | Yes if pitching "community app" |
| 6. Observability + testing | ~1 week | Yes before paid users |
| 7. Product wedge | Ongoing | Yes before fundraising |
| 8. Launch prep | ~3 days | Yes obviously |
| 9. Polish | Ongoing | No |

**Non-negotiable before any real user:** Phase 1 (all 8 steps) + Phase 4.

---

*Last updated: 2026-04-21*
