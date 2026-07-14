# nook — Strategy

> **What this document is:** the business rationale — what nook is, who pays, how it gets
> funded. It changes rarely. Execution lives in [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md),
> current state in [PROJECT_STATUS.md](PROJECT_STATUS.md).
>
> **Last reviewed:** 2026-07-14.

---

## 1. Thesis and wedge

**Committed wedge:** hidden corners in Europe, shared by backpackers 18–35 who actually went.

But the product has become something sharper than the original "community map" pitch, and the
pitch should follow the product:

> **nook is where a traveler's scattered inspiration becomes an actual trip.**
> See a place on TikTok → import it → it lands on your personal map → the AI plans a real
> itinerary around it → you go → you mark it visited → you pin it for the next person.

That loop — *inspiration → wishlist → plan → go → contribute* — is the product. Nobody else
closes it:

| Competitor | Has | Lacks |
|---|---|---|
| Google Maps | saves, map | planning, community, taste |
| TikTok / IG | inspiration | any map or plan ("I saved 40 TikToks and I'll never find them again") |
| Wanderlog / TripIt | planning | discovery, community |
| Hostelworld | the audience | everything outside booking |

**The social import is the hook (it converts); the community map is the moat (it compounds).**
Lead every pitch — to users, hostels, and investors — with the import loop.

## 2. The cold-start answer

A community map with zero pins is dead on arrival. Two-part answer:

1. **Structural:** "publish import as public pin" (plan item A1) turns every user into a
   contributor without asking them to write anything — the map fills itself from content
   users were saving for themselves anyway.
2. **Manual floor:** seed 100–300 quality pins across 5–8 launch cities before beta
   (plan item A2). Budget alternative: €500–1,500 to 2–3 travel micro-creators for curated
   sets.

## 3. Monetization

Free forever: browsing, pinning, personal map, community — **never charge for what creates
the moat.** The AI is the variable cost, so the AI is what's metered.

| Tier | Price | Gets | Why it converts |
|---|---|---|---|
| **Free** | €0 | Everything social + **3 AI itineraries/mo** + 20 imports/mo | Must stay genuinely useful or the map never fills |
| **nook+** | **€4.99/mo · €39/yr** | Unlimited AI + imports, offline maps, travel-log export | Impulse price for someone spending €800 on a trip |
| **Hostels** | **€29–99/mo** | Verified account, pinned recs, profile, *intent analytics* — how many travelers saved places near them | They already pay Booking for placement; nook shows intent **before** the booking |

**Hostels are the real business.** 300 hostels × €49/mo ≈ €176k ARR. Consumer subs are the
credibility layer that makes the B2B pitch real.

**Explicitly rejected:** ads (kills trust and aesthetic) · booking commissions (regulatory
mess, Booking's turf) · selling location data (obviously).

## 4. Unit economics — method

Fill from real logs during the 2-week post-beta window (plan item M-1). **Measured, not
guessed** — token logging (plan item P1) must be live from beta day one.

| Metric | Source | Target |
|---|---|---|
| Tokens per itinerary (in/out) | `usage` logged in `api/lib/llm.ts` | — |
| € per itinerary | tokens × model rate | **< €0.05** |
| Itinerary-cache hit rate | cache logs (every hit = free itinerary) | > 30% is a pitch line |
| Itineraries / active user / mo | analytics ÷ MAU | — |
| € / active user / mo | above two | **< €0.20** |
| Free-tier cap sanity | median free user cost | **< €0.10/mo** |
| nook+ gross margin | (4.99 − cost) / 4.99 | **> 90%** |
| Mapbox loads / MAU | Mapbox dashboard | free tier 50k/mo — watch past ~1k MAU |

## 5. Funding path

Three routes, pursued **in order**, not as alternatives:

**Route A — ship first (default).** Infra is near-free (Vercel + Supabase free tiers), the
only real cost is capped OpenAI. Launch needs no money. Targets: **1,000 signups · 100 nook+
subs · 10 hostels in 6 months.** Go-to-market: the product *is* the ad — short-form video of
the import flow ("40 saved TikToks → a real trip in 30 seconds") on TikTok/IG; r/solotravel,
r/backpacking, Erasmus groups, hostel common rooms in seed cities.

**Route B — non-dilutive (parallel with A).** Italian entity unlocks: *Smart&Start Italia*
(Invitalia, 0%-interest up to €1.5M, requires *impresa innovativa* — plan item X1), EIC
Accelerator, regional digital vouchers. Accelerators worth a shot pre-traction: Antler Milan
(funds solo founders), EF, Techstars.

**Route C — angels/pre-seed (only with Route A traction).** Consumer travel is a hard raise
— seasonal, low-frequency, distribution owned by Booking/Google. **Lead with the hostel-SaaS
story** and frame the consumer app as its customer-acquisition engine:

> "Gen-Z plans trips from TikTok saves. We turn that chaos into itineraries — and every trip
> makes our map better. N places, X% imported by users, €Y ARR from hostels who finally see
> intent before a booking."

## 6. Open business decisions

| Decision | Status | Where |
|---|---|---|
| Register entity (impresa innovativa) | **Do now** — blocks Stripe, grants, Meta verification | Plan X1 |
| Meta `oembed_read` application | **Do now** — weeks of external review; needs entity | Plan X2 |
| Trademark "nook" (common word — EUIPO search) | Before any branding spend | Plan X3 |
| Payment provider | Decided: Stripe (+ VAT OSS registration) | Plan M-2 |
| Free-tier caps (3 itineraries / 20 imports) | Provisional — confirm against M-1 data | Plan M-1 |
| Launch cities (Lisbon, Porto, Barcelona, Berlin, Prague, Split, Kraków, Naples) | Provisional — trim to 5 if seeding drags | Plan A2 |
