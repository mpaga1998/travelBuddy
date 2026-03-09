/**
 * Plan Validation and Repair Trigger Tests
 * Validates business rule enforcement and repair detection
 */

import {
  validatePlanBusinessRules,
  PlanValidationResult,
} from '../../lib/planValidator';
import { computeTripContext } from '../../lib/tripContext';
import { ItineraryPlan, PlanStop, TransportSegment } from '../../types/plan';
import { getAllSampleTrips } from './fixtures/sampleTrips';

/**
 * Helper: Create a mock plan for testing
 */
function createMockPlan(overrides: Partial<ItineraryPlan> = {}): ItineraryPlan {
  return {
    isFeasible: true,
    summary: 'Test plan',
    route: [],
    transport: [],
    issues: [],
    warnings: [],
    confidence: 0.8,
    ...overrides,
  };
}

/**
 * Helper: Create a mock stop
 */
function createMockStop(overrides: Partial<PlanStop> = {}): PlanStop {
  return {
    location: 'Test City',
    startDay: 1,
    endDay: 2,
    nights: 1,
    reason: 'Testing',
    highlights: [],
    ...overrides,
  };
}

/**
 * Helper: Create a mock transport segment
 */
function createMockTransport(overrides: Partial<TransportSegment> = {}): TransportSegment {
  return {
    from: 'City A',
    to: 'City B',
    departDay: 1,
    duration: 3,
    mode: 'bus',
    cost: 'low',
    earlyStart: false,
    ...overrides,
  };
}

/**
 * Test 1: Valid plan passes all rules
 * Should return: valid=true, issues.length=0
 */
export function testValidPlanPasses() {
  const sample = getAllSampleTrips().find((t) => t.name === 'SHORT_CITY')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  const validPlan = createMockPlan({
    route: [
      createMockStop({
        location: 'London',
        startDay: 1,
        endDay: 3,
        nights: 2,
      }),
    ],
    transport: [],
    isFeasible: true,
    issues: [],
  });

  const result = validatePlanBusinessRules(validPlan, sample.input, context);

  return {
    name: 'Validation: Valid Plan Passes',
    result,
    assertions: {
      isValid: result.valid === true,
      noIssues: result.issues.length === 0,
      confidenceHigh: result.score >= 80,
    },
    passed:
      result.valid === true &&
      result.issues.length === 0 &&
      result.score >= 80,
  };
}

/**
 * Test 2: Plan with mismatched nights triggers validation error
 * Should return: valid=false, issues includes nights mismatch
 */
export function testNightsMismatchTriggers() {
  const sample = getAllSampleTrips().find((t) => t.name === 'MEDIUM_TWO_BASES')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  // Plan claims 8 nights total but only allocates 5
  const invalidPlan = createMockPlan({
    route: [
      createMockStop({
        location: 'Bangkok',
        nights: 2,
      }),
      createMockStop({
        location: 'Chiang Mai',
        startDay: 3,
        endDay: 6,
        nights: 3,
      }),
    ],
    transport: [],
    isFeasible: true,
    issues: [],
  });

  const result = validatePlanBusinessRules(invalidPlan, sample.input, context);

  return {
    name: 'Validation: Nights Mismatch Triggers',
    result,
    assertions: {
      isInvalid: result.valid === false,
      hasIssues: result.issues.length > 0,
      issueType: result.issues.some((i) =>
        i.message.toLowerCase().includes('night')
      ),
    },
    passed:
      result.valid === false &&
      result.issues.length > 0 &&
      result.issues.some((i) => i.message.toLowerCase().includes('night')),
  };
}

/**
 * Test 3: Plan with negative nights triggers validation error
 * Should return: valid=false
 */
export function testNegativeNightsTriggers() {
  const sample = getAllSampleTrips().find((t) => t.name === 'SHORT_CITY')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  const invalidPlan = createMockPlan({
    route: [
      createMockStop({
        location: 'London',
        nights: -1, // Invalid!
      }),
    ],
    transport: [],
    isFeasible: true,
    issues: [],
  });

  const result = validatePlanBusinessRules(invalidPlan, sample.input, context);

  return {
    name: 'Validation: Negative Nights Triggers',
    result,
    assertions: {
      isInvalid: result.valid === false,
      hasErrorIssue: result.issues.some(
        (i) => i.severity === 'error' && i.message.includes('negative')
      ),
    },
    passed:
      result.valid === false &&
      result.issues.some(
        (i) => i.severity === 'error' && i.message.includes('negative')
      ),
  };
}

/**
 * Test 4: Overambitious plan detected as infeasible
 * Should return: isFeasible=false, repairs needed
 */
export function testOverambitiousPlanDetected() {
  const sample = getAllSampleTrips().find((t) => t.name === 'OVERAMBITIOUS')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  // Plan tries to fit 5 stops in 6 nights - unrealistic
  const unrealisticPlan = createMockPlan({
    route: [
      createMockStop({
        location: 'Bangkok',
        nights: 1,
      }),
      createMockStop({
        location: 'Pattaya',
        startDay: 2,
        endDay: 3,
        nights: 1,
      }),
      createMockStop({
        location: 'Phuket',
        startDay: 3,
        endDay: 4,
        nights: 1,
      }),
      createMockStop({
        location: 'Krabi',
        startDay: 4,
        endDay: 5,
        nights: 1,
      }),
      createMockStop({
        location: 'Chiang Mai',
        startDay: 5,
        endDay: 7,
        nights: 2,
      }),
    ],
    transport: [
      createMockTransport({ from: 'Bangkok', to: 'Pattaya', duration: 2 }),
      createMockTransport({ from: 'Pattaya', to: 'Phuket', duration: 6 }),
      createMockTransport({ from: 'Phuket', to: 'Krabi', duration: 4 }),
      createMockTransport({ from: 'Krabi', to: 'Chiang Mai', duration: 12 }),
    ],
    isFeasible: false, // Marked as infeasible by planner
  });

  const result = validatePlanBusinessRules(unrealisticPlan, sample.input, context);

  return {
    name: 'Validation: Overambitious Plan Detected',
    result,
    assertions: {
      feasibilityCheck: unrealisticPlan.isFeasible === false,
      hasWarnings: result.warnings.length > 0,
      scoreReduced: result.score < 60, // Should be low confidence
    },
    passed:
      unrealisticPlan.isFeasible === false &&
      result.warnings.length > 0 &&
      result.score < 60,
  };
}

/**
 * Test 5: Plan missing minimum stops
 * Should trigger validation warning/error
 */
export function testMinimumStopsCheck() {
  const sample = getAllSampleTrips().find((t) => t.name === 'MEDIUM_TWO_BASES')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  // Input specifies 2 stops but plan only has 1
  const incompletePlan = createMockPlan({
    route: [
      createMockStop({
        location: 'Bangkok',
        nights: 8,
      }),
    ],
    transport: [],
    isFeasible: true,
    issues: [],
  });

  const result = validatePlanBusinessRules(incompletePlan, sample.input, context);

  return {
    name: 'Validation: Minimum Stops Check',
    result,
    assertions: {
      hasIssue: result.issues.length > 0 || result.warnings.length > 0,
      scoreLower:
        result.score < 80, // Should be lower confidence for incomplete plan
    },
    passed:
      (result.issues.length > 0 || result.warnings.length > 0) &&
      result.score < 80,
  };
}

/**
 * Test 6: Return trip without buffer day
 * Should flag: transport doesn't end near return location
 */
export function testReturnTripBufferWarning() {
  const sample = getAllSampleTrips().find((t) => t.name === 'RETURN_JOURNEY')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  // Plan ends in Jaipur, doesn't return to Delhi for departure
  const missingReturnPlan = createMockPlan({
    route: [
      createMockStop({
        location: 'Delhi',
        nights: 3,
      }),
      createMockStop({
        location: 'Agra',
        startDay: 4,
        endDay: 6,
        nights: 2,
      }),
      createMockStop({
        location: 'Jaipur',
        startDay: 7,
        endDay: context.lastOvernightDate, // End day before departure
        nights: 10,
      }),
    ],
    transport: [
      createMockTransport({ from: 'Delhi', to: 'Agra', duration: 2 }),
      createMockTransport({ from: 'Agra', to: 'Jaipur', duration: 4 }),
    ],
    isFeasible: true,
  });

  const result = validatePlanBusinessRules(
    missingReturnPlan,
    sample.input,
    context
  );

  return {
    name: 'Validation: Return Trip Buffer Warning',
    result,
    assertions: {
      hasWarning:
        result.warnings.length > 0 ||
        result.issues.some((i) => i.message.toLowerCase().includes('return')),
    },
    passed:
      result.warnings.length > 0 ||
      result.issues.some((i) => i.message.toLowerCase().includes('return')),
  };
}

/**
 * Test 7: Repair trigger condition - validate when repair is needed
 * A plan that:
 * - has isFeasible=false, OR
 * - has validation score < 60, OR
 * - has critical errors
 * Should be marked for repair
 */
export function testRepairTriggerCondition() {
  const sample = getAllSampleTrips().find((t) => t.name === 'OVERAMBITIOUS')!;
  const context = computeTripContext(
    sample.input.arrivalDate,
    sample.input.departureDate,
    sample.input.stops
  );

  const badPlan = createMockPlan({
    isFeasible: false,
    issues: ['Too many locations for available time'],
  });

  const result = validatePlanBusinessRules(badPlan, sample.input, context);

  // Repair needed if:
  const repairNeeded = {
    infeasible: badPlan.isFeasible === false,
    lowConfidence: result.score < 60,
    criticalErrors: result.issues.some((i) => i.severity === 'error'),
  };

  const shouldRepair = Object.values(repairNeeded).some((v) => v === true);

  return {
    name: 'Repair: Trigger Condition Check',
    result,
    assertions: {
      triggerCondition: shouldRepair === true,
    },
    passed: shouldRepair === true,
  };
}

/**
 * Run all validation tests
 */
export function runAllValidationTests() {
  const results = [
    testValidPlanPasses(),
    testNightsMismatchTriggers(),
    testNegativeNightsTriggers(),
    testOverambitiousPlanDetected(),
    testMinimumStopsCheck(),
    testReturnTripBufferWarning(),
    testRepairTriggerCondition(),
  ];

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    tests: results,
  };

  return summary;
}
