/**
 * Rubric — scoring functions for AI-generated itinerary output.
 *
 * Each check returns { pass: boolean; detail?: string }.
 * All checks are pure functions over (output: string, caseConfig: EvalCase).
 */

import type { EvalCase } from './cases.js';

export interface CheckResult {
  name: string;
  pass: boolean;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/** At least MIN_LINKS named venue links in mapbox:// format */
const MIN_MAPBOX_LINKS = 5;
export function checkMapboxLinks(output: string): CheckResult {
  const matches = output.match(/\[.+?\]\(mapbox:[^)]+\)/g) ?? [];
  const pass = matches.length >= MIN_MAPBOX_LINKS;
  return {
    name: 'hasMapboxLinks',
    pass,
    detail: pass ? `${matches.length} links found` : `Only ${matches.length} found (need ≥${MIN_MAPBOX_LINKS})`,
  };
}

/** None of the banned "postcard" words appear in the output */
const BANNED_VOCAB = [
  'iconic',
  'must-see',
  'must see',
  'world-famous',
  'world famous',
  'amazing',
  'unforgettable',
  'breathtaking',
];
export function checkNoBannedVocab(output: string): CheckResult {
  const lower = output.toLowerCase();
  const found = BANNED_VOCAB.filter((w) => lower.includes(w));
  return {
    name: 'noBannedVocab',
    pass: found.length === 0,
    detail: found.length > 0 ? `Found: ${found.join(', ')}` : undefined,
  };
}

/** At least one expected currency appears in the output */
export function checkCurrency(output: string, expected: string[]): CheckResult {
  const found = expected.filter((c) => output.includes(c));
  return {
    name: 'hasCorrectCurrency',
    pass: found.length > 0,
    detail: found.length > 0
      ? `Found: ${found.join(', ')}`
      : `None of [${expected.join(', ')}] found`,
  };
}

/** Forbidden strings don't appear (cross-contamination: no Milan / € for non-EU) */
export function checkNoForbiddenStrings(output: string, forbidden: string[]): CheckResult {
  const found = forbidden.filter((s) => output.includes(s));
  return {
    name: 'noForbiddenStrings',
    pass: found.length === 0,
    detail: found.length > 0 ? `Found: ${found.join(', ')}` : undefined,
  };
}

/** Output is long enough to be a real itinerary */
const MIN_LENGTH = 800;
export function checkMinLength(output: string): CheckResult {
  const pass = output.length >= MIN_LENGTH;
  return {
    name: 'minLength',
    pass,
    detail: `${output.length} chars (need ≥${MIN_LENGTH})`,
  };
}

/** Arrival date appears somewhere in the output */
export function checkArrivalDate(output: string, date: string): CheckResult {
  // Accept YYYY-MM-DD or localised equivalents like "10 September" / "September 10"
  const [year, month, day] = date.split('-');
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const monthName = monthNames[parseInt(month, 10) - 1];
  const dayNum = parseInt(day, 10).toString();

  const hasIso  = output.includes(date);
  const hasLong = output.includes(monthName) && output.includes(dayNum);
  const pass    = hasIso || hasLong;

  return {
    name: 'hasArrivalDate',
    pass,
    detail: pass ? `Date found` : `"${date}" (or "${dayNum} ${monthName}") not found`,
  };
}

/** At least one expected city name appears in a mapbox link */
export function checkExpectedCities(output: string, cities: string[]): CheckResult {
  const linksBlock = output.match(/\(mapbox:[^)]+\)/g)?.join(' ') ?? '';
  const found = cities.filter(
    (c) => output.includes(c) || linksBlock.toLowerCase().includes(c.toLowerCase()),
  );
  return {
    name: 'hasExpectedCities',
    pass: found.length > 0,
    detail: found.length > 0
      ? `Found: ${found.join(', ')}`
      : `None of [${cities.join(', ')}] found in output`,
  };
}

// ---------------------------------------------------------------------------
// Aggregate scorer
// ---------------------------------------------------------------------------

export function scoreOutput(output: string, evalCase: EvalCase): CheckResult[] {
  const results: CheckResult[] = [
    checkMapboxLinks(output),
    checkNoBannedVocab(output),
    checkCurrency(output, evalCase.expectedCurrencies),
    checkMinLength(output),
    checkArrivalDate(output, evalCase.input.arrival.date),
    checkExpectedCities(output, evalCase.expectedCities),
  ];

  if (evalCase.forbiddenStrings?.length) {
    results.push(checkNoForbiddenStrings(output, evalCase.forbiddenStrings));
  }

  return results;
}
