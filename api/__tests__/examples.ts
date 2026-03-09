/**
 * Quick Reference: How to Use Tests & Fixtures
 * Copy-paste examples for running tests and validating pipeline
 */

// ============================================================================
// EXAMPLE 1: Run all unit tests in a script
// ============================================================================
export const EXAMPLE_RUN_ALL_TESTS = `
import { runAllUnitTests } from '@/api/__tests__/integrationTest';

function main() {
  const summary = runAllUnitTests();
  console.log(\`\\nResults: \${summary.passed}/\${summary.total} tests passed\`);
  
  if (summary.failed > 0) {
    console.error('Failed tests:');
    summary.tests
      .filter(t => !t.passed)
      .forEach(t => console.error(\`  - \${t.name}\`));
  }
}

main();
`;

// ============================================================================
// EXAMPLE 2: Test trip context calculation for a specific sample
// ============================================================================
export const EXAMPLE_TEST_CONTEXT = `
import { computeTripContext } from '@/api/lib/tripContext';
import { SAMPLE_MEDIUM_TWO_BASES } from '@/api/__tests__/fixtures/sampleTrips';

function testContextForMediumTrip() {
  const input = SAMPLE_MEDIUM_TWO_BASES;
  const context = computeTripContext(
    input.arrivalDate,
    input.departureDate,
    input.stops
  );

  console.log('Trip Context:', {
    totalNights: context.totalNights,
    calendarDays: context.calendarDays,
    tripCategory: context.tripCategory,
    isMultiCity: context.isMultiCity,
    stopCount: context.stopCount,
  });

  // Assertions
  console.assert(context.totalNights === 8, 'Expected 8 nights');
  console.assert(context.isMultiCity === true, 'Expected multi-city');
  console.assert(context.tripCategory === 'medium', 'Expected medium category');
}

testContextForMediumTrip();
`;

// ============================================================================
// EXAMPLE 3: Validate a plan against business rules
// ============================================================================
export const EXAMPLE_VALIDATE_PLAN = `
import { validatePlanBusinessRules } from '@/api/lib/planValidator';
import { computeTripContext } from '@/api/lib/tripContext';
import { SAMPLE_SHORT_CITY_TRIP } from '@/api/__tests__/fixtures/sampleTrips';
import { ItineraryPlan } from '@/api/types/plan';

function testPlanValidation() {
  const input = SAMPLE_SHORT_CITY_TRIP;
  const context = computeTripContext(
    input.arrivalDate,
    input.departureDate,
    input.stops
  );

  // Example: good plan
  const goodPlan: ItineraryPlan = {
    isFeasible: true,
    summary: 'London 3-day exploration',
    route: [
      {
        location: 'London',
        startDay: 1,
        endDay: 3,
        nights: 2,
        reason: 'City exploration',
        highlights: ['museums', 'markets'],
      },
    ],
    transport: [],
    issues: [],
    warnings: [],
    confidence: 0.85,
  };

  const result = validatePlanBusinessRules(goodPlan, input, context);

  console.log('Validation Result:', {
    valid: result.valid,
    issues: result.issues,
    score: result.score,
  });

  console.assert(result.valid === true, 'Plan should be valid');
  console.assert(result.issues.length === 0, 'Should have no critical issues');
}

testPlanValidation();
`;

// ============================================================================
// EXAMPLE 4: Get a specific sample trip and use it
// ============================================================================
export const EXAMPLE_USE_FIXTURE = `
import { getSampleTrip, getAllSampleTrips } from '@/api/__tests__/fixtures/sampleTrips';

function exampleUsagePatterns() {
  // Get a specific sample
  const mediumTrip = getSampleTrip('MEDIUM_TWO_BASES');
  console.log('Trip name:', mediumTrip?.name);
  console.log('Expected to trigger repair:', mediumTrip?.expectedValidation.shouldTriggerRepair);

  // Get all samples for iteration
  const allTrips = getAllSampleTrips();
  allTrips.forEach(trip => {
    console.log(\`- \${trip.name}: \${trip.description}\`);
    console.log(\`  Expected valid: \${trip.expectedValidation.shouldBeValid}\`);
  });

  // Access raw input
  const input = mediumTrip?.input;
  console.log('Arrival:', input?.arrivalLocation);
  console.log('Stops requested:', input?.stops);
}

exampleUsagePatterns();
`;

// ============================================================================
// EXAMPLE 5: Manual full pipeline test
// ============================================================================
export const EXAMPLE_FULL_PIPELINE = `
import { validateAndNormalizeTripInput } from '@/api/lib/validation';
import { computeTripContext } from '@/api/lib/tripContext';
import { planItinerary } from '@/api/lib/planner';
import { renderItinerary } from '@/api/lib/renderer';
import { SAMPLE_SHORT_CITY_TRIP } from '@/api/__tests__/fixtures/sampleTrips';

async function testFullPipeline() {
  console.log('=== FULL PIPELINE TEST ===\\n');

  // 1. Validate input
  console.log('1. Validating input...');
  const validationResult = validateAndNormalizeTripInput(SAMPLE_SHORT_CITY_TRIP);
  if (!validationResult.valid) {
    console.error('✗ Validation failed:', validationResult.errors);
    return;
  }
  const input = validationResult.result!;
  console.log('✓ Input validated');

  // 2. Compute context
  console.log('\\n2. Computing context...');
  const context = computeTripContext(
    input.arrivalDate,
    input.departureDate,
    input.stops
  );
  console.log('✓ Context computed:', {
    nights: context.totalNights,
    category: context.tripCategory,
  });

  // 3. Plan itinerary
  console.log('\\n3. Planning itinerary...');
  const planResult = await planItinerary(input, context, input.userFirstName);
  if (!planResult.success) {
    console.error('✗ Planning failed:', planResult.errors);
    return;
  }
  console.log('✓ Planning succeeded:', {
    feasible: planResult.plan!.isFeasible,
    stops: planResult.plan!.route.length,
    repairAttempted: planResult.repairAttempted,
  });

  // 4. Render itinerary
  console.log('\\n4. Rendering itinerary...');
  const renderResult = await renderItinerary(
    planResult.plan!,
    input,
    context,
    input.userFirstName
  );
  if (!renderResult.success) {
    console.error('✗ Rendering failed:', renderResult.error);
    return;
  }
  console.log('✓ Rendering succeeded');
  console.log('\\n=== FINAL ITINERARY ===');
  console.log(renderResult.markdown);
}

// Run it
testFullPipeline().catch(console.error);
`;

// ============================================================================
// EXAMPLE 6: Check if a plan needs repair
// ============================================================================
export const EXAMPLE_REPAIR_TRIGGER = `
import { validatePlanBusinessRules } from '@/api/lib/planValidator';
import { computeTripContext } from '@/api/lib/tripContext';
import { SAMPLE_OVERAMBITIOUS_TRIP } from '@/api/__tests__/fixtures/sampleTrips';

function shouldRepair() {
  const input = SAMPLE_OVERAMBITIOUS_TRIP;
  const context = computeTripContext(
    input.arrivalDate,
    input.departureDate,
    input.stops
  );

  // Simulated plan from planner
  const plan = {
    isFeasible: false,
    route: [
      { location: 'Bangkok', nights: 1 },
      { location: 'Pattaya', nights: 1 },
      { location: 'Phuket', nights: 1 },
      { location: 'Krabi', nights: 1 },
      { location: 'Chiang Mai', nights: 2 },
    ],
  };

  const validation = validatePlanBusinessRules(plan as any, input, context);

  // Repair needed if:
  const needsRepair =
    plan.isFeasible === false ||
    validation.score < 60 ||
    validation.issues.some((i) => i.severity === 'error');

  console.log('Repair needed?', needsRepair);
  console.log('Reasons:');
  console.log('  - Infeasible:', plan.isFeasible === false);
  console.log('  - Low score:', validation.score < 60);
  console.log('  - Has errors:', validation.issues.some((i) => i.severity === 'error'));

  return needsRepair;
}

shouldRepair();
`;

// ============================================================================
// EXAMPLE 7: Test with environment variables (for debug logging)
// ============================================================================
export const EXAMPLE_DEBUG_MODE = `
// Set environment variables:
// DEBUG=true DEBUG_VERBOSE=false npm run dev

// In your code:
import { initializeDebugConfig, isDebugEnabled } from '@/api/lib/debug';

// Initialize (usually done in endpoint startup)
initializeDebugConfig(process.env);

// Now all debug logging is controlled by env vars
if (isDebugEnabled()) {
  console.log('[DEBUG] Pipeline started');
}

// Run pipeline - all debug logging will respect environment settings
// DEBUG=true  → Shows debug logs (stats and summaries)
// DEBUG_VERBOSE=true → Shows full prompts/responses
// DEBUG=false → No debug logs, zero overhead (production)
`;

// ============================================================================
// EXAMPLE 8: Create a test report
// ============================================================================
export const EXAMPLE_TEST_REPORT = `
import {
  runAllTripContextTests,
  runAllValidationTests,
} from '@/api/__tests__';
import {
  formatTestSummary,
  mergeSummaries,
} from '@/api/__tests__/testUtils';

function generateTestReport() {
  console.log('\\n' + '='.repeat(70));
  console.log('TEST REPORT');
  console.log('='.repeat(70) + '\\n');

  // Run tests
  const contextTests = runAllTripContextTests();
  const validationTests = runAllValidationTests();

  // Print summaries
  console.log(formatTestSummary(contextTests, false));
  console.log(formatTestSummary(validationTests, false));

  // Merge for total
  const allTests = mergeSummaries(
    [contextTests, validationTests],
    'Complete Test Suite'
  );
  console.log(formatTestSummary(allTests, false));

  // Summary
  const passRate = Math.round(
    (allTests.passed / allTests.total) * 100
  );
  console.log(\`\\nPass Rate: \${passRate}%\`);

  if (allTests.failed === 0) {
    console.log('\\n✓ All tests passed!');
  } else {
    console.log(\`\\n✗ \${allTests.failed} test(s) failed\`);
  }
}

generateTestReport();
`;

// ============================================================================
// EXAMPLE 9: Access test metadata and guidance
// ============================================================================
export const EXAMPLE_TEST_METADATA = `
import { getAllSampleTrips } from '@/api/__tests__/fixtures/sampleTrips';

function printTestGuidance() {
  const samples = getAllSampleTrips();

  samples.forEach((sample) => {
    console.log(\`\\n=== \${sample.name} ===\`);
    console.log(sample.description);
    console.log('\\nExpected Validation:');
    console.log(\`  - Should be valid: \${sample.expectedValidation.shouldBeValid}\`);
    console.log(\`  - Stops: \${sample.expectedValidation.expectedMinStops}-\${sample.expectedValidation.expectedMaxStops}\`);
    console.log(\`  - Nights: \${sample.expectedValidation.expectedTotalNights}\`);
    console.log(\`  - Should trigger repair: \${sample.expectedValidation.shouldTriggerRepair}\`);
    console.log('\\nVerification Guidance:');
    console.log(sample.assertionGuidance);
  });
}

printTestGuidance();
`;

// ============================================================================
// EXAMPLE 10: Performance test - measure pipeline timing
// ============================================================================
export const EXAMPLE_PERFORMANCE_TEST = `
import { validateAndNormalizeTripInput } from '@/api/lib/validation';
import { computeTripContext } from '@/api/lib/tripContext';
import { planItinerary } from '@/api/lib/planner';
import { renderItinerary } from '@/api/lib/renderer';
import { getAllSampleTrips } from '@/api/__tests__/fixtures/sampleTrips';

async function measurePerformance() {
  console.log('Performance Test Results\\n');

  const samples = getAllSampleTrips();

  for (const sample of samples) {
    const startTime = Date.now();

    // Full pipeline
    const validationResult = validateAndNormalizeTripInput(sample.input);
    if (!validationResult.valid) continue;

    const context = computeTripContext(
      sample.input.arrivalDate,
      sample.input.departureDate,
      sample.input.stops
    );

    const planResult = await planItinerary(
      validationResult.result!,
      context,
      sample.input.userFirstName
    );
    if (!planResult.success) continue;

    const renderResult = await renderItinerary(
      planResult.plan!,
      validationResult.result!,
      context,
      sample.input.userFirstName
    );

    const duration = Date.now() - startTime;

    console.log(\`\${sample.name}: \${duration}ms\`);
  }
}

measurePerformance().catch(console.error);
`;

// ============================================================================
// Export all examples
// ============================================================================
export const ALL_EXAMPLES = {
  EXAMPLE_RUN_ALL_TESTS,
  EXAMPLE_TEST_CONTEXT,
  EXAMPLE_VALIDATE_PLAN,
  EXAMPLE_USE_FIXTURE,
  EXAMPLE_FULL_PIPELINE,
  EXAMPLE_REPAIR_TRIGGER,
  EXAMPLE_DEBUG_MODE,
  EXAMPLE_TEST_REPORT,
  EXAMPLE_TEST_METADATA,
  EXAMPLE_PERFORMANCE_TEST,
};

/**
 * Print all examples
 */
export function printAllExamples() {
  Object.entries(ALL_EXAMPLES).forEach(([name, code]) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${name}`);
    console.log('='.repeat(80));
    console.log(code);
  });
}
