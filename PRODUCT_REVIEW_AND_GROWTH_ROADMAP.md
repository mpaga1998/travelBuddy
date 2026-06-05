# nook — Engineering & Product Review + Growth Roadmap

*Companion to `ROADMAP.md` (which covers hardening → launch). This doc adds the
honest strengths/weaknesses audit and the **Phase 10+** roadmap that takes nook
from "launch-ready" to "marketable product with a growth engine."*

---

## 1. What nook is (one paragraph)

A community travel map + AI itinerary planner for backpackers 18–35 in Europe.
Travelers drop pins on "hidden corners," and those community pins are fed as
context into a streaming OpenAI itinerary generator. The wedge — *places fellow
travelers love but tourists overlook* — is what separates nook from a generic
ChatGPT travel prompt. The community layer (profiles, follows, feed,
notifications, comments, bookmarks) and the AI layer are both already built.

**Stack:** React 18 + TypeScript + Vite · Mapbox GL (clustered) · Supabase
(auth / Postgres + RLS / storage) · OpenAI (streaming) · Vercel serverless
(`api/`) · Zustand · Tailwind · Sentry · Vercel Analytics · Playwright · Husky/CI.
~17k LOC. 38/50 of the existing hardening roadmap complete.

---

## 2. Engineering — strengths

- **Security is genuinely first-class.** JWT verification on every protected
  route, client-sent `userId` never trusted (ownership pulled from the verified
  token), service-role key isolated server-side and fails closed in prod, RLS
  policies per table, per-user rate limiting, 100 KB body caps, and an audited
  clean git history. This is well above typical MVP hygiene.
- **Cost discipline baked in.** Moderation runs *before* any paid Mapbox/weather/
  OpenAI call; `max_tokens` is sized to trip length; context fetches are
  parallelized and share geocoded coords; images are client-compressed; map reads
  use bounding-box queries + native clustering. The team clearly thinks about the
  OpenAI bill.
- **Resilience patterns are thoughtful.** Fail-open rate limiter and moderation
  (a Postgres/OpenAI hiccup never blocks a paying user), per-feature error
  boundaries, Sentry on both ends with noise filtering, and a streaming-error
  marker so a mid-stream failure degrades gracefully.
- **Clean modular architecture.** Feature-folder layout (`features/*`), the
  1,400–1,800-line "giants" were split into focused components + hooks, styles
  unified on Tailwind. Future changes won't require touching monoliths.
- **The AI context pipeline is the real IP.** `travelContext`, `placesContext`,
  `communityPins`, `weather`, `practical`, `budget` builders compose a rich,
  destination-aware prompt. This is much more than a thin GPT wrapper.
- **Solid DX/CI:** husky + lint-staged pre-commit, GitHub Actions lint/typecheck/
  e2e, Playwright smoke tiers that force accessibility-friendly selectors.

## 3. Engineering — weaknesses / risks

- **Two generation pipelines, unclear ownership.** A "text streaming" path
  (`openai.ts`, the live one) coexists with a "day-based structured" path
  (`dayBasedGeneration/Validation/Rendering`). The structured path looks
  parallel or partly dead. Pick one; delete or clearly quarantine the other.
- **Hardcoded Italy-only logic won't scale to "Europe."**
  `dayBasedValidation.ts` ships a literal `REALISTIC_TRAVEL_TIMES` matrix of
  Italian cities. The wedge is *Europe*; this needs a real routing/distance
  source (Mapbox Directions / a transit API) or it silently mis-validates
  everywhere outside Italy.
- **Model config is inconsistent / placeholder.** `openai.ts` defaults to
  `'gpt-5.4-mini'` while `.env.example` documents `gpt-3.5-turbo` / `gpt-4-turbo`.
  Nail down the real model, document it, and pin it.
- **Repo cruft.** `pinStore.ts` is empty (0 lines), `MapView.tsx.bak`, `dist/`,
  `build.log`, and `test-results/` are committed. Clean these — they confuse new
  engineers and bloat the repo.
- **No real README.** It's still the default Vite template (already flagged as
  roadmap 8.3, but worth repeating — it's the first thing an investor's technical
  diligence or a new hire sees).
- **Hand-rolled `pathname` router.** Works, but fragile: no lazy/code-split
  routes (every feature ships in the initial bundle, hurting the perf pass 9.4),
  and deep-linking/SEO are limited. A lightweight router (or TanStack/React
  Router) would unlock code-splitting *and* shareable URLs (see growth roadmap).
- **No AI quality harness.** Output quality is the product, yet there's no eval
  set, no regression testing on prompt changes, and only `describe.skip`-ed
  generation tests. A bad prompt edit can silently degrade every itinerary.
- **Observability gap.** `console.log` everywhere in `api/`; structured logging
  (6.1) still open. Hard to debug production incidents at volume.
- **Single-provider AI dependency, no caching.** One OpenAI account is a single
  point of failure and a cost risk; identical/near-identical trips regenerate
  from scratch (no itinerary cache / semantic dedupe).
- **CORS is wildcard `*`** (8.2 open) and notifications poll on window-focus
  rather than realtime — both fine for now, both flagged.
- **Thin test depth.** Smoke e2e only; no unit tests around the validation,
  budget, and context-builder logic, which is exactly where subtle bugs hide.

## 4. Product — strengths

- **A defensible wedge with a data moat.** "Community pins → AI itinerary" is a
  flywheel a pure-LLM competitor can't copy: the more travelers pin, the better
  the itineraries, the more reason to pin. This is the single best thing about
  the product.
- **The full community loop already exists.** Profiles, handles, follows, feed,
  notifications, comments, bookmarks, reports/moderation, admin dashboard — most
  "community app" pitches are vaporware here; nook has shipped it.
- **Sharp positioning.** Backpackers 18–35, "hidden corners," anti-listicle voice
  enforced down to a vocabulary blacklist in the prompt, plus trip-shape personas
  (hostel-hop, slow-travel, solo, etc.). The brand has a point of view.
- **Mobile-first effort** (iOS optimization guides) for a mobile-native audience.

## 5. Product — weaknesses / gaps

- **Cold-start is existential and unsolved.** Roadmap 7.3 (100–300 seed pins) is
  *not done*. A community map with no pins is "dead on arrival" — and the AI's
  differentiation degrades to a generic planner when there are no local pins to
  inject. This is the #1 launch blocker, above any code task.
- **No monetization model.** 7.4 (unit economics) is open. There's no payments
  infra, no free-tier cap enforced as a product surface, no pricing. You don't
  know your OpenAI cost per active user, so you can't price.
- **No acquisition engine.** Public itineraries exist in the DB but aren't
  surfaced as **shareable, SEO-indexable web pages** — the most natural organic
  growth loop for travel content is being left on the table. No referral, no
  social-share cards, no invite mechanic.
- **Thin discovery & retention.** No search, no trending/curated collections, no
  reason to return between trips (travel is inherently low-frequency). Retention
  needs a between-trips hook.
- **Single surface.** Web PWA only; the target audience lives on mobile and
  expects an app-store presence (8.6 open).
- **No north-star metric instrumented.** Analytics fire events but there's no
  defined activation/retention funnel or success metric to optimize.

---

## 6. Amplified roadmap — Phase 10+ (launch → marketable product)

> The existing `ROADMAP.md` ends at **launch readiness** (hardening, moderation,
> the community layer). Everything below assumes Phases 1–9 land. These phases
> are about **growth, money, and durability** — turning a working app into a
> business. Legend matches ROADMAP.md: `[ ]` not started · `[~]` in progress ·
> `[x]` done.

### Phase 7/8 — finish the open launch blockers first (do not skip)

- [ ] **7.3 Seed content** — 150–300 hand-curated pins across 3–5 launch cities
  (e.g. Lisbon, Berlin, Split, Budapest, Porto). This is the gating item for
  *everything* below. Recruit 5–10 "founding curators" (travel creators,
  hostel staff) and pay/comp them to pin. No flywheel without fuel.
- [ ] **7.4 Unit economics one-pager** — measure real OpenAI cost per generated
  itinerary and per active user/month; define the free-tier cap and where paid
  starts. Needed before pricing *and* before the investor deck.
- [ ] **8.2 CORS allowlist**, **8.3 real README**, **8.4 domain + HTTPS**,
  **8.5 privacy/cookie legal**, **8.6 PWA install / app-store path**.

### Phase 10 — Shareable, SEO-driven acquisition (the growth wedge)

The single highest-leverage addition. Travel is a search-and-share category.

- [ ] **10.1 Public itinerary pages.** Render each `is_public` itinerary as a
  real, crawlable URL (`/i/:slug`) with server-rendered/meta-tagged HTML, Open
  Graph + Twitter cards (auto-generated map-snapshot image). Turns every saved
  trip into an acquisition surface. *(Depends on a router refactor — see 12.2.)*
- [ ] **10.2 City landing pages.** `/explore/:city` aggregating that city's pins,
  top contributors, and "plan a trip here" CTA — SEO targets like
  "hidden gems in Lisbon." This is how you rank for high-intent travel queries.
- [ ] **10.3 Share + referral loop.** "Share this trip" with prefilled
  social copy + OG image; invite-a-friend that credits both with extra free
  generations. Instrument k-factor.
- [ ] **10.4 Sitemap + structured data** (JSON-LD `TouristAttraction`/`Itlist`)
  and basic on-page SEO so 10.1/10.2 actually index.

### Phase 11 — Monetization

- [ ] **11.1 Free-tier metering as a product surface.** Show remaining free
  itineraries; soft-gate at the cap (the rate limiter already exists server-side —
  surface it in the UI).
- [ ] **11.2 nook+ subscription.** Unlimited/priority generations, offline/export
  (PDF + calendar `.ics`), multi-city trip planning, no-cap bookmarks. Stripe via
  Vercel + Supabase `subscriptions` table; webhook to flip an entitlement flag.
- [ ] **11.3 Itinerary export & PDF** — high-value, low-cost paid feature; reuses
  the existing markdown render. Also a viral artifact (footer: "made with nook").
- [ ] **11.4 Affiliate / booking layer (later).** Hostel + transport +
  experience affiliate links inside itineraries (Hostelworld, GetYourGuide,
  Omio). Aligns with the audience and monetizes intent without charging users.
  Disclose clearly; keep recommendations honest (it's the brand promise).

### Phase 12 — AI quality & durability (protect the moat)

- [ ] **12.1 Eval harness.** A golden set of 20–30 trip inputs with rubric-scored
  expected outputs; run on every prompt/model change in CI. Catch quality
  regressions before users do.
- [ ] **12.2 Router refactor + code-splitting.** Adopt a real router; lazy-load
  feature routes (unblocks 10.1 public pages and the 9.4 perf pass).
- [ ] **12.3 Replace Italy-only travel-time matrix** with a real distance/transit
  source so multi-city validation works across Europe.
- [ ] **12.4 Itinerary cache + semantic dedupe.** Cache by normalized trip
  signature; serve near-identical requests cheaply. Directly improves unit
  economics (11) and latency.
- [ ] **12.5 Model abstraction + fallback provider.** Wrap OpenAI behind an
  interface; add a secondary provider/model for outage and cost hedging. Pin and
  document the real model; delete the dead second generation pipeline.
- [ ] **12.6 Structured logging (6.1) + request IDs** for production debuggability
  at volume.

### Phase 13 — Retention & engagement (beat travel's low frequency)

- [ ] **13.1 Trip lifecycle.** "Upcoming trip" state with countdown, pre-trip
  reminders, and a post-trip "pin what you found" prompt — closes the loop that
  feeds the moat (consumers become contributors).
- [ ] **13.2 Saved/Want-to-go lists & collections.** Curated, shareable lists
  ("Best of the Balkans") — both a retention hook and an SEO/share asset.
- [ ] **13.3 Realtime + push.** Supabase Realtime for notifications; web-push for
  follows/comments/trip reminders. Re-engagement channel you don't own yet.
- [ ] **13.4 Gamified contribution.** Lightweight contributor levels/badges for
  pins that get bookmarked — fuels supply side of the flywheel.

### Phase 14 — Mobile & scale

- [ ] **14.1 Installable PWA → native shell** (Expo/Capacitor wrapper) for
  app-store presence; the audience expects it.
- [ ] **14.2 Offline itinerary access** (backpackers lose signal) — store the
  active trip locally. Strong nook+ selling point.
- [ ] **14.3 Internationalization** of UI copy for the European audience.

### Phase 15 — Go-to-market & metrics

- [ ] **15.1 Define the north-star + activation funnel** (e.g. "weekly itineraries
  generated" or "trips with ≥1 community pin used") and instrument it end-to-end.
- [ ] **15.2 Founding-curator & hostel partnership program** — the supply-side
  GTM. Hostels get a free profile + map embed; they bring located, motivated
  pinners.
- [ ] **15.3 Creator/UGC distribution** — TikTok/IG "hidden gems in X" content
  pointing at the city landing pages (10.2). The content *is* the product.
- [ ] **15.4 Investor packet** — wedge, moat (flywheel), unit economics (7.4),
  early funnel metrics (15.1). The roadmap's discipline is itself a selling point.

---

## 7. The three things that matter most

1. **Seed the map (7.3) before anything else** — the AI's differentiation and the
   community both die without pins. This is a content/ops problem, not a code one.
2. **Build the share/SEO acquisition loop (Phase 10)** — public itinerary + city
   pages turn your existing content into your growth engine. Highest ROI feature
   work on the list, and it's a router refactor away.
3. **Close unit economics + monetization (7.4 → Phase 11)** — you can't fundraise
   or scale on an unmeasured OpenAI bill. Measure cost/user, ship metering +
   nook+, and the flywheel becomes a business.

*Everything else (eval harness, caching, realtime, mobile) protects and compounds
those three. The engineering foundation is strong enough that the remaining work
is mostly growth and product, not firefighting — which is a good place to be.*
