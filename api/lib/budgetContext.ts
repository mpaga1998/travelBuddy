/**
 * C3: Budget realism layer — static, zero-latency.
 *
 * Anchors the model's price expectations to reality by communicating:
 *   1. Where this country sits on a global cost-of-living scale.
 *   2. What the user's chosen budget tier actually means in local terms.
 *   3. Concrete directives to prevent classic failure modes (€10 meals in
 *      Switzerland; $80 meals in Vietnam).
 *
 * Cost indices are derived from Numbeo Cost of Living Index (relative scale,
 * 50 = global median). Updated periodically — exact values intentionally
 * rounded to avoid false precision.
 *
 * All lookups are synchronous, <1ms, no I/O.
 */

/** Cost-of-living index per ISO-2 country (1–100, 50 = global median). */
const COST_INDEX: Record<string, number> = {
  // ── Europe ──────────────────────────────────────────────────────────────
  CH: 96,  // Switzerland — most expensive in Europe
  NO: 94,  // Norway
  IS: 91,  // Iceland
  DK: 88,  // Denmark
  SE: 83,  // Sweden
  IE: 82,  // Ireland
  GB: 79,  // United Kingdom
  NL: 78,  // Netherlands
  AT: 76,  // Austria
  FI: 75,  // Finland
  BE: 74,  // Belgium
  DE: 72,  // Germany
  FR: 70,  // France
  IT: 64,  // Italy
  ES: 60,  // Spain
  PT: 52,  // Portugal
  GR: 50,  // Greece
  HR: 48,  // Croatia
  CZ: 45,  // Czech Republic
  PL: 43,  // Poland
  HU: 42,  // Hungary
  RO: 38,  // Romania
  RS: 38,  // Serbia
  BG: 35,  // Bulgaria
  TR: 32,  // Turkey
  AL: 30,  // Albania
  UA: 28,  // Ukraine

  // ── Americas ─────────────────────────────────────────────────────────────
  US: 74,  // United States
  CA: 71,  // Canada
  CR: 45,  // Costa Rica
  CL: 48,  // Chile
  BR: 40,  // Brazil
  MX: 38,  // Mexico
  CO: 30,  // Colombia
  PE: 32,  // Peru
  AR: 28,  // Argentina
  CU: 28,  // Cuba

  // ── Asia ─────────────────────────────────────────────────────────────────
  SG: 78,  // Singapore
  AE: 70,  // UAE
  IL: 75,  // Israel
  JP: 68,  // Japan
  KR: 64,  // South Korea
  SA: 55,  // Saudi Arabia
  CN: 40,  // China
  MY: 35,  // Malaysia
  JO: 42,  // Jordan
  GE: 30,  // Georgia
  AM: 28,  // Armenia
  AZ: 30,  // Azerbaijan
  KZ: 28,  // Kazakhstan
  MN: 28,  // Mongolia
  TH: 28,  // Thailand
  ID: 22,  // Indonesia
  PH: 25,  // Philippines
  LK: 22,  // Sri Lanka
  KG: 18,  // Kyrgyzstan
  UZ: 20,  // Uzbekistan
  VN: 18,  // Vietnam
  IN: 20,  // India
  NP: 18,  // Nepal

  // ── Africa ────────────────────────────────────────────────────────────────
  ZA: 35,  // South Africa
  MA: 28,  // Morocco
  GH: 28,  // Ghana
  SN: 28,  // Senegal
  KE: 28,  // Kenya
  NG: 25,  // Nigeria
  TZ: 25,  // Tanzania
  EG: 22,  // Egypt
  ET: 20,  // Ethiopia
  ML: 22,  // Mali

  // ── Oceania ────────────────────────────────────────────────────────────────
  AU: 80,  // Australia
  NZ: 77,  // New Zealand
  FJ: 48,  // Fiji
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BudgetTier = 'budget' | 'mid-range' | 'luxury';

/**
 * A named cost tier label describing the country's position globally.
 * Used to select the right calibration copy.
 */
type CostBand =
  | 'ultra_cheap'   // index < 22
  | 'cheap'         // 22–34
  | 'moderate'      // 35–49
  | 'average'       // 50–64
  | 'above_avg'     // 65–74
  | 'expensive'     // 75–84
  | 'very_expensive'; // 85+

export interface BudgetContext {
  countryName: string;
  currency: string;
  tier: BudgetTier;
  costBand: CostBand;
  calibrationNote: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCostBand(index: number): CostBand {
  if (index < 22)  return 'ultra_cheap';
  if (index < 35)  return 'cheap';
  if (index < 50)  return 'moderate';
  if (index < 65)  return 'average';
  if (index < 75)  return 'above_avg';
  if (index < 85)  return 'expensive';
  return 'very_expensive';
}

function getCostLabel(band: CostBand): string {
  switch (band) {
    case 'ultra_cheap':   return 'ultra-affordable globally';
    case 'cheap':         return 'very affordable globally';
    case 'moderate':      return 'affordable globally';
    case 'average':       return 'average cost globally';
    case 'above_avg':     return 'above-average cost globally';
    case 'expensive':     return 'expensive globally';
    case 'very_expensive':return 'one of the most expensive destinations globally';
  }
}

/**
 * Generate the calibration directive text for a given tier + cost band
 * combination. Returned as a concise multi-line string for prompt injection.
 */
function buildCalibrationNote(
  tier: BudgetTier,
  band: CostBand,
  countryName: string,
  currency: string
): string {
  const costLabel = getCostLabel(band);

  if (tier === 'budget') {
    switch (band) {
      case 'ultra_cheap':
        return (
          `${countryName} is ${costLabel}. Budget tier here is extremely affordable by any standard.\n` +
          `→ Street food and local meals should be cheap; hostels/guesthouses are very inexpensive.\n` +
          `→ Do NOT over-price meals — suggest realistic cheap-eats prices, not Western tourist-trap prices.\n` +
          `→ Budget travelers can eat very well here without splurging.`
        );
      case 'cheap':
        return (
          `${countryName} is ${costLabel}. Budget travel here is comfortable and easy.\n` +
          `→ Local meals are affordable; budget accommodation plentiful.\n` +
          `→ Suggest local-priced restaurants and guesthouses, not inflated tourist prices.`
        );
      case 'moderate':
        return (
          `${countryName} is ${costLabel}. Budget travel is doable with some care.\n` +
          `→ Mix of cheap local options and pricier tourist-facing venues — steer toward local options.\n` +
          `→ Suggest local markets, neighborhood restaurants, and budget hostels.`
        );
      case 'average':
        return (
          `${countryName} has ${costLabel}. Budget travel requires discipline.\n` +
          `→ Budget accommodation (hostels, pensions) exists but is not ultra-cheap.\n` +
          `→ Suggest budget-conscious options: set menus, lunch deals, supermarket alternatives.`
        );
      case 'above_avg':
        return (
          `${countryName} is ${costLabel}. Budget travel is challenging.\n` +
          `→ Even "cheap" meals and hostels cost significantly more than in Southern Europe or Asia.\n` +
          `→ Suggest lunch menus (cheaper than dinner), supermarkets for snacks, and dorm hostels.\n` +
          `→ Flag if an activity or restaurant is realistically out of range for budget tier.`
        );
      case 'expensive':
        return (
          `${countryName} is ${costLabel}. True budget travel is very hard here.\n` +
          `→ Budget = constrained mid-range in global terms. Dorm hostels run ${currency} 30–55+/night.\n` +
          `→ Suggest supermarkets, lunch specials, and free/low-cost activities proactively.\n` +
          `→ Never suggest sit-down restaurant dinners without noting they\'ll stretch the budget.\n` +
          `→ Realistic daily budget (accommodation + food + transport): ${currency} 70–120.`
        );
      case 'very_expensive':
        return (
          `${countryName} is ${costLabel}. "Budget" here equals mid-range spending almost everywhere else.\n` +
          `→ Do NOT suggest any restaurant where a main course costs under ${currency} 15 — they barely exist.\n` +
          `→ Hostel dorms: ${currency} 40–70/night. Budget hotels: ${currency} 80–130/night.\n` +
          `→ Proactively suggest supermarkets, picnic lunches, and free attractions to offset meal costs.\n` +
          `→ Realistic daily budget (accommodation + food + transport): ${currency} 100–160.`
        );
    }
  }

  if (tier === 'mid-range') {
    switch (band) {
      case 'ultra_cheap':
        return (
          `${countryName} is ${costLabel}. Mid-range here unlocks excellent comfort for very little.\n` +
          `→ Mid-range restaurants offer full meals for prices that feel budget in Europe/N.America.\n` +
          `→ Boutique guesthouses and 3-star hotels are very accessible. Don\'t undersell the options.`
        );
      case 'cheap':
        return (
          `${countryName} is ${costLabel}. Mid-range travelers can eat and stay very well.\n` +
          `→ Suggest comfortable 3-star hotels and sit-down restaurants without guilt.\n` +
          `→ Premium local food experiences (tasting menus, cooking classes) are accessible at mid-range prices.`
        );
      case 'moderate':
        return (
          `${countryName} is ${costLabel}. Mid-range is the sweet spot here.\n` +
          `→ Comfortable 3-star accommodation and good sit-down restaurants fit this tier well.\n` +
          `→ Some premium experiences are accessible; avoid 5-star unless noted as an upgrade.`
        );
      case 'average':
        return (
          `${countryName} has ${costLabel} costs. Mid-range is standard here.\n` +
          `→ Suggest 3-star hotels and mid-tier restaurants — this is straightforward mid-range territory.\n` +
          `→ Fine dining occasionally fits; avoid assuming it\'s the norm.`
        );
      case 'above_avg':
        return (
          `${countryName} is ${costLabel}. Mid-range requires a bit of selectivity.\n` +
          `→ Good 3-star hotels and bistros fit; premium restaurants should be flagged as splurges.\n` +
          `→ Suggest value lunch menus over evening dining where possible.`
        );
      case 'expensive':
        return (
          `${countryName} is ${costLabel}. Mid-range here skews toward upper-mid globally.\n` +
          `→ 3-star hotels are comfortable but not cheap. Avoid suggesting luxury properties as "standard".\n` +
          `→ Restaurant meals at mid-range sit-down spots: ${currency} 20–45/person.\n` +
          `→ Suggest value options (lunch menus, neighborhood bistros) as the default.`
        );
      case 'very_expensive':
        return (
          `${countryName} is ${costLabel}. Mid-range here = upper-mid or light luxury elsewhere.\n` +
          `→ Budget for ${currency} 60–120+ for hotel rooms, ${currency} 30–70 for dinner.\n` +
          `→ Suggest reliable 3–4 star properties and established mid-range restaurants.\n` +
          `→ Proactively note where value lunches (set menus) dramatically reduce daily costs.`
        );
    }
  }

  if (tier === 'luxury') {
    switch (band) {
      case 'ultra_cheap':
        return (
          `${countryName} is ${costLabel}. Luxury here is globally affordable — don\'t undersell it.\n` +
          `→ 5-star hotels and fine dining cost a fraction of what they would in Europe or North America.\n` +
          `→ Be generous with premium recommendations — private tours, tasting menus, resort stays are all accessible.\n` +
          `→ True luxury experiences in ${countryName} can be had at prices Western travelers expect for mid-range.`
        );
      case 'cheap':
        return (
          `${countryName} is ${costLabel}. Luxury is very accessible and exceptional value.\n` +
          `→ 5-star properties and premium restaurants are available and relatively affordable.\n` +
          `→ Suggest private guides, spa treatments, and premium dining confidently.`
        );
      case 'moderate':
        return (
          `${countryName} is ${costLabel}. Luxury is accessible with strong value for money.\n` +
          `→ 4–5 star hotels and fine dining are available without the price tags of Western Europe.\n` +
          `→ Suggest premium options — private transfers, wine experiences, spa stays — with confidence.`
        );
      case 'average':
        return (
          `${countryName} has ${costLabel} costs. Luxury is standard premium pricing.\n` +
          `→ 4–5 star hotels and tasting-menu restaurants fit this tier comfortably.\n` +
          `→ Suggest premium options without hesitation.`
        );
      case 'above_avg':
        return (
          `${countryName} is ${costLabel}. Luxury commands premium prices here.\n` +
          `→ 5-star hotels are genuinely expensive; fine dining carries substantial price tags.\n` +
          `→ Suggest premium experiences with appropriate price anchors so the traveler isn\'t surprised.`
        );
      case 'expensive':
        return (
          `${countryName} is ${costLabel}. Luxury is expensive by any measure.\n` +
          `→ 5-star properties: ${currency} 250–600+/night. Fine dining: ${currency} 80–200+/person.\n` +
          `→ Be specific about price ranges so expectations are set correctly.`
        );
      case 'very_expensive':
        return (
          `${countryName} is ${costLabel}. Luxury here is top-tier globally — price accordingly.\n` +
          `→ 5-star hotels: ${currency} 400–1,000+/night. Tasting menus: ${currency} 150–400+/person.\n` +
          `→ Suggest premium experiences confidently — the traveler chose luxury in one of the world\'s most expensive countries.\n` +
          `→ Flag any \'value\' options as genuinely notable finds, not the baseline.`
        );
    }
  }

  // Fallback (TypeScript exhaustiveness — should never reach here)
  return '';
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

/**
 * Build a BudgetContext for the given country and trip inputs.
 * Returns undefined if the country is not in the cost index.
 */
export function buildBudgetContext(
  countryIso2?: string,
  countryName?: string,
  tier?: BudgetTier,
  currency?: string
): BudgetContext | undefined {
  if (!countryIso2 || !tier || !currency) return undefined;
  const index = COST_INDEX[countryIso2.toUpperCase()];
  if (index === undefined) return undefined;

  const costBand = getCostBand(index);
  const name = countryName ?? countryIso2;
  const calibrationNote = buildCalibrationNote(tier, costBand, name, currency);

  return { countryName: name, currency, tier, costBand, calibrationNote };
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

/** Format the budget context as a prompt-ready block. */
export function renderBudgetContext(ctx: BudgetContext): string {
  const tierLabel =
    ctx.tier === 'budget' ? '🟨 BUDGET'
    : ctx.tier === 'luxury' ? '🟦 LUXURY'
    : '🟩 MID-RANGE';
  return (
    `**💰 BUDGET CALIBRATION — ${ctx.countryName} (${tierLabel} tier):**\n` +
    `${ctx.calibrationNote}\n`
  );
}
