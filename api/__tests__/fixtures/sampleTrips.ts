/**
 * Sample Trip Fixtures for Testing
 * Representative test cases covering different trip scenarios
 */

import { NormalizedTripInput } from '../../lib/validation.js';

/**
 * Scenario 1: Short city trip in same location
 * Arrival and departure from same city, minimal travel
 * Good itinerary: 3-day exploration plan, maybe one nearby day trip
 */
export const SAMPLE_SHORT_CITY_TRIP: NormalizedTripInput = {
  arrivalLocation: 'London',
  departureLocation: 'London',
  arrivalDate: '2026-04-10',
  departureDate: '2026-04-13',
  desiredAttractions: ['museums', 'markets', 'historic sites', 'restaurants'],
  travelPace: 'moderate',
  stops: [],
  budget: 'moderate',
  notes: 'First time in London, want to see classic sights',
  userFirstName: 'Alice',
};

/**
 * Scenario 2: Medium trip with 2 realistic bases
 * 8-10 days, planned stops in 2 main cities
 * Good itinerary: balanced nights in each city, realistic transport
 * Validation should pass: total nights match, transport reasonable
 */
export const SAMPLE_MEDIUM_TWO_BASES: NormalizedTripInput = {
  arrivalLocation: 'Bangkok',
  departureLocation: 'Bangkok',
  arrivalDate: '2026-04-15',
  departureDate: '2026-04-24',
  desiredAttractions: ['temples', 'street food', 'night markets', 'beaches'],
  travelPace: 'moderate',
  stops: ['Bangkok', 'Chiang Mai'],
  budget: 'budget',
  notes: 'Mix of city culture and northern exploration',
  userFirstName: 'Bob',
};

/**
 * Scenario 3: Over-ambitious trip
 * Too many stops for the available time, unrealistic transfer times
 * Planner should mark as infeasible or require repair
 * Validation should trigger: can't fit all stops with sufficient overnight stays
 */
export const SAMPLE_OVERAMBITIOUS_TRIP: NormalizedTripInput = {
  arrivalLocation: 'Bangkok',
  departureLocation: 'Bangkok',
  arrivalDate: '2026-05-01',
  departureDate: '2026-05-08',
  desiredAttractions: ['temples', 'beaches', 'mountains', 'food', 'nightlife'],
  travelPace: 'fast',
  stops: ['Bangkok', 'Pattaya', 'Phuket', 'Krabi', 'Chiang Mai'],
  budget: 'moderate',
  notes: 'Want to see everything in one week',
  userFirstName: 'Charlie',
};

/**
 * Scenario 4: Trip requiring final return buffer
 * Arrival and departure different cities, plan must end near departure
 * Good itinerary: plan includes return travel, buffer day before departure
 * Validation: final stop should be departure location or nearby
 */
export const SAMPLE_RETURN_JOURNEY: NormalizedTripInput = {
  arrivalLocation: 'Delhi',
  departureLocation: 'Delhi',
  arrivalDate: '2026-05-10',
  departureDate: '2026-05-27',
  desiredAttractions: ['taj mahal', 'temples', 'palace', 'markets', 'forts'],
  travelPace: 'moderate',
  stops: ['Delhi', 'Agra', 'Jaipur'],
  budget: 'budget',
  notes: 'Golden Triangle classic route',
  userFirstName: 'Diana',
};

/**
 * Scenario 5: Cross-border with long transfer time
 * Multi-country, requires border crossing time and logistics
 * Good itinerary: accounts for border delays, transport time, rest day after long travel
 * Validation: transport segments realistic, scheduling sensible
 */
export const SAMPLE_CROSS_BORDER_TRIP: NormalizedTripInput = {
  arrivalLocation: 'Bangkok',
  departureLocation: 'Hanoi',
  arrivalDate: '2026-06-01',
  departureDate: '2026-06-15',
  desiredAttractions: ['temples', 'street food', 'culture', 'water features'],
  travelPace: 'moderate',
  stops: ['Bangkok', 'Chiang Mai', 'Laos', 'Hanoi'],
  budget: 'budget',
  notes: 'Thailand to Vietnam overland, open-ended',
  userFirstName: 'Eve',
};

/**
 * Test case metadata for each scenario
 */
export interface SampleTripMetadata {
  name: string;
  description: string;
  input: NormalizedTripInput;
  expectedValidation: {
    shouldBeValid: boolean;
    expectedMinStops: number;
    expectedMaxStops: number;
    expectedTotalNights: number;
    shouldTriggerRepair: boolean;
  };
  assertionGuidance: string;
}

export const SAMPLE_TRIPS: SampleTripMetadata[] = [
  {
    name: 'SHORT_CITY',
    description: 'Short 3-day city trip, same arrival/departure',
    input: SAMPLE_SHORT_CITY_TRIP,
    expectedValidation: {
      shouldBeValid: true,
      expectedMinStops: 1,
      expectedMaxStops: 2,
      expectedTotalNights: 2, // 3 calendar days = 2 nights
      shouldTriggerRepair: false,
    },
    assertionGuidance: `
      - Plan should have 1-2 locations (London optional day trip)
      - Total nights should be 2 (arrive day 1, depart day 3)
      - No complex transport needed
      - Validation should pass immediately
    `,
  },

  {
    name: 'MEDIUM_TWO_BASES',
    description: 'Medium 9-day trip with 2 bases',
    input: SAMPLE_MEDIUM_TWO_BASES,
    expectedValidation: {
      shouldBeValid: true,
      expectedMinStops: 2,
      expectedMaxStops: 2,
      expectedTotalNights: 8,
      shouldTriggerRepair: false,
    },
    assertionGuidance: `
      - Plan should include Bangkok and Chiang Mai
      - Total nights = 8 (arrive April 15, depart April 24 is 9 calendar days)
      - Each location should have 3-5 nights minimum
      - Transport: Bangkok-Chiang Mai either flight (~3h) or bus (~12h overnight)
      - Validation should pass after initial generation
    `,
  },

  {
    name: 'OVERAMBITIOUS',
    description: 'Over-ambitious: 5 stops in 7 days',
    input: SAMPLE_OVERAMBITIOUS_TRIP,
    expectedValidation: {
      shouldBeValid: false,
      expectedMinStops: 2, // should reduce
      expectedMaxStops: 3, // or simplify to 3
      expectedTotalNights: 6, // 7 calendar days = 6 nights
      shouldTriggerRepair: true, // likely needs repair or marked infeasible
    },
    assertionGuidance: `
      - Initial plan may try to include all 5 stops
      - Validation should flag: nights too short per stop
      - Repair should trigger: consolidate to 2-3 main locations
      - Final plan either: infeasible=true with suggestions, or reduced stops
      - Each location should have minimum 1-2 nights for exploration
    `,
  },

  {
    name: 'RETURN_JOURNEY',
    description: 'Indian classic route with return travel',
    input: SAMPLE_RETURN_JOURNEY,
    expectedValidation: {
      shouldBeValid: true,
      expectedMinStops: 3,
      expectedMaxStops: 3,
      expectedTotalNights: 16, // 17 calendar days = 16 nights
      shouldTriggerRepair: false,
    },
    assertionGuidance: `
      - Route: Delhi → Agra (2-3 hrs) → Jaipur (5-6 hrs) → Delhi (5-6 hrs)
      - Plan should allocate: 4-5 nights Delhi, 2-3 nights Agra, 3-4 nights Jaipur, final night back in Delhi
      - Total nights across all = 16
      - Transport: trains between cities included
      - Final stop must be Delhi (departure location reference)
      - Validation: return journey accounted for
    `,
  },

  {
    name: 'CROSS_BORDER',
    description: 'Thailand to Vietnam overland, cross-border',
    input: SAMPLE_CROSS_BORDER_TRIP,
    expectedValidation: {
      shouldBeValid: true,
      expectedMinStops: 3, // Bangkok, Chiang Mai, Hanoi minimum
      expectedMaxStops: 4, // can include one Laos stop
      expectedTotalNights: 13, // 15 calendar days = 14 nights, but 1 arrival/departure = 13
      shouldTriggerRepair: false,
    },
    assertionGuidance: `
      - Arrival: Bangkok, Departure: Hanoi (one-way: do NOT return)
      - Route: Bangkok → Chiang Mai (1-2h flight or 12h bus) → Laos (if included) → Hanoi
      - Border crossings: Thailand-Laos, Laos-Vietnam need buffer time (2-3 hours each)
      - Transport heuristics should recommend: overnight buses to save hotel nights
      - Last location before Hanoi departure: buffer day recommended
      - Plan should mark sensible feasibility (possibly tight but doable)
    `,
  },
];

/**
 * Get a sample trip by name
 */
export function getSampleTrip(name: string): SampleTripMetadata | undefined {
  return SAMPLE_TRIPS.find((t) => t.name === name);
}

/**
 * Get all sample trips
 */
export function getAllSampleTrips(): SampleTripMetadata[] {
  return SAMPLE_TRIPS;
}
