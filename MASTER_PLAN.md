# nook — Master Plan to v1.0

**Written:** 2026-07-14 · **Status at time of writing:** ~11k LOC (src + api), Parts A/B done, Part C at 90%.

This document supersedes the *sequencing* in `ROADMAP.md` and `TODO_FIXES_AND_NEW_FEATURES.md`
(both of which stay valid as item-level references). It answers three questions:

1. **What's actually left to build?** (§1)
2. **What is this product, who pays, and how does it get funded?** (§2)
3. **How do we make it look like one product instead of six?** (§3)

---

## §0. Reality check — where we actually are

The roadmap is **stale and under-reports progress**. Several items it lists as `[ ]` were
completed under different names in `TODO_FIXES_AND_NEW_FEATURES.md`:

| ROADMAP says open | Actually shipped as | Status |
|---|---|---|
| 6.1 Structured logging (pino) | A3.1 — `api/lib/log.ts` | ✅ Done |
| 8.2 Fix CORS | A2.1 — `api/lib/cors.ts` allowlist | ✅ Done |
| 8.3 Real README | A0.3 | ✅ Done |
| 8.5 Legal pages | A2.2 — `/privacy` + existing `/terms`, `/guidelines` | ✅ Done |
| 9.2 Accessibility pass | A4.4 | ✅ Done |
| 9.4 Performance (lazy routes) | A4.3 — router refactor + `React.lazy` | 🟡 Partial |
| 8.1 Deploy backend | Vercel serverless, live | ✅ Done |

**So the genuinely open items are far fewer than the roadmap implies.** After correcting for
this, exactly **four things** stand between the current build and a public launch:

1. **Seed content** (7.3) — a community map with zero pins is dead on arrival. *This is the #1 risk and it is not a code problem.*
2. **Design coherence** (9.1) — the app currently has three visual eras layered on top of each other.
3. **Unit economics** (7.4) — you cannot price, cap, or pitch without it.
4. **Mobile shell** (8.6) — a travel app used on the road, with no PWA install path.

Everything else is finishing touches. **You are closer than the roadmap says.**

### Debt found in this audit (not tracked anywhere yet)

- **4 zero-byte dead files still in the tree** — A0.1 claimed to remove these but didn't:
  `src/features/map/markers.ts`, `src/features/pins/PinDetailDrawer.tsx`,
  `src/features/pins/PinFormModal.tsx`, `src/lib/http.ts`
- **`tailwind.config.cjs` has an empty `theme.extend`** — zero design tokens. Every brand color
  is a hardcoded hex string (`#45B4B9` appears 20×, `#304D6D` 19×), living alongside three
  legacy palettes (`#0066cc`, `#2563eb`, `#ff8c00`) that predate the brand.
- **`MapView.tsx` is back to 914 lines** — Phase 2.1 cut it to ~500; the modals crept back in.
- **`pin_bookmarks` table is now orphaned** — we removed the bookmark UI but the table, its
  triggers, and `bookmark_count` on `pins` all still exist and still fire.
- **No PWA manifest / no `public/` assets** — only `vite.svg`.

---

## §1. Finalizing feature implementation

### Phase F1 — Close out Part C ✅ done

- [x] **C3.5 Itinerary → My Map.** ⭐ button next to each `mapbox:` venue link in
  `ItineraryPreview.tsx` — geocodes via `geocodeVenueDetailed` and writes `saved_places` with
  `source: 'itinerary'`. Per-venue added/busy state so repeat taps are a no-op.
- [x] **C4.2 "Plan a trip around my saved places" + count badge.** `MyPlacesTab` gained a
  "🧭 Plan a trip around my saved places" CTA (want-to-visit titles only) that closes the
  profile modal and opens `ItineraryModal` with the "places to visit" field pre-filled
  (threaded via `InitialPage` → `ProfileModal` → `ItineraryModal` → `ItineraryForm`,
  `initialAttractions` prop). Menu also shows a live "N" badge on "⭐ My Places" via a new
  `countSavedPlaces()` head-count query, mirroring the notifications unread-badge pattern.

### Phase F2 — Cleanup + debt (½ day)

- [ ] **F2.1** Delete the 4 zero-byte files. Verify `npx ts-prune` is clean.
- [ ] **F2.2** Decide the fate of `pin_bookmarks`. Recommendation: **keep the table, drop the
  UI dependency.** Write a migration that removes the `bookmark_count` trigger and column from
  `pins`, but leaves `pin_bookmarks` in place (dormant). Reason: if a "saves" social-proof
  counter ever returns, `saved_places.pin_id` can feed it — but a counter that nothing
  increments is worse than no counter.
- [ ] **F2.3** Re-split `MapView.tsx`. Extract `DraftModal`, `MyMapDraftModal`, `TipsViewer`,
  `DeleteConfirm`, and the imperative lightbox into `src/features/map/modals/`. Target <400 lines.

### Phase F3 — The optional-but-valuable (1–2 days)

- [ ] **F3.1** **B3.1 — publish an import as a public pin.** On the import-confirm step, offer
  "Also share as a public pin." One tap turns a TikTok save into community content. **This is
  the answer to the seed-content problem** (see §2) — it turns every user into a contributor
  without asking them to write anything.
- [ ] **F3.2** Place-search box in My Map mode (Mapbox geocoder). Currently a user can only add
  by tapping the map, which is imprecise for a named venue.
- [ ] **F3.3** Saved-place count badge on the profile menu ("12 places saved").

### Phase F4 — Launch-blocking gaps (2–3 days)

- [ ] **F4.1** **PWA shell.** `manifest.json`, icons (from the existing `NOOK-03.svg` mark),
  service worker for offline map-tile caching, iOS `apple-touch-icon`, install prompt.
  **Non-negotiable for a travel app** — people use this on a train with 2 bars of signal.
- [ ] **F4.2** Custom domain + HTTPS (ROADMAP 8.4).
- [ ] **F4.3** Cookie consent banner. You have a privacy policy but no consent gate, and the
  wedge is *EU backpackers* — this is a GDPR exposure, not a nice-to-have.
- [ ] **F4.4** Finish the perf pass (9.4). Lighthouse run; the obvious remaining wins are
  memoizing the Supercluster index and code-splitting `mapbox-gl` (it's ~800 KB gzipped and
  currently in the main bundle).

---

## §2. Rationale, monetization, and funding

### 2.1 What nook actually is

The wedge is already committed (ROADMAP 7.1) and it's a good one:

> **Hidden corners in Europe, shared by backpackers 18–35 who actually went there.**

But the *product* has quietly become something sharper than the original pitch, and the pitch
hasn't caught up. As of Part B + Part C, nook is:

> **The place where a traveler's scattered inspiration becomes an actual trip.**
> You see a place on TikTok → import it → it lands on your personal map → the AI plans a real
> itinerary around it → you go → you mark it visited → you pin it for the next person.

That loop — **inspiration → wishlist → plan → go → contribute** — is the product. Nobody else
closes it. Google Maps has saves but no planning and no community. TikTok has inspiration but
no map. Wanderlog has planning but no discovery. The **social-import feature (Part B) is the
genuine wedge**, not the community map, because it solves a problem every single traveler in
this demographic actually has right now: *"I saved 40 TikToks and I'll never find them again."*

**Recommendation: re-center the pitch on the import loop.** The community map is the *moat*
(it compounds); the import feature is the *hook* (it converts).

### 2.2 The seed-content problem — and why Part B solves it

Roadmap 7.3 says "manually add 100–300 pins before launch." That's correct but it's a treadmill.
The structural fix is **F3.1 (publish import as public pin)**:

- User imports a TikTok → gets a geocoded place with a caption and attribution
- One tap: "also share this"
- The community map fills itself from content users were saving *for themselves anyway*

**Do both.** Manual seed (100–300 pins across 5–8 cities: Lisbon, Porto, Barcelona, Berlin,
Prague, Split, Kraków, Naples) to prime the pump, *and* F3.1 so it compounds. Budget ~2 weeks of
manual curation, or ~€500–1,500 to pay 2–3 travel micro-creators for a curated set each.

### 2.3 Monetization

Free forever: browsing, pinning, personal map, community. **You never charge for the thing that
creates the moat.** The AI is what costs money and it's what you gate.

| Tier | Price | What you get | Why it converts |
|---|---|---|---|
| **Free** | €0 | Unlimited map, pins, saved places, **3 AI itineraries/month**, 20 social imports/month | The free tier must be genuinely useful or the map never fills |
| **nook+** | **€4.99/mo** or **€39/yr** | Unlimited AI itineraries, unlimited imports, offline map download, no ads, "visited" travel-log export | Priced under a single hostel night — trivially justifiable mid-trip |
| **Hostels / partners** | **€29–99/mo** | Verified hostel account, pinned recommendations, profile page, analytics on how many travelers saved their pins | This is the real revenue. Hostels already pay for Booking.com placement |

**Why this shape:**
- The AI is the only variable cost, so it's the only thing metered.
- €4.99 is an *impulse* price for someone about to spend €800 on a trip. €9.99 requires a decision.
- **Hostels are the actual business.** 300 paying hostels at €49/mo = €176k ARR, and they'll pay
  because you can prove traveler intent (saves, "want to visit" counts) in a way Booking can't.
  Consumer subs are the credibility layer that makes the B2B pitch real.

**What NOT to do:** ads (kills the aesthetic and the trust), commission on bookings (regulatory
mess, and you'd be competing with Booking on their turf), selling user location data (obviously).

### 2.4 Unit economics (ROADMAP 7.4) — the method

Do this **before** you set the free-tier cap. Fill this table from real Vercel + OpenAI logs
after 2 weeks of beta traffic — **don't guess it, measure it**:

| Metric | How to get it | Target |
|---|---|---|
| Tokens per itinerary (in/out) | Log `usage` from the OpenAI response in `api/lib/llm.ts` | — |
| € per itinerary | tokens × current model rate | **< €0.05** |
| Itineraries per active user per month | PostHog `itinerary_generated` ÷ MAU | — |
| € per active user per month | above two, multiplied | **< €0.20** |
| Free-tier cap | Set so the median free user costs **< €0.10/mo** | 3/month |
| Gross margin on nook+ | (4.99 − cost) ÷ 4.99 | **> 90%** |

You already have the instrumentation for this (`api/lib/log.ts` + PostHog + the itinerary cache
from A4.2). **Add one thing:** log token `usage` per call. That's a 3-line change and it's the
difference between a pitch deck with a number and one with a shrug.

Note the **itinerary cache (A4.2) is a direct margin lever** — every cache hit is a free
itinerary. Track hit rate; if it's >30%, say so in the deck.

### 2.5 Funding / shipping path

You have three realistic routes. **They are not mutually exclusive and they should be pursued in this order:**

**Route A — Ship it, get 1,000 users, then decide (recommended).**
Launch is cheap. Your infra is Vercel + Supabase free/hobby tiers; the only real cost is OpenAI
and you've already capped it. **You do not need money to launch this.** Get to 1,000 signups and
50 paying users and you'll have a *fundamentally* different conversation with everyone in Route B/C.

- Go-to-market: TikTok/IG Reels showing the import feature (*"I saved 40 travel TikToks and turned
  them into an actual trip in 30 seconds"*). The product **is** the ad. Post to r/solotravel,
  r/backpacking, Hostelworld forums, and Erasmus/university Facebook groups.
- Target: **1,000 signups, 100 nook+ subs, 10 hostels in 6 months.**

**Route B — Non-dilutive first.** You're EU-based (Italy). Before selling equity, take free money:
- **EU / Italian startup grants** — *Smart&Start Italia* (Invitalia) is a direct fit: 0%-interest
  loans up to €1.5M for innovative startups. Requires an *impresa innovativa* registration.
- **EIC Accelerator** — harder, longer, but designed for exactly this stage.
- Regional (Lombardia/Lazio etc.) digital-innovation vouchers.
- **Accelerators:** Techstars, Entrepreneur First, Antler (Milan). Antler in particular funds
  pre-traction solo founders.

**Route C — Angels / pre-seed.** Only with Route A traction. The pitch is not "a travel app" —
that's a graveyard. The pitch is:

> *"Gen-Z plans trips from TikTok saves. We're the layer that turns that chaos into an
> itinerary — and every trip planned makes our map better. 12k places, 40% imported by users,
> €X ARR from hostels who can finally see intent before a booking."*

**Reality check on VC:** consumer travel is a hard raise (seasonal, low frequency, Booking/Google
own distribution). The *hostel SaaS* angle is far more fundable than the consumer app. If you go
this route, lead with B2B and treat the consumer app as the customer-acquisition engine.

### 2.6 Things to decide before any of this

- [ ] **Register the entity.** You need one for grants, App Store, and taking payments.
- [ ] **Pick a payment provider.** Stripe. Not a real decision, just do it.
- [ ] **Trademark "nook".** It's a common word — check EUIPO before you print anything.
- [ ] **The Instagram problem.** Part B gracefully blocks IG (Meta requires Business approval).
  IG is where a huge share of this demographic saves travel content. **Apply for Meta's
  `oembed_read` permission now** — it takes weeks and it's a real product gap.

---

## §3. Fine design of the end product

### 3.1 The problem, stated plainly

The app has **three visual eras coexisting**:

1. **Legacy** — `#0066cc` blue, `#2563eb` blue, `#ff8c00` orange. In `PinPopup`, `FeedPage`,
   `BookmarkedPinsTab`, most of the itinerary flow.
2. **Brand** (`#45B4B9` teal, `#304D6D` dusk) — only in `InitialPage` and the *brand-new*
   My Map / My Places surfaces.
3. **Ad-hoc** — a dozen one-off hexes (`#b8860b`, `#e53e3e`, `#a0aec0`…) scattered as inline styles.

`tailwind.config.cjs` has an **empty `theme.extend`**. There are no tokens. There is no
component library (`src/components/` has 4 files, all primitives). Every button in this app is a
bespoke string of Tailwind utilities.

**This is the single biggest gap between "impressive prototype" and "product."** It's also the
cheapest to fix relative to its impact.

### 3.2 The plan — tokens first, components second, surfaces third

**Do not redesign screen-by-screen.** That's how you get a fourth visual era. Go bottom-up.

#### D1 — Design tokens (1 day) 🔴 do this first

Fill `tailwind.config.cjs`. Nothing else in §3 can start until this exists.

```js
theme: {
  extend: {
    colors: {
      brand:   { DEFAULT: '#45B4B9', 50:'#f0fafa', 100:'#d6f1f2', 500:'#45B4B9',
                 600:'#399599', 700:'#2d7679' },
      dusk:    { DEFAULT: '#304D6D', 700:'#263e57' },   // headings, dark text
      peach:   { DEFAULT: '#DB7F67' },                   // warm CTA / accent
      lace:    { DEFAULT: '#F5F1E3' },                   // surface / bg
      // semantic — these are what components consume:
      surface: '#FFFFFF',
      ink:     '#304D6D',
      muted:   '#8496A9',
    },
    borderRadius: { card: '16px', pill: '9999px', field: '12px' },
    boxShadow:    { card: '0 2px 8px rgba(48,77,109,0.08)',
                    modal: '0 18px 48px rgba(48,77,109,0.22)' },
    fontFamily:   { sans: ['Inter', 'system-ui', 'sans-serif'] },
  }
}
```

Then: **ban raw hex in `src/`.** Add an ESLint rule or a CI grep that fails on
`#[0-9a-fA-F]{6}` outside `tailwind.config.cjs` and the map GL expressions (Mapbox needs
literal hex — allowlist `PinLayer.tsx`).

#### D2 — Component library (2–3 days)

Build `src/components/ui/`. **Do not install shadcn** — it's Radix-based and assumes a router +
CSS-var setup you don't have; the integration cost exceeds the benefit at your size. Hand-roll
these seven, each ~40 lines:

| Component | Replaces | Variants |
|---|---|---|
| `Button` | ~30 bespoke button class-strings | `primary` (brand) · `secondary` (outline) · `ghost` · `danger` · sizes `sm/md/lg` |
| `Card` | The 4 different card layouts in feed/profile/places | — |
| `Modal` | 6 hand-rolled dialogs (each re-implements Escape + backdrop + focus) | `sheet` (mobile bottom) · `center` (desktop) |
| `Input` / `Textarea` / `Select` | `draftInputClass` + 5 other one-offs | — |
| `Pill` | Category chips, filter pills, badges | `filter` · `badge` · `count` |
| `EmptyState` | 6 separately-styled empty states | — |
| `Avatar` | 3 implementations | `sm/md/lg` |

**The `Modal` one is load-bearing.** You currently have six dialogs that each independently
implement `role="dialog"`, Escape handling, backdrop click, and focus management — that's six
places for an a11y regression, and A4.4 had to touch every one of them.

#### D3 — Surface migration (3–4 days, in this order)

Migrate in **order of first impression**, not order of code size:

1. **`InitialPage`** — already on-brand; audit for token compliance only.
2. **`MapView` + `PinPopup` + `FilterBar`** — *the product*. This is where users spend 90% of
   their time and it's still legacy blue. **Highest impact.**
3. **`ItineraryForm` / `ItineraryPreview`** — the paid feature. It should feel *expensive*.
4. **`profileModal` + tabs** — mostly private surface, lower stakes.
5. **`FeedPage` / `NotificationsPage`** — lowest traffic, do last.

#### D4 — The design decisions that actually matter

Beyond tokens, four choices define whether this looks like a product or a project:

- **Map style.** You're on `outdoors-v12`. A custom Mapbox Studio style in the nook palette
  (muted lace/sage land, teal water, de-emphasized roads) is **one afternoon of work and it
  changes everything** — the map is 90% of your pixels. This is the single highest
  visual-ROI item in this entire document.
- **The pin.** Currently a colored circle + emoji, rendered to canvas. It's functional and
  slightly generic. A custom teardrop/nook mark (you already have `NOOK-03.svg`) with the
  category emoji inside would be instantly recognizable — and it's the thing that shows up in
  every screenshot anyone ever shares of your app.
- **Typography.** No font is set — you're on system-ui. Pick one (Inter, or something with more
  character: *General Sans*, *Cabinet Grotesk*) and set a type scale. Free, huge impact.
- **Motion.** There is essentially none. A few well-chosen transitions (pin drop, popup rise,
  map fly-to easing) are what separates "web app" from "app." Budget half a day.

#### D5 — Figma sync

You have a brand file (`Bvp5Ppd3fKcus468kSHTpM`) with colors + logos, but no component library
and no screen designs. Once D1/D2 land in code, **push them back into Figma** as a library so
design and code share one source of truth. The Figma MCP tooling in this workspace can generate
the library from the code — do it *after* D2, not before, or you'll design components you then
have to re-implement.

---

## §4. Recommended sequence

Nine to eleven weeks, solo, at a sustainable pace.

| # | Block | Effort | Why here |
|---|---|---|---|
| **1** | **D1 — design tokens** | 1 day | Blocks all design work. Do it first, it's cheap. |
| **2** | **F1 — finish Part C** (C3.5, C4.2) | ½ day | Closes the core loop. Almost done already. |
| **3** | **F2 — cleanup** (dead files, bookmarks, MapView split) | ½ day | Do it while the code is fresh in your head. |
| **4** | **D2 — component library** | 3 days | Unblocks every subsequent UI change. |
| **5** | **F3.1 — publish import as public pin** | 1 day | The seed-content engine. Ship before seeding. |
| **6** | **D3 — surface migration** (map first) | 4 days | The app finally looks like one product. |
| **7** | **D4 — map style + pin + type + motion** | 2 days | Highest visual ROI in the whole plan. |
| **8** | **7.3 — seed 100–300 pins** | 1–2 weeks | Can run in parallel with 6/7. Not code. |
| **9** | **7.4 — unit economics** (log token usage, measure) | ½ day + 2 wks data | Needed before pricing or pitching. |
| **10** | **F4 — PWA, domain, cookie banner, perf** | 3 days | Launch-blocking, boring, unavoidable. |
| **11** | **Stripe + nook+ tier** | 2 days | Only after 9 gives you a defensible price. |
| **12** | **Beta launch** → 100 users, iterate | — | |
| **13** | **Hostel outreach** (10 pilot partners, free) | ongoing | The actual business. Start while beta runs. |

**Critical path insight:** items 1–7 are ~11 working days and take the app from *"impressive
prototype"* to *"thing you can put in front of a stranger."* Item 8 (seeding) is the long pole
and it's **not engineering** — start it in parallel the moment F3.1 ships.

---

## §5. The three things that will kill this if ignored

1. **Empty map.** A user who lands on a blank map churns in 8 seconds and never returns.
   Seed content is not polish — it is the product's cold-start survival. *(F3.1 + 7.3)*
2. **Instagram.** The demographic saves travel content on IG more than anywhere else, and the
   import feature — your actual wedge — doesn't work there. *Apply for Meta approval today;
   it takes weeks.* *(§2.6)*
3. **Three visual eras.** Nobody funds, downloads, or trusts something that looks unfinished,
   no matter how good the architecture is. *(§3)*

Everything else in this document is optimization. These three are existential.
