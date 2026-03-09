# Itinerary Pipeline Test & Evaluation Guide

## Overview

This directory contains a lightweight test and evaluation setup for the itinerary generation pipeline. It focuses on validating backend logic (trip context, validation, repair) rather than exact wording.

## Structure

```
api/__tests__/
├── fixtures/
│   └── sampleTrips.ts          # 5 representative trip scenarios
├── tripContext.test.ts          # Tests for trip math calculation
├── validation.test.ts           # Tests for plan validation rules
├── testUtils.ts                 # Shared testing utilities
├── integrationTest.ts           # Integration test runner & guidelines
└── README.md                    # This file
```

## Sample Trip Scenarios

### 1. SHORT_CITY - Short 3-day city trip
- **Duration**: 3 calendar days = 2 nights
- **Locations**: London (same arrival/departure)
- **What "good" means**: 
  - 1-2 stops in plan
  - 2 nights total
  - Optional day trip included
  - No complex transport needed
- **Validation**: Should pass immediately without repair

### 2. MEDIUM_TWO_BASES - 9-day trip with 2 bases
- **Duration**: 9 calendar days = 8 nights
- **Locations**: Bangkok + Chiang Mai
- **What "good" means**:
  - 2 main stops
  - 3-5 nights per location
  - Realistic transport (flight or overnight bus)
  - Clear split between cities
- **Validation**: Should pass on first generation
- **Expected stops**: 2, Expected nights: 8

### 3. OVERAMBITIOUS_TRIP - 5 stops in 7 days
- **Duration**: 7 calendar days = 6 nights
- **Locations**: Bangkok, Pattaya, Phuket, Krabi, Chiang Mai
- **What "good" means**:
  - Plan should be feasible=false OR reduced to 2-3 stops
  - Should NOT try to fit all 5 locations
  - Each location should have 2+ nights minimum
  - Transport times realistic
- **Validation**: Should trigger repair/infeasibility flag
- **Expected behavior**: Repair reduces to 2-3 locations OR marks infeasible with suggestions

### 4. RETURN_JOURNEY - Indian classic route
- **Duration**: 17 calendar days = 16 nights
- **Locations**: Delhi → Agra → Jaipur → Delhi
- **What "good" means**:
  - 3 stops: Delhi (4-5 nights), Agra (2-3 nights), Jaipur (3-4 nights)
  - Return journey to Delhi for departure
  - Transport by train between cities
  - Buffer day before departure
- **Validation**: Full round trip accounted for
- **Expected stops**: 3, Expected nights: 16

### 5. CROSS_BORDER - Thailand to Vietnam one-way
- **Duration**: 14 calendar days = 13 nights
- **Locations**: Bangkok → Chiang Mai → Laos → Hanoi
- **Route type**: One-way (arrival Bangkok, departure Hanoi)
- **What "good" means**:
  - 3-4 main stops
  - Border crossing buffer time included
  - Long transfers (overnight buses) considered
  - Final location: Hanoi for departure
- **Validation**: One-way route (isReturnTrip=false)
- **Expected stops**: 3-4, Expected nights: ~13

## Test Files

### `sampleTrips.ts` - Trip Fixtures

Exports:
- `SAMPLE_SHORT_CITY_TRIP`
- `SAMPLE_MEDIUM_TWO_BASES`
- `SAMPLE_OVERAMBITIOUS_TRIP`
- `SAMPLE_RETURN_JOURNEY`
- `SAMPLE_CROSS_BORDER_TRIP`

Each with metadata:
```typescript
interface SampleTripMetadata {
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
```

### `tripContext.test.ts` - Trip Math Tests

5 tests validating trip context calculation:

1. **testTripContextShortCity()**
   - Validates: dates, 2 nights, "short" category, no multi-city

2. **testTripContextMediumTwoBases()**
   - Validates: 8 nights, "medium" category, multi-city flag, 2 stops

3. **testTripContextCrossBorder()**
   - Validates: one-way trip (return=false), multi-city, correct dates

4. **testTripContextBoundarySevenDays()**
   - Boundary test: 7 calendar days = 6 nights

5. **testTripContextOneDayTrip()**
   - Edge case: same-day return = 0 nights

**Run**: `runAllTripContextTests()` returns test summary with results

### `validation.test.ts` - Plan Validation Tests

7 tests validating business rule enforcement:

1. **testValidPlanPasses()**
   - Good plan: no issues, passes all rules

2. **testNightsMismatchTriggers()**
   - Bad plan: allocated nights < expected nights → error

3. **testNegativeNightsTriggers()**
   - Bad plan: negative nights → error

4. **testOverambitiousPlanDetected()**
   - Bad plan: too many stops, marked infeasible

5. **testMinimumStopsCheck()**
   - Bad plan: fewer stops than requested

6. **testReturnTripBufferWarning()**
   - Bad plan: return trip doesn't end at departure location

7. **testRepairTriggerCondition()**
   - Identifies when repair should be triggered

**Run**: `runAllValidationTests()` returns test summary with results

### `testUtils.ts` - Shared Utilities

Helpers for testing:

```typescript
// Format and print results
formatTestResult(result, verbose)
formatTestSummary(summary, verbose)

// Create test results
assertionsToResult(name, assertions)
createErrorResult(name, error)

// Assertions
assertEquals(actual, expected, message)
assertTrue(condition, message)
assertIncludes(array, value, message)
assertLength(array, expectedLength, message)
```

### `integrationTest.ts` - Integration Test Runner

Main entry point:

```typescript
// Run all unit tests
runAllUnitTests() → TestSummary

// Test configuration for each sample
PIPELINE_TEST_CONFIG

// Manual testing checklist
MANUAL_TEST_CHECKLIST

// Pipeline assertions
PIPELINE_ASSERTIONS.validatePlanStructure(plan)
PIPELINE_ASSERTIONS.validateStopCount(plan, expected)
PIPELINE_ASSERTIONS.validateTotalNights(plan, expected)
PIPELINE_ASSERTIONS.validateFeasibility(plan, shouldBeFeasible)
```

## Running Tests

### Unit Tests (Automated)

```bash
# In Node.js or test runner:
import { runAllUnitTests } from './src/__tests__/integrationTest';

const summary = runAllUnitTests();
console.log(`Passed: ${summary.passed}/${summary.total}`);
```

### Integration Tests (Manual + Code)

```bash
# Set up environment
export DEBUG=true
export OPENAI_API_KEY="sk-..."

# Run the itinerary endpoint with sample trip:
curl -X POST http://localhost:5173/api/itinerary \
  -H "Content-Type: application/json" \
  -d '{
    "arrivalLocation": "London",
    "departureLocation": "London",
    "arrivalDate": "2026-04-10",
    "departureDate": "2026-04-13",
    "desiredAttractions": ["museums"],
    "travelPace": "moderate",
    "budget": "moderate",
    "notes": "Testing"
  }'
```

## Key Assertions

### Trip Context

```typescript
// For SHORT_CITY:
context.totalNights === 2        ✓
context.calendarDays === 3       ✓
context.tripCategory === 'short' ✓
context.isMultiCity === false    ✓
```

### Plan Validation

```typescript
// Good plan:
result.valid === true                    ✓
result.issues.length === 0               ✓
result.score >= 80                       ✓

// Bad plan:
result.valid === false                   ✓
result.issues.some(i => i.severity === 'error')  ✓
```

### Repair Trigger

```typescript
// Repair needed if:
plan.isFeasible === false           // OR
validationResult.score < 60         // OR
validationResult.issues.some(i => i.severity === 'error')
```

## Manual Testing Checklist

For each sample trip:

### Input & Context
- [ ] Input passes validation
- [ ] Trip context computes correctly
- [ ] Dates and nights calculated properly

### Planning
- [ ] Plan generated successfully
- [ ] Stop count reasonable
- [ ] Total nights match expected
- [ ] Transport segments logical

### Validation
- [ ] Validation passes/fails as expected
- [ ] Issues detected for bad plans
- [ ] Confidence score reasonable

### Repair (if needed)
- [ ] Repair triggered for invalid plans
- [ ] Repaired plan passes validation
- [ ] Reduction/changes sensible

### Rendering
- [ ] Markdown generated successfully
- [ ] All stops included
- [ ] Format readable

### Debug Logging
- [ ] All pipeline stages logged (if DEBUG=true)
- [ ] No API keys in output
- [ ] User names redacted
- [ ] Structured and readable

## Production Readiness Checks

```
✓ All trip context math validated
✓ All validation rules tested
✓ Repair trigger conditions identified
✓ Error handling verified
✓ No secrets in logs (DEBUG mode)
✓ Performance acceptable
✓ Fallback behavior works
```

## Next Steps

1. **Run unit tests**: `runAllUnitTests()` should show 12+ passing tests
2. **Test with real API**: Set DEBUG=true, make requests with sample trips
3. **Verify logs**: Check that debug output is structured and redacted
4. **Integration**: Ensure full pipeline works end-to-end
5. **Performance**: Monitor response times and token usage
6. **Iterate**: Use test insights to improve planner behavior

## Troubleshooting

### Test failing: "nights mismatch"
- Check: Plan route nights sum
- Expected: matches TripContext.totalNights
- Fix: Ensure each stop.nights is calculated correctly

### Test failing: "fewer stops than expected"
- Check: Plan includes all requested stops
- Expected: plan.route.length >= input.stops.length
- Fix: Planner may be reducing stops; check validation score

### Test failing: "repair not triggered"
- Check: Validation result.valid or result.score
- Expected: Either invalid or score < 60
- Fix: May be passing when should fail; review validation rules

### Debug logs not showing
- Check: DEBUG environment variable
- Expected: DEBUG=true
- Fix: Set in .env or terminal: `export DEBUG=true`

## References

- [Trip Context Documentation](../../lib/tripContext.ts)
- [Validation Rules](../../lib/planValidator.ts)
- [Repair Logic](../../lib/planRepair.ts)
- [Debug Logging](../../lib/debug.ts)
