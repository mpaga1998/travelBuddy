/**
 * Integration Test Runner
 * Runs full pipeline tests across all sample trips
 * Can be used to validate end-to-end planning behavior
 */

import { runAllTripContextTests } from './tripContext.test.js';
import { runAllValidationTests } from './validation.test.js';
import {
  formatTestSummary,
  mergeSummaries,
  TestSummary,
} from './testUtils.js';

/**
 * Run all unit tests (context + validation)
 */
export function runAllUnitTests(): TestSummary {
  console.log('\n' + '='.repeat(60));
  console.log('Running Unit Tests');
  console.log('='.repeat(60));

  const contextResults = runAllTripContextTests();
  const validationResults = runAllValidationTests();

  // Print individual summaries
  console.log(formatTestSummary(contextResults, false));
  console.log(formatTestSummary(validationResults, false));

  // Merge summaries
  const merged = mergeSummaries(
    [contextResults, validationResults],
    'All Unit Tests'
  );

  console.log(formatTestSummary(merged, false));

  return merged;
}

/**
 * Pipeline Integration Test State
 */
export interface PipelineTestState {
  tripName: string;
  inputValidationPassed: boolean;
  contextComputationPassed: boolean;
  planningSucceeded: boolean;
  planFeasible: boolean;
  validationPassed: boolean;
  repairNeeded: boolean;
  repairSucceeded?: boolean;
  renderingSucceeded?: boolean;
  errors?: string[];
}

/**
 * Sample pipeline test configuration
 * Shows what to test for each sample trip
 */
export const PIPELINE_TEST_CONFIG = {
  SHORT_CITY: {
    name: 'Short City Trip Pipeline',
    expectedPlanningSuccess: true,
    expectedValidationPass: true,
    expectedRepairNeeded: false,
    expectedFeasible: true,
    expectedStops: 1,
    expectedMinNights: 1,
    expectedMaxNights: 2,
  },
  MEDIUM_TWO_BASES: {
    name: 'Medium Two Bases Pipeline',
    expectedPlanningSuccess: true,
    expectedValidationPass: true,
    expectedRepairNeeded: false,
    expectedFeasible: true,
    expectedStops: 2,
    expectedMinNights: 8,
    expectedMaxNights: 8,
  },
  OVERAMBITIOUS: {
    name: 'Overambitious Trip Pipeline',
    expectedPlanningSuccess: true,
    expectedValidationPass: false, // Initially invalid
    expectedRepairNeeded: true, // Repair should be triggered
    expectedFeasible: false, // Either marked infeasible or reduced
    expectedStops: 2, // Or 3 after repair
  },
  RETURN_JOURNEY: {
    name: 'Return Journey Pipeline',
    expectedPlanningSuccess: true,
    expectedValidationPass: true,
    expectedRepairNeeded: false,
    expectedFeasible: true,
    expectedStops: 3,
    expectedMinNights: 14, // Must account for return
  },
  CROSS_BORDER: {
    name: 'Cross-Border Pipeline',
    expectedPlanningSuccess: true,
    expectedValidationPass: true,
    expectedRepairNeeded: false,
    expectedFeasible: true,
    expectedStops: 3, // Min: Bangkok, Chiang Mai, Hanoi
  },
};

/**
 * Example: How to manually test the full pipeline
 * (Pseudo-code for reference - actual implementation would use real API calls)
 */
export const MANUAL_PIPELINE_TEST_EXAMPLE = `
// Step 1: Import everything needed
import { validateAndNormalizeTripInput } from '../lib/validation.js';
import { computeTripContext } from '../lib/tripContext.js';
import { planItinerary } from '../lib/planner.js';
import { renderItinerary } from '../lib/renderer.js';
import { SAMPLE_MEDIUM_TWO_BASES } from './fixtures/sampleTrips.js';

// Step 2: Run the pipeline
async function testFullPipeline() {
  // Step 1: Validate input
  const validationResult = validateAndNormalizeTripInput(SAMPLE_MEDIUM_TWO_BASES);
  if (!validationResult.valid) {
    console.error('Input validation failed:', validationResult.errors);
    return;
  }
  const normalizedInput = validationResult.result!;
  console.log('✓ Input validation passed');

  // Step 2: Compute context
  const context = computeTripContext(
    normalizedInput.arrivalDate,
    normalizedInput.departureDate,
    normalizedInput.stops
  );
  console.log('✓ Trip context computed:', {
    nights: context.totalNights,
    category: context.tripCategory,
    isMultiCity: context.isMultiCity,
  });

  // Step 3: Plan itinerary
  const planningResult = await planItinerary(
    normalizedInput,
    context,
    normalizedInput.userFirstName
  );
  if (!planningResult.success) {
    console.error('Planning failed:', planningResult.errors);
    return;
  }
  const plan = planningResult.plan!;
  console.log('✓ Planning succeeded', {
    feasible: plan.isFeasible,
    stops: plan.route.length,
    nights: plan.route.reduce((sum, s) => sum + s.nights, 0),
    repairAttempted: planningResult.repairAttempted,
  });

  // Step 4: Render itinerary
  const renderingResult = await renderItinerary(
    plan,
    normalizedInput,
    context,
    normalizedInput.userFirstName
  );
  if (!renderingResult.success) {
    console.error('Rendering failed:', renderingResult.error);
    return;
  }
  console.log('✓ Rendering succeeded');
  console.log('\\nFinal Markdown:\\n', renderingResult.markdown);
}

testFullPipeline().catch(console.error);
`;

/**
 * Test assertion helpers for pipeline expectations
 */
export const PIPELINE_ASSERTIONS = {
  /**
   * Verify planning produced a valid plan structure
   */
  validatePlanStructure: (plan: any): boolean => {
    return (
      plan &&
      typeof plan.isFeasible === 'boolean' &&
      Array.isArray(plan.route) &&
      Array.isArray(plan.transport) &&
      typeof plan.confidence === 'number'
    );
  },

  /**
   * Verify plan has expected number of stops
   */
  validateStopCount: (plan: any, expected: number): boolean => {
    return plan.route && plan.route.length === expected;
  },

  /**
   * Verify total nights in plan
   */
  validateTotalNights: (plan: any, expectedNights: number): boolean => {
    const totalNights = (plan.route || []).reduce(
      (sum: number, stop: any) => sum + (stop.nights || 0),
      0
    );
    return totalNights === expectedNights;
  },

  /**
   * Verify feasibility
   */
  validateFeasibility: (plan: any, shouldBeFeasible: boolean): boolean => {
    return plan.isFeasible === shouldBeFeasible;
  },

  /**
   * Verify confidence score
   */
  validateConfidence: (plan: any, minConfidence: number): boolean => {
    return plan.confidence >= minConfidence;
  },

  /**
   * Verify markdown output is non-empty
   */
  validateMarkdownOutput: (markdown: string): boolean => {
    return markdown && markdown.length > 0 && markdown.includes('#');
  },
};

/**
 * Checklist for manual testing
 */
export const MANUAL_TEST_CHECKLIST = `
# Manual Integration Testing Checklist

## Environment Setup
- [ ] Set DEBUG=true in .env for detailed logging
- [ ] Verify OpenAI API key is set
- [ ] Verify all dependencies installed

## Test Each Sample Trip
For each sample trip (SHORT_CITY, MEDIUM_TWO_BASES, etc.):

### Input Validation
- [ ] Input passes validation
- [ ] No validation errors logged
- [ ] Normalized input reasonable

### Context Computation
- [ ] Trip context computed
- [ ] totalNights calculated correctly
- [ ] tripCategory set appropriately
- [ ] Multi-city flags correct

### Planning
- [ ] Planning API call succeeds
- [ ] Plan structure valid (isFeasible, route, transport)
- [ ] Stop count reasonable
- [ ] Total nights matches expected
- [ ] Transport segments logical

### Validation
- [ ] Validation runs successfully
- [ ] Issues detected if plan invalid
- [ ] Confidence score reasonable

### Repair (if triggered)
- [ ] Repair attempt made if needed
- [ ] Repaired plan passes validation
- [ ] Before/after comparison logged

### Rendering
- [ ] Rendering API call succeeds
- [ ] Markdown output non-empty
- [ ] Output includes all stops
- [ ] Formatting correct

## Debug Logging Verification
- [ ] debugLogNormalizedInput shows redacted data
- [ ] debugLogTripContext shows metrics
- [ ] debugLogPlanningPromptMetadata shows prompt sizes
- [ ] debugLogValidationIssues shows issues (if any)
- [ ] debugLogRepairResult shows repair status
- [ ] debugLogPipelineSummary shows flow

## Edge Cases
- [ ] Test SHORT_CITY (minimal data)
- [ ] Test OVERAMBITIOUS (triggers repair)
- [ ] Test CROSS_BORDER (one-way trip)
- [ ] Test with DEBUG_VERBOSE=true to see full prompts
- [ ] Test with DEBUG=false to verify no overhead

## Production Readiness
- [ ] No API keys in logs
- [ ] No sensitive user data in logs
- [ ] Performance acceptable
- [ ] Error handling graceful
- [ ] Fallback behavior works
`;

/**
 * Print all test configuration and guidelines
 */
export function printTestGuidelines() {
  console.log('\n' + '='.repeat(70));
  console.log('PIPELINE TEST GUIDELINES');
  console.log('='.repeat(70));

  console.log('\n--- Unit Tests (Automated) ---');
  console.log('Run: npm run test:unit');
  console.log('Tests trip context calculation and plan validation rules');

  console.log('\n--- Integration Tests (Manual + Code) ---');
  console.log('Recommended test flow:');
  console.log(MANUAL_PIPELINE_TEST_EXAMPLE);

  console.log('\n--- Test Checklist ---');
  console.log(MANUAL_TEST_CHECKLIST);

  console.log('\n--- Test Configurations ---');
  Object.entries(PIPELINE_TEST_CONFIG).forEach(([key, config]) => {
    console.log(`\n${key}:`);
    console.log(`  ${JSON.stringify(config, null, 2)}`);
  });
}

/**
 * Export for direct testing
 */
export { SAMPLE_TRIPS, getSampleTrip } from './fixtures/sampleTrips.js';
