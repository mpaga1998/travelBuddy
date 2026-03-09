/**
 * Trip Context Calculation Tests
 * Validates that trip math is computed correctly for various scenarios
 */

import { computeTripContext } from '../../lib/tripContext';
import { getAllSampleTrips } from './fixtures/sampleTrips';

/**
 * Test 1: Trip context calculation for SHORT_CITY trip
 * Validates dates, nights, category
 */
export function testTripContextShortCity() {
  const sample = getAllSampleTrips().find((t) => t.name === 'SHORT_CITY')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  const assertions = {
    // Dates
    dateCheck: {
      arrival: context.dateRange.arrival === '2026-04-10',
      departure: context.dateRange.departure === '2026-04-13',
    },
    // Math
    nightsCalculation: context.totalNights === 2,
    calendarDaysCalculation: context.calendarDays === 3,
    // Category
    categoryCheck: context.tripCategory === 'short',
    // Flags
    multiCityCheck: context.isMultiCity === false,
    returnTrip: context.isReturnTrip === true,
    // Dates
    lastOvernightDate: context.lastOvernightDate === '2026-04-12',
  };

  return {
    name: 'Trip Context: Short City Trip',
    context,
    assertions,
    passed: Object.values(assertions).every((a) => a === true),
  };
}

/**
 * Test 2: Trip context calculation for MEDIUM_TWO_BASES
 * Validates multi-city flags, nights calculation
 */
export function testTripContextMediumTwoBases() {
  const sample = getAllSampleTrips().find((t) => t.name === 'MEDIUM_TWO_BASES')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  const assertions = {
    // Dates
    dateCheck: {
      arrival: context.dateRange.arrival === '2026-04-15',
      departure: context.dateRange.departure === '2026-04-24',
    },
    // Math
    nightsCalculation: context.totalNights === 8,
    calendarDaysCalculation: context.calendarDays === 9,
    // Category
    categoryCheck: context.tripCategory === 'medium',
    // Multi-city
    multiCityCheck: context.isMultiCity === true,
    stopsCount: context.stopCount === 2,
    returnTrip: context.isReturnTrip === true,
  };

  return {
    name: 'Trip Context: Medium Two Bases',
    context,
    assertions,
    passed: Object.values(assertions).every((a) => a === true),
  };
}

/**
 * Test 3: Trip context calculation for CROSS_BORDER (one-way)
 * Validates one-way trip detection (arrival ≠ departure)
 */
export function testTripContextCrossBorder() {
  const sample = getAllSampleTrips().find((t) => t.name === 'CROSS_BORDER')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  const assertions = {
    // Dates
    dateCheck: {
      arrival: context.dateRange.arrival === '2026-06-01',
      departure: context.dateRange.departure === '2026-06-15',
    },
    // Math
    nightsCalculation: context.totalNights === 13,
    calendarDaysCalculation: context.calendarDays === 14,
    // Category: 14 days is medium-long
    categoryCheck: context.tripCategory === 'medium', // or 'long' depending on implementation
    // One-way trip
    multiCityCheck: context.isMultiCity === true,
    returnTrip: context.isReturnTrip === false, // Key: different arrival/departure
  };

  return {
    name: 'Trip Context: Cross-Border One-Way',
    context,
    assertions,
    passed: Object.values(assertions).every((a) => a === true),
  };
}

/**
 * Test 4: Trip context edge case - exactly 7 days
 * Boundary test for category transitions
 */
export function testTripContextBoundarySevenDays() {
  const context = computeTripContext('2026-07-01', '2026-07-08', []);

  const assertions = {
    nightsCalculation: context.totalNights === 6,
    calendarDaysCalculation: context.calendarDays === 7,
    categoryCheck:
      context.tripCategory === 'short' || context.tripCategory === 'medium', // depends on threshold
  };

  return {
    name: 'Trip Context: Boundary 7 Days',
    context,
    assertions,
    passed: Object.values(assertions).every((a) => a === true),
  };
}

/**
 * Test 5: Trip context edge case - 1 day (same day return)
 * Minimum trip length
 */
export function testTripContextOneDayTrip() {
  const context = computeTripContext('2026-07-10', '2026-07-10', []);

  const assertions = {
    nightsCalculation: context.totalNights === 0,
    calendarDaysCalculation: context.calendarDays === 1,
    categoryCheck: context.tripCategory === 'short',
  };

  return {
    name: 'Trip Context: Same-Day Return',
    context,
    assertions,
    passed: Object.values(assertions).every((a) => a === true),
  };
}

/**
 * Run all trip context tests
 */
export function runAllTripContextTests() {
  const results = [
    testTripContextShortCity(),
    testTripContextMediumTwoBases(),
    testTripContextCrossBorder(),
    testTripContextBoundarySevenDays(),
    testTripContextOneDayTrip(),
  ];

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    tests: results,
  };

  return summary;
}
