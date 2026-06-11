/**
 * Eval fixtures — 25 TripInput cases covering the full matrix:
 *   - Geography: EU, non-EU, Central Asia, SE Asia, Americas, Africa
 *   - Duration:  1 night, 3 nights, 5 nights, 7 nights, 14 nights
 *   - Budget:    budget, mid-range, luxury
 *   - Pace:      relaxed, moderate, active
 *   - TripType:  all 6 types + undefined
 *   - Extras:    stops, desiredAttractions, notes, interests
 */

import type { TripInput } from '../../api/lib/types.js';

export interface EvalCase {
  id: string;
  description: string;
  input: TripInput;
  /** Currency code(s) that MUST appear in the output */
  expectedCurrencies: string[];
  /** City names that must appear in mapbox links */
  expectedCities: string[];
  /** Strings that must NOT appear (cross-contamination guard) */
  forbiddenStrings?: string[];
}

export const EVAL_CASES: EvalCase[] = [
  // ── EU CITY BREAKS ───────────────────────────────────────────────────────

  {
    id: 'eu-rome-3n-budget',
    description: 'Rome 3 nights, budget backpacker',
    input: {
      arrival:   { date: '2026-09-10', location: 'Rome, Italy',   time: 'afternoon' },
      departure: { date: '2026-09-13', location: 'Rome, Italy',   time: 'morning' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'solo_wanderer',
      interests: ['History', 'Street food'],
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Rome'],
  },

  {
    id: 'eu-barcelona-5n-midrange',
    description: 'Barcelona 5 nights, mid-range',
    input: {
      arrival:   { date: '2026-07-01', location: 'Barcelona, Spain', time: 'morning' },
      departure: { date: '2026-07-06', location: 'Barcelona, Spain', time: 'afternoon' },
      budget: 'mid-range',
      travelPace: 'moderate',
      tripType: 'friends_budget',
      interests: ['Food', 'Nightlife', 'Architecture'],
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Barcelona'],
  },

  {
    id: 'eu-prague-2n-budget',
    description: 'Prague 2 nights, budget, hostel hop',
    input: {
      arrival:   { date: '2026-10-03', location: 'Prague, Czech Republic', time: 'night' },
      departure: { date: '2026-10-05', location: 'Prague, Czech Republic', time: 'morning' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'hostel_hop',
    },
    expectedCurrencies: ['CZK'],
    expectedCities: ['Prague'],
    forbiddenStrings: ['EUR', '€'],
  },

  {
    id: 'eu-lisbon-7n-luxury',
    description: 'Lisbon 7 nights, luxury, slow travel',
    input: {
      arrival:   { date: '2026-05-15', location: 'Lisbon, Portugal', time: 'afternoon' },
      departure: { date: '2026-05-22', location: 'Lisbon, Portugal', time: 'morning' },
      budget: 'luxury',
      travelPace: 'relaxed',
      tripType: 'slow_travel',
      interests: ['Food', 'Wine', 'Art'],
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Lisbon'],
  },

  {
    id: 'eu-berlin-4n-nightlife',
    description: 'Berlin 4 nights, nightlife focus',
    input: {
      arrival:   { date: '2026-08-20', location: 'Berlin, Germany', time: 'afternoon' },
      departure: { date: '2026-08-24', location: 'Berlin, Germany', time: 'morning' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'hostel_hop',
      interests: ['Nightlife', 'Music', 'Street art'],
      notes: 'Techno clubs, underground scene. I want specific venue names.',
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Berlin'],
  },

  {
    id: 'eu-multistop-paris-amsterdam-7n',
    description: 'Paris → Amsterdam multi-stop 7 nights',
    input: {
      arrival:   { date: '2026-06-01', location: 'Paris, France',      time: 'morning' },
      departure: { date: '2026-06-08', location: 'Amsterdam, Netherlands', time: 'afternoon' },
      stops: ['Brussels, Belgium'],
      budget: 'mid-range',
      travelPace: 'moderate',
      tripType: 'friends_budget',
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Paris', 'Amsterdam'],
  },

  {
    id: 'eu-multistop-berlin-krakow-5n',
    description: 'Berlin → Krakow 5 nights, budget',
    input: {
      arrival:   { date: '2026-04-10', location: 'Berlin, Germany',  time: 'morning' },
      departure: { date: '2026-04-15', location: 'Krakow, Poland',   time: 'afternoon' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'first_abroad',
    },
    expectedCurrencies: ['EUR', '€', 'PLN', 'zł'],
    expectedCities: ['Berlin', 'Krakow'],
  },

  {
    id: 'eu-london-3n-midrange',
    description: 'London 3 nights, mid-range',
    input: {
      arrival:   { date: '2026-11-05', location: 'London, United Kingdom', time: 'afternoon' },
      departure: { date: '2026-11-08', location: 'London, United Kingdom', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'moderate',
      interests: ['Food markets', 'Music'],
    },
    expectedCurrencies: ['GBP', '£'],
    expectedCities: ['London'],
    forbiddenStrings: ['EUR', '€'],
  },

  // ── EDGE CASES ────────────────────────────────────────────────────────────

  {
    id: 'edge-1night-vienna',
    description: '1 night only — Vienna layover',
    input: {
      arrival:   { date: '2026-09-20', location: 'Vienna, Austria', time: 'afternoon' },
      departure: { date: '2026-09-21', location: 'Vienna, Austria', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'active',
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Vienna'],
  },

  {
    id: 'edge-14night-long-trip-portugal',
    description: '14 nights — long Portugal loop',
    input: {
      arrival:   { date: '2026-07-01', location: 'Lisbon, Portugal', time: 'morning' },
      departure: { date: '2026-07-15', location: 'Porto, Portugal',  time: 'afternoon' },
      stops: ['Algarve, Portugal', 'Seville, Spain'],
      budget: 'mid-range',
      travelPace: 'relaxed',
      tripType: 'slow_travel',
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Lisbon', 'Porto'],
  },

  {
    id: 'edge-same-city-roundtrip',
    description: 'Same arrival & departure city (round trip), multi-stop',
    input: {
      arrival:   { date: '2026-08-01', location: 'Madrid, Spain', time: 'morning' },
      departure: { date: '2026-08-07', location: 'Madrid, Spain', time: 'morning' },
      stops: ['Toledo, Spain', 'Segovia, Spain'],
      budget: 'mid-range',
      travelPace: 'moderate',
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Madrid'],
  },

  {
    id: 'edge-work-exchange',
    description: 'Work exchange trip type',
    input: {
      arrival:   { date: '2026-10-01', location: 'Chiang Mai, Thailand', time: 'afternoon' },
      departure: { date: '2026-10-08', location: 'Chiang Mai, Thailand', time: 'morning' },
      budget: 'budget',
      travelPace: 'relaxed',
      tripType: 'work_exchange',
      notes: 'Working remotely, need café recommendations and coworking spots.',
    },
    expectedCurrencies: ['THB'],
    expectedCities: ['Chiang Mai'],
    forbiddenStrings: ['EUR', '€'],
  },

  // ── SE ASIA ───────────────────────────────────────────────────────────────

  {
    id: 'sea-bangkok-5n-budget',
    description: 'Bangkok 5 nights, budget',
    input: {
      arrival:   { date: '2026-12-01', location: 'Bangkok, Thailand', time: 'night' },
      departure: { date: '2026-12-06', location: 'Bangkok, Thailand', time: 'morning' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'solo_wanderer',
      interests: ['Street food', 'Temples', 'Markets'],
    },
    expectedCurrencies: ['THB'],
    expectedCities: ['Bangkok'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  {
    id: 'sea-vietnam-multistop-7n',
    description: 'Hanoi → Ho Chi Minh City 7 nights',
    input: {
      arrival:   { date: '2026-11-10', location: 'Hanoi, Vietnam',          time: 'morning' },
      departure: { date: '2026-11-17', location: 'Ho Chi Minh City, Vietnam', time: 'afternoon' },
      stops: ['Hoi An, Vietnam'],
      budget: 'budget',
      travelPace: 'moderate',
      interests: ['Food', 'History'],
    },
    expectedCurrencies: ['VND'],
    expectedCities: ['Hanoi'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  {
    id: 'sea-bali-5n-midrange',
    description: 'Bali 5 nights, mid-range',
    input: {
      arrival:   { date: '2026-09-01', location: 'Bali, Indonesia', time: 'afternoon' },
      departure: { date: '2026-09-06', location: 'Bali, Indonesia', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'relaxed',
      tripType: 'slow_travel',
      interests: ['Yoga', 'Surf', 'Food'],
    },
    expectedCurrencies: ['IDR'],
    expectedCities: ['Bali'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  // ── EAST ASIA ─────────────────────────────────────────────────────────────

  {
    id: 'asia-tokyo-7n-midrange',
    description: 'Tokyo 7 nights, mid-range',
    input: {
      arrival:   { date: '2026-04-01', location: 'Tokyo, Japan', time: 'afternoon' },
      departure: { date: '2026-04-08', location: 'Tokyo, Japan', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'active',
      interests: ['Food', 'Anime', 'Architecture'],
      desiredAttractions: ['Shimokitazawa', 'Yanaka'],
    },
    expectedCurrencies: ['JPY', '¥'],
    expectedCities: ['Tokyo'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  {
    id: 'asia-seoul-4n-budget',
    description: 'Seoul 4 nights, budget',
    input: {
      arrival:   { date: '2026-03-15', location: 'Seoul, South Korea', time: 'morning' },
      departure: { date: '2026-03-19', location: 'Seoul, South Korea', time: 'afternoon' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'solo_wanderer',
      interests: ['Street food', 'Music', 'Hiking'],
    },
    expectedCurrencies: ['KRW', '₩'],
    expectedCities: ['Seoul'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  // ── CENTRAL ASIA ──────────────────────────────────────────────────────────

  {
    id: 'central-kyrgyzstan-7n-budget',
    description: 'Bishkek → Issyk-Kul 7 nights, budget',
    input: {
      arrival:   { date: '2026-07-10', location: 'Bishkek, Kyrgyzstan', time: 'morning' },
      departure: { date: '2026-07-17', location: 'Bishkek, Kyrgyzstan', time: 'afternoon' },
      stops: ['Karakol, Kyrgyzstan'],
      budget: 'budget',
      travelPace: 'active',
      tripType: 'solo_wanderer',
      desiredAttractions: ['Issyk-Kul Lake', 'Ala Archa National Park'],
    },
    expectedCurrencies: ['KGS'],
    expectedCities: ['Bishkek'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  {
    id: 'central-tbilisi-5n-midrange',
    description: 'Tbilisi 5 nights, mid-range',
    input: {
      arrival:   { date: '2026-06-05', location: 'Tbilisi, Georgia', time: 'afternoon' },
      departure: { date: '2026-06-10', location: 'Tbilisi, Georgia', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'moderate',
      interests: ['Food', 'Wine', 'History'],
    },
    expectedCurrencies: ['GEL'],
    expectedCities: ['Tbilisi'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  // ── AFRICA & MIDDLE EAST ──────────────────────────────────────────────────

  {
    id: 'africa-marrakech-4n-midrange',
    description: 'Marrakech 4 nights, mid-range',
    input: {
      arrival:   { date: '2026-10-10', location: 'Marrakech, Morocco', time: 'afternoon' },
      departure: { date: '2026-10-14', location: 'Marrakech, Morocco', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'moderate',
      interests: ['Food', 'Markets', 'Architecture'],
    },
    expectedCurrencies: ['MAD'],
    expectedCities: ['Marrakech'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  // ── AMERICAS ──────────────────────────────────────────────────────────────

  {
    id: 'americas-mexico-city-5n-budget',
    description: 'Mexico City 5 nights, budget',
    input: {
      arrival:   { date: '2026-11-01', location: 'Mexico City, Mexico', time: 'afternoon' },
      departure: { date: '2026-11-06', location: 'Mexico City, Mexico', time: 'morning' },
      budget: 'budget',
      travelPace: 'active',
      tripType: 'solo_wanderer',
      interests: ['Food', 'Art', 'Markets'],
    },
    expectedCurrencies: ['MXN'],
    expectedCities: ['Mexico City'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  {
    id: 'americas-buenos-aires-7n-midrange',
    description: 'Buenos Aires 7 nights, mid-range',
    input: {
      arrival:   { date: '2026-03-01', location: 'Buenos Aires, Argentina', time: 'morning' },
      departure: { date: '2026-03-08', location: 'Buenos Aires, Argentina', time: 'afternoon' },
      budget: 'mid-range',
      travelPace: 'moderate',
      interests: ['Tango', 'Food', 'Nightlife'],
    },
    expectedCurrencies: ['ARS'],
    expectedCities: ['Buenos Aires'],
    forbiddenStrings: ['EUR', '€', 'Milan'],
  },

  // ── SPECIAL NOTES / ATTRACTIONS ───────────────────────────────────────────

  {
    id: 'special-attractions-override',
    description: 'User specifies attractions — must appear in output',
    input: {
      arrival:   { date: '2026-05-01', location: 'Florence, Italy', time: 'morning' },
      departure: { date: '2026-05-05', location: 'Florence, Italy', time: 'afternoon' },
      budget: 'mid-range',
      travelPace: 'moderate',
      desiredAttractions: ['Oltrarno neighbourhood', 'Fiesole day trip'],
      interests: ['Art', 'Food'],
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Florence'],
    // Oltrarno or Fiesole must appear somewhere
  },

  {
    id: 'special-first-abroad',
    description: 'First time abroad, reassuring tone expected',
    input: {
      arrival:   { date: '2026-06-20', location: 'Amsterdam, Netherlands', time: 'afternoon' },
      departure: { date: '2026-06-24', location: 'Amsterdam, Netherlands', time: 'morning' },
      budget: 'mid-range',
      travelPace: 'relaxed',
      tripType: 'first_abroad',
      notes: 'First time travelling alone. Nervous about getting around.',
    },
    expectedCurrencies: ['EUR', '€'],
    expectedCities: ['Amsterdam'],
  },
];
