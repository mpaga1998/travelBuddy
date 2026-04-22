/**
 * Destination-aware context for itinerary generation.
 *
 * Given a location string ("Bishkek, Kyrgyzstan") and trip dates, produces
 * country / currency / units / holidays / religious-period data that the
 * prompt layer injects into the model's system + user messages. Without
 * this, the model defaults to Italian examples and Euros for every trip.
 */

import Holidays from 'date-holidays';

// ISO-3166 alpha-2 -> { currency (ISO-4217), units } for the ~70 most-traveled
// countries. Lookup falls through to USD + metric if a country isn't listed,
// which is a sane global default.
const COUNTRY_META: Record<string, { currency: string; units: 'metric' | 'imperial' }> = {
  // Europe
  IT: { currency: 'EUR', units: 'metric' },
  FR: { currency: 'EUR', units: 'metric' },
  ES: { currency: 'EUR', units: 'metric' },
  DE: { currency: 'EUR', units: 'metric' },
  PT: { currency: 'EUR', units: 'metric' },
  NL: { currency: 'EUR', units: 'metric' },
  BE: { currency: 'EUR', units: 'metric' },
  AT: { currency: 'EUR', units: 'metric' },
  GR: { currency: 'EUR', units: 'metric' },
  IE: { currency: 'EUR', units: 'metric' },
  FI: { currency: 'EUR', units: 'metric' },
  HR: { currency: 'EUR', units: 'metric' },
  CZ: { currency: 'CZK', units: 'metric' },
  PL: { currency: 'PLN', units: 'metric' },
  HU: { currency: 'HUF', units: 'metric' },
  RO: { currency: 'RON', units: 'metric' },
  BG: { currency: 'BGN', units: 'metric' },
  CH: { currency: 'CHF', units: 'metric' },
  NO: { currency: 'NOK', units: 'metric' },
  SE: { currency: 'SEK', units: 'metric' },
  DK: { currency: 'DKK', units: 'metric' },
  IS: { currency: 'ISK', units: 'metric' },
  GB: { currency: 'GBP', units: 'metric' },
  AL: { currency: 'ALL', units: 'metric' },
  RS: { currency: 'RSD', units: 'metric' },
  TR: { currency: 'TRY', units: 'metric' },
  UA: { currency: 'UAH', units: 'metric' },
  // Americas
  US: { currency: 'USD', units: 'imperial' },
  CA: { currency: 'CAD', units: 'metric' },
  MX: { currency: 'MXN', units: 'metric' },
  BR: { currency: 'BRL', units: 'metric' },
  AR: { currency: 'ARS', units: 'metric' },
  CL: { currency: 'CLP', units: 'metric' },
  PE: { currency: 'PEN', units: 'metric' },
  CO: { currency: 'COP', units: 'metric' },
  CR: { currency: 'CRC', units: 'metric' },
  CU: { currency: 'CUP', units: 'metric' },
  // Asia
  JP: { currency: 'JPY', units: 'metric' },
  CN: { currency: 'CNY', units: 'metric' },
  KR: { currency: 'KRW', units: 'metric' },
  TH: { currency: 'THB', units: 'metric' },
  VN: { currency: 'VND', units: 'metric' },
  ID: { currency: 'IDR', units: 'metric' },
  MY: { currency: 'MYR', units: 'metric' },
  SG: { currency: 'SGD', units: 'metric' },
  PH: { currency: 'PHP', units: 'metric' },
  IN: { currency: 'INR', units: 'metric' },
  NP: { currency: 'NPR', units: 'metric' },
  LK: { currency: 'LKR', units: 'metric' },
  KG: { currency: 'KGS', units: 'metric' },
  KZ: { currency: 'KZT', units: 'metric' },
  UZ: { currency: 'UZS', units: 'metric' },
  GE: { currency: 'GEL', units: 'metric' },
  AM: { currency: 'AMD', units: 'metric' },
  AZ: { currency: 'AZN', units: 'metric' },
  MN: { currency: 'MNT', units: 'metric' },
  AE: { currency: 'AED', units: 'metric' },
  SA: { currency: 'SAR', units: 'metric' },
  IL: { currency: 'ILS', units: 'metric' },
  JO: { currency: 'JOD', units: 'metric' },
  // Africa
  MA: { currency: 'MAD', units: 'metric' },
  EG: { currency: 'EGP', units: 'metric' },
  ZA: { currency: 'ZAR', units: 'metric' },
  KE: { currency: 'KES', units: 'metric' },
  TZ: { currency: 'TZS', units: 'metric' },
  ET: { currency: 'ETB', units: 'metric' },
  NG: { currency: 'NGN', units: 'metric' },
  GH: { currency: 'GHS', units: 'metric' },
  ML: { currency: 'XOF', units: 'metric' },
  SN: { currency: 'XOF', units: 'metric' },
  // Oceania
  AU: { currency: 'AUD', units: 'metric' },
  NZ: { currency: 'NZD', units: 'metric' },
  FJ: { currency: 'FJD', units: 'metric' },
};

// Country name -> ISO-2 for the last comma-separated segment of a Mapbox-style
// place string. Mapbox always terminates with the country name in the user's
// display locale, so this covers the common path. Unknown country -> undefined.
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  // Europe
  Italy: 'IT', France: 'FR', Spain: 'ES', Germany: 'DE', Portugal: 'PT',
  Netherlands: 'NL', Belgium: 'BE', Austria: 'AT', Greece: 'GR', Ireland: 'IE',
  Finland: 'FI', Croatia: 'HR', 'Czech Republic': 'CZ', Czechia: 'CZ',
  Poland: 'PL', Hungary: 'HU', Romania: 'RO', Bulgaria: 'BG', Switzerland: 'CH',
  Norway: 'NO', Sweden: 'SE', Denmark: 'DK', Iceland: 'IS',
  'United Kingdom': 'GB', UK: 'GB', England: 'GB', Scotland: 'GB', Wales: 'GB',
  Albania: 'AL', Serbia: 'RS', Turkey: 'TR', Türkiye: 'TR', Ukraine: 'UA',
  // Americas
  'United States': 'US', USA: 'US', 'United States of America': 'US',
  Canada: 'CA', Mexico: 'MX', Brazil: 'BR', Argentina: 'AR', Chile: 'CL',
  Peru: 'PE', Colombia: 'CO', 'Costa Rica': 'CR', Cuba: 'CU',
  // Asia
  Japan: 'JP', China: 'CN', 'South Korea': 'KR', Korea: 'KR',
  Thailand: 'TH', Vietnam: 'VN', Indonesia: 'ID', Malaysia: 'MY',
  Singapore: 'SG', Philippines: 'PH', India: 'IN', Nepal: 'NP',
  'Sri Lanka': 'LK', Kyrgyzstan: 'KG', Kazakhstan: 'KZ', Uzbekistan: 'UZ',
  Georgia: 'GE', Armenia: 'AM', Azerbaijan: 'AZ', Mongolia: 'MN',
  'United Arab Emirates': 'AE', UAE: 'AE', 'Saudi Arabia': 'SA',
  Israel: 'IL', Jordan: 'JO',
  // Africa
  Morocco: 'MA', Egypt: 'EG', 'South Africa': 'ZA', Kenya: 'KE',
  Tanzania: 'TZ', Ethiopia: 'ET', Nigeria: 'NG', Ghana: 'GH',
  Mali: 'ML', Senegal: 'SN',
  // Oceania
  Australia: 'AU', 'New Zealand': 'NZ', Fiji: 'FJ',
};

export interface TravelContext {
  countryIso2?: string;
  countryName?: string;
  currency: string; // ISO-4217
  units: 'metric' | 'imperial';
  holidays: Array<{ date: string; name: string }>; // YYYY-MM-DD, within trip window
  religiousPeriods: Array<{ name: string; overlap: string }>; // human-readable
}

/** Parse the country from a Mapbox-style "Locality, Region, Country" string. */
function inferCountry(location: string): { iso2?: string; name?: string } {
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  // Walk from the end — the country is almost always the last segment, but
  // occasionally Mapbox appends a postal code. Try the last two segments.
  for (let i = parts.length - 1; i >= Math.max(0, parts.length - 2); i--) {
    const iso = COUNTRY_NAME_TO_ISO[parts[i]];
    if (iso) return { iso2: iso, name: parts[i] };
  }
  return {};
}

// Ramadan start/end (approximate — Saudi astronomical calendar). Covers the
// window we care about. Each year: [startYYYY-MM-DD, endYYYY-MM-DD].
const RAMADAN_WINDOWS: Record<number, [string, string]> = {
  2024: ['2024-03-11', '2024-04-09'],
  2025: ['2025-02-28', '2025-03-29'],
  2026: ['2026-02-17', '2026-03-18'],
  2027: ['2027-02-06', '2027-03-07'],
  2028: ['2028-01-27', '2028-02-24'],
  2029: ['2029-01-15', '2029-02-13'],
};

// Chinese New Year — affects travel in CN, HK, SG, MY, VN, TW, and tourist
// sites in Chinatowns globally. Just celebration day + ~1 week impact window.
const CNY_WINDOWS: Record<number, [string, string]> = {
  2024: ['2024-02-10', '2024-02-17'],
  2025: ['2025-01-29', '2025-02-04'],
  2026: ['2026-02-17', '2026-02-23'],
  2027: ['2027-02-06', '2027-02-12'],
  2028: ['2028-01-26', '2028-02-01'],
  2029: ['2029-02-13', '2029-02-19'],
};

// Country codes where Ramadan materially impacts restaurant/opening hours.
const RAMADAN_IMPACT_COUNTRIES = new Set([
  'MA', 'EG', 'SA', 'AE', 'JO', 'ML', 'SN', 'ID', 'MY', 'TR', 'KG', 'UZ', 'KZ',
]);
// Country codes where CNY materially impacts travel (closures, travel chaos).
const CNY_IMPACT_COUNTRIES = new Set(['CN', 'HK', 'SG', 'MY', 'VN', 'TW']);

function windowOverlaps(tripStart: string, tripEnd: string, win: [string, string]): boolean {
  return tripEnd >= win[0] && tripStart <= win[1];
}

/**
 * Build the full destination context for an itinerary request.
 *
 * `arrivalLocation` is used for the country lookup — if the user is doing a
 * multi-country trip via explicit stops, the prompt layer is already aware of
 * that; the primary country still sets the currency/holiday frame.
 */
export function buildTravelContext(
  arrivalLocation: string,
  startDate: string,
  endDate: string
): TravelContext {
  const { iso2, name } = inferCountry(arrivalLocation);
  const meta = iso2 ? COUNTRY_META[iso2] : undefined;

  // Public holidays via date-holidays, filtered to the trip window.
  let holidays: Array<{ date: string; name: string }> = [];
  if (iso2) {
    try {
      const hd = new Holidays(iso2);
      const startY = Number(startDate.slice(0, 4));
      const endY = Number(endDate.slice(0, 4));
      const years = startY === endY ? [startY] : [startY, endY];
      for (const y of years) {
        const list = hd.getHolidays(y) || [];
        for (const h of list) {
          const date = String(h.date).slice(0, 10); // YYYY-MM-DD
          if (date >= startDate && date <= endDate && (h.type === 'public' || h.type === 'bank')) {
            holidays.push({ date, name: h.name });
          }
        }
      }
    } catch (e) {
      console.warn('[travelContext] date-holidays failed for', iso2, e);
    }
  }

  // Religious / cultural periods with known regional impact.
  const religiousPeriods: Array<{ name: string; overlap: string }> = [];
  for (const [yStr, win] of Object.entries(RAMADAN_WINDOWS)) {
    if (windowOverlaps(startDate, endDate, win) && iso2 && RAMADAN_IMPACT_COUNTRIES.has(iso2)) {
      religiousPeriods.push({
        name: `Ramadan ${yStr}`,
        overlap: `${win[0]} to ${win[1]} — expect daytime restaurant closures, reduced hours, iftar rush at sunset`,
      });
      break;
    }
  }
  for (const [yStr, win] of Object.entries(CNY_WINDOWS)) {
    if (windowOverlaps(startDate, endDate, win) && iso2 && CNY_IMPACT_COUNTRIES.has(iso2)) {
      religiousPeriods.push({
        name: `Chinese New Year ${yStr}`,
        overlap: `${win[0]} to ${win[1]} — major closures, family travel crowds, book transport well in advance`,
      });
      break;
    }
  }

  return {
    countryIso2: iso2,
    countryName: name,
    currency: meta?.currency ?? 'USD',
    units: meta?.units ?? 'metric',
    holidays,
    religiousPeriods,
  };
}
