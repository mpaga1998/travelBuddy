# Test Structure & Quick Navigation

## 📁 Complete Directory Map

```
backpack-map-demo/
│
├── TESTING_SETUP.md ⭐ START HERE
│   └── Delivery summary and overview
│
├── api/
│   │
│   ├── __tests__/ 🧪 TEST HUB
│   │   │
│   │   ├── README.md (350 lines)
│   │   │   ├─ Overview & structure
│   │   │   ├─ Sample trip details (5 scenarios)
│   │   │   ├─ Test file descriptions
│   │   │   ├─ How to run tests
│   │   │   ├─ Key assertions
│   │   │   ├─ Manual testing checklist
│   │   │   └─ Troubleshooting guide
│   │   │
│   │   ├── SETUP.md (300 lines)
│   │   │   ├─ Delivery summary
│   │   │   ├─ File structure
│   │   │   ├─ Test coverage matrix
│   │   │   ├─ Running tests
│   │   │   ├─ Code examples
│   │   │   └─ Next steps
│   │   │
│   │   ├── fixtures/
│   │   │   └── sampleTrips.ts (220 lines) 📍 SAMPLES HERE
│   │   │       ├─ SAMPLE_SHORT_CITY_TRIP (3 days)
│   │   │       ├─ SAMPLE_MEDIUM_TWO_BASES (9 days)
│   │   │       ├─ SAMPLE_OVERAMBITIOUS_TRIP (7 days, 5 stops)
│   │   │       ├─ SAMPLE_RETURN_JOURNEY (17 days)
│   │   │       └─ SAMPLE_CROSS_BORDER_TRIP (14 days, one-way)
│   │   │
│   │   ├── tripContext.test.ts (170 lines) ✅ CONTEXT TESTS
│   │   │   ├─ testTripContextShortCity()
│   │   │   ├─ testTripContextMediumTwoBases()
│   │   │   ├─ testTripContextCrossBorder()
│   │   │   ├─ testTripContextBoundarySevenDays()
│   │   │   ├─ testTripContextOneDayTrip()
│   │   │   └─ runAllTripContextTests() → TestSummary
│   │   │
│   │   ├── validation.test.ts (290 lines) ✅ VALIDATION TESTS
│   │   │   ├─ testValidPlanPasses()
│   │   │   ├─ testNightsMismatchTriggers()
│   │   │   ├─ testNegativeNightsTriggers()
│   │   │   ├─ testOverambitiousPlanDetected()
│   │   │   ├─ testMinimumStopsCheck()
│   │   │   ├─ testReturnTripBufferWarning()
│   │   │   ├─ testRepairTriggerCondition()
│   │   │   └─ runAllValidationTests() → TestSummary
│   │   │
│   │   ├── testUtils.ts (150 lines) 🔧 UTILITIES
│   │   │   ├─ formatTestResult()
│   │   │   ├─ formatTestSummary()
│   │   │   ├─ assertionsToResult()
│   │   │   ├─ createErrorResult()
│   │   │   ├─ mergeSummaries()
│   │   │   └─ Assertion helpers (assertEquals, assertTrue, etc.)
│   │   │
│   │   ├── integrationTest.ts (300+ lines) 🔄 INTEGRATION
│   │   │   ├─ runAllUnitTests() → TestSummary
│   │   │   ├─ PIPELINE_TEST_CONFIG (expectations per sample)
│   │   │   ├─ MANUAL_PIPELINE_TEST_EXAMPLE (pseudo-code)
│   │   │   ├─ PIPELINE_ASSERTIONS (validation helpers)
│   │   │   ├─ MANUAL_TEST_CHECKLIST
│   │   │   └─ printTestGuidelines()
│   │   │
│   │   └── examples.ts (400+ lines) 📝 CODE EXAMPLES
│   │       ├─ EXAMPLE_RUN_ALL_TESTS
│   │       ├─ EXAMPLE_TEST_CONTEXT
│   │       ├─ EXAMPLE_VALIDATE_PLAN
│   │       ├─ EXAMPLE_USE_FIXTURE
│   │       ├─ EXAMPLE_FULL_PIPELINE
│   │       ├─ EXAMPLE_REPAIR_TRIGGER
│   │       ├─ EXAMPLE_DEBUG_MODE
│   │       ├─ EXAMPLE_TEST_REPORT
│   │       ├─ EXAMPLE_TEST_METADATA
│   │       ├─ EXAMPLE_PERFORMANCE_TEST
│   │       └─ printAllExamples()
│   │
│   ├── lib/
│   │   ├── tripContext.ts ← Tests validate
│   │   ├── planValidator.ts ← Tests validate
│   │   ├── debug.ts ← Produces logs tested
│   │   └── ...
│   │
│   └── itinerary.ts ← Endpoint being tested
│
└── ...
```

## 🚀 Quick Start Guide

### Step 1: Understand What You Have
```
📍 START HERE: TESTING_SETUP.md
   → Delivery summary and overview
```

### Step 2: Read The Documentation
```
📖 Read in order:
   1. api/__tests__/README.md (main guide)
   2. api/__tests__/SETUP.md (quick reference)
   3. Code comments in test files
```

### Step 3: Run Tests
```typescript
// Run all unit tests
import { runAllUnitTests } from '@/api/__tests__/integrationTest';
const results = runAllUnitTests();
// → 12 tests should pass
```

### Step 4: Test with Samples
```typescript
// Use fixture in your code
import { SAMPLE_SHORT_CITY_TRIP } from '@/api/__tests__/fixtures/sampleTrips';

// Call endpoint with sample
const response = await fetch('/api/itinerary', {
  method: 'POST',
  body: JSON.stringify(SAMPLE_SHORT_CITY_TRIP),
});
```

### Step 5: Review Debug Logs
```bash
export DEBUG=true
npm run dev

# Make request → see debug logs in console
```

## 📋 Test Summary

### Test Files (3 core files)

| File | Tests | Type | Coverage |
|------|-------|------|----------|
| tripContext.test.ts | 5 | Unit | Date math, categories, flags |
| validation.test.ts | 7 | Unit | Business rules, scoring |
| integrationTest.ts | N/A | Integration | End-to-end patterns |

**Total**: 12 automated unit tests + 7+ integration patterns

### Sample Trips (5 fixtures)

| Name | Days | Nights | Stops | Purpose |
|------|------|--------|-------|---------|
| SHORT_CITY | 3 | 2 | 1 | Minimal (should pass) |
| MEDIUM_TWO_BASES | 9 | 8 | 2 | Realistic (should pass) |
| OVERAMBITIOUS | 7 | 6 | 5 | Repair trigger (should fail→repair) |
| RETURN_JOURNEY | 17 | 16 | 3 | Complex (should pass) |
| CROSS_BORDER | 14 | 13 | 4 | One-way (should pass) |

### Code Examples (10 ready-to-use)

| # | Example | Use Case |
|---|---------|----------|
| 1 | EXAMPLE_RUN_ALL_TESTS | Execute full test suite |
| 2 | EXAMPLE_TEST_CONTEXT | Validate trip math |
| 3 | EXAMPLE_VALIDATE_PLAN | Check business rules |
| 4 | EXAMPLE_USE_FIXTURE | Access sample trips |
| 5 | EXAMPLE_FULL_PIPELINE | End-to-end test |
| 6 | EXAMPLE_REPAIR_TRIGGER | Detect repair condition |
| 7 | EXAMPLE_DEBUG_MODE | Enable debug logging |
| 8 | EXAMPLE_TEST_REPORT | Generate summary |
| 9 | EXAMPLE_TEST_METADATA | Print test guidance |
| 10 | EXAMPLE_PERFORMANCE_TEST | Measure timing |

## ✅ Main Assertions

### Trip Context Tests
```
✓ Dates calculated correctly
✓ Total nights computed accurately
✓ Category (short/medium/long) assigned
✓ Multi-city flags set correctly
✓ Return trip detection works
```

### Validation Tests
```
✓ Valid plans pass all rules
✓ Invalid plans trigger errors
✓ Nights mismatch detected
✓ Negative nights rejected
✓ Overambitious plans flagged
✓ Minimum stops enforced
✓ Return trip buffer warnings given
✓ Repair trigger conditions identified
```

## 🔍 How to Navigate

### "I want to..."

#### Run all tests
→ `integrationTest.ts`: `runAllUnitTests()`

#### Test a specific component
→ Use relevant test file:
- `tripContext.test.ts` (trip math)
- `validation.test.ts` (plan rules)

#### Use a sample trip in my test
→ `fixtures/sampleTrips.ts`: `getSampleTrip(name)` or `SAMPLE_*_TRIP`

#### Understand what a test does
→ Each test has clear comments and `assertionGuidance`

#### Copy-paste code examples
→ `examples.ts`: Pick `EXAMPLE_*` string and paste

#### See full test documentation
→ `api/__tests__/README.md`: Comprehensive guide

#### Get quick reference
→ `api/__tests__/SETUP.md`: Quick lookup

#### Understand the delivery
→ `TESTING_SETUP.md`: What was created

## 📊 Test Results Format

### When You Run Tests
```
✓ Trip Context: Short City Trip
✓ Trip Context: Medium Two Bases
✓ Trip Context: Cross-Border One-Way
✓ Trip Context: Boundary 7 Days
✓ Trip Context: Same-Day Return
✓ Validation: Valid Plan Passes
✓ Validation: Nights Mismatch Triggers
✓ Validation: Negative Nights Triggers
✓ Validation: Overambitious Plan Detected
✓ Validation: Minimum Stops Check
✓ Validation: Return Trip Buffer Warning
✓ Validation: Repair Trigger Condition

All Unit Tests
├─ Total: 12
├─ Passed: 12 ✓
├─ Failed: 0
└─ Pass Rate: 100%
```

## 🔧 Utilities Available

### From `testUtils.ts`
```typescript
formatTestResult(result, verbose)    // Format single test
formatTestSummary(summary, verbose)  // Format test summary
assertionsToResult(name, obj)        // Convert assertions to result
mergeSummaries(summaries)            // Combine test summaries
assertEquals(a, b, msg)              // Assert equality
assertTrue(condition, msg)           // Assert boolean
```

### From `integrationTest.ts`
```typescript
runAllUnitTests()                    // Run all tests
PIPELINE_TEST_CONFIG                // Expected values per sample
PIPELINE_ASSERTIONS                 // Validation helpers
```

### From `sampleTrips.ts`
```typescript
getSampleTrip(name)                 // Get sample by name
getAllSampleTrips()                 // Get all samples
SAMPLE_SHORT_CITY_TRIP              // Direct access
// etc.
```

## 📝 File Contents Quick Lookup

```
sampleTrips.ts
├─ 5 trip fixtures with metadata
├─ Access: getSampleTrip() or SAMPLE_*_TRIP
└─ Use: Copy NormalizedTripInput to your test

tripContext.test.ts
├─ 5 unit tests for trip math
├─ Test: runAllTripContextTests()
└─ Validates: dates, nights, category, flags

validation.test.ts
├─ 7 unit tests for business rules
├─ Test: runAllValidationTests()
└─ Validates: rules, scoring, repair triggers

testUtils.ts
├─ Testing framework utilities
├─ Functions: format, assert, merge
└─ Use: Import for custom tests

integrationTest.ts
├─ Integration test runner
├─ Main: runAllUnitTests()
├─ Config: PIPELINE_TEST_CONFIG (per sample)
└─ Helpers: PIPELINE_ASSERTIONS, checklists

examples.ts
├─ 10 copy-paste code examples
├─ All exported as EXAMPLE_* strings
└─ Use: Paste into your code or study

README.md
├─ Complete testing guide (350 lines)
├─ Sections: overview, tests, samples, running, assertions, checklist
└─ Use: Reference for all questions

SETUP.md
├─ Quick reference (300 lines)
├─ Sections: summary, coverage, samples, assertions, next steps
└─ Use: Quick lookup and getting started
```

## 📈 Expected Results

### After Running Tests
```
Compilation:     ✓ 0 errors
Unit Tests:      ✓ 12/12 passing
Coverage:        ✓ All core components
Integration:     ✓ Manual walkthrough provided
```

### After Using Samples
```
SHORT_CITY:      ✓ Valid on first try (no repair)
MEDIUM_TWO_BASES: ✓ Valid on first try (no repair)
OVERAMBITIOUS:   ✓ Repair triggered (expected)
RETURN_JOURNEY:  ✓ Valid on first try (no repair)
CROSS_BORDER:    ✓ Valid on first try (no repair)
```

## 🎯 Next Actions

### Immediate (This Session)
- [ ] Read TESTING_SETUP.md (this file's parent)
- [ ] Run `runAllUnitTests()` - should pass 12/12
- [ ] Review README.md for details

### Short Term (Next Hour)
- [ ] Test with real API using samples
- [ ] Verify debug logs with DEBUG=true
- [ ] Check assertions match expectations

### Medium Term (Next Day)
- [ ] Integrate tests into CI/CD
- [ ] Create custom tests for edge cases
- [ ] Monitor validation scores

## 🆘 Troubleshooting

### "Tests not found" → Check import paths in your file
### "TypeError in test" → Review test expectations in README
### "Assertion failing" → Check sample metadata for expected values
### "No debug logs" → Set DEBUG=true and restart

## 📞 Support

- Full guide: `api/__tests__/README.md`
- Quick ref: `api/__tests__/SETUP.md`
- Code examples: `api/__tests__/examples.ts`
- Test files: See descriptions above
