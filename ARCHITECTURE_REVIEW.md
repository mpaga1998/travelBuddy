# Itinerary Generation Module - Architecture Review

**Date**: March 9, 2026  
**Status**: Production-Ready with Cleanup Recommendations  
**Review Scope**: api/lib/ modules + api/itinerary.ts endpoint

---

## Executive Summary

The itinerary generation pipeline is **well-structured and production-ready**, with clear separation of concerns across 15+ modules. However, there are **minor naming inconsistencies**, **one duplication issue**, and **opportunities for verbosity reduction** that should be addressed for long-term maintainability.

### Key Findings

| Category | Status | Details |
|----------|--------|---------|
| **Architecture** | ✅ Excellent | Two-stage pipeline (plan→render), clear phases |
| **Separation of Concerns** | ✅ Good | Each module has single responsibility |
| **Naming Consistency** | ⚠️  Minor Issues | Some inconsistent patterns (format vs build) |
| **Code Duplication** | ⚠️  One Issue | Two OpenAI implementations (`openai.ts` + `openaiService.ts`) |
| **Verbosity** | ✅ Acceptable | Some verbose console logging, easily fixable |
| **Production-Ready** | ✅ Yes | All modules functional, types exported, error handling present |

---

## 1. Naming Consistency Review

### Issue 1.1: Inconsistent Function Prefixes

**Current State**:
```typescript
// Prompts (inconsistent naming)
buildSystemPrompt()              // generic (in prompts.ts)
buildPlanningSystemPrompt()      // specific (in planningPrompts.ts)
buildRenderingSystemPrompt()     // specific (in renderingPrompts.ts)
buildUserPrompt()                // generic (in prompts.ts)
buildPlanningUserPrompt()        // specific (in planningPrompts.ts)

// Format functions (too many similar names)
formatDate()
formatValidationErrors()
formatParseErrors()
formatRenderingResult()
formatRepairResult()
formatValidationIssues()
formatHeuristicsForPrompt()      // uses "format" but returns markdown string

// Build functions (mixing with format)
buildOpenAIConfig()
buildDebugConfig()
```

**Recommendation**:
- **Prompts**: All should use `build*SystemPrompt()` and `build*UserPrompt()` pattern  
- **Format** functions: Rename to clearly indicate what they format:
  - `formatDate()` → `formatDateForDisplay()`
  - `formatValidationErrors()` → `formatErrorsForResponse()`
  - `formatParseErrors()` → `formatParseErrorsForResponse()`
  - `formatValidationIssues()` → `formatValidationIssuesForLogging()`
  - `formatRepairResult()` → `formatRepairResultForLogging()`
  - `formatRenderingResult()` → `formatRenderingResultForLogging()`
  - `formatHeuristicsForPrompt()` → `renderHeuristicsForPrompt()` (uses render, not format)

---

### Issue 1.2: Inconsistent Debug Function Naming

**Current State**:
```typescript
debugLogNormalizedInput()
debugLogTripContext()
debugLogPlanningPromptMetadata()    // "Metadata"
debugLogPlannerResponse()           // "Response"
debugLogParseResult()               // "Result"
debugLogValidationIssues()          // "Issues"
debugLogPlan()                      // "Plan"
debugLogRepairTriggered()           // "Triggered"
debugLogRepairResult()              // "Result"
debugLogRenderingMetadata()         // "Metadata"
debugLogRenderingResponse()         // "Response"
debugLogPipelineSummary()           // "Summary"
```

**Issue**: Mixed naming patterns (Metadata, Response, Result, Issues, Triggered, Summary)

**Recommendation**: Standardize to `debugLog[Stage][Entity]`:
```typescript
debugLogInputValidation()           // or debugLogValidatedInput()
debugLogContextComputed()           // or debugLogTripContextComputed()
debugLogPlanningPrompt()            // includes system + user prompts
debugLogPlanningResponse()          // planning response
debugLogPlanningParse()             // parse step
debugLogPlanningValidation()        // validation step
debugLogRepair()                    // repair result
debugLogRenderingPrompt()           // rendering prompts
debugLogRenderingResponse()         // rendering response
debugLogPipelineCompletion()        // final summary
```

---

### Issue 1.3: Function Naming - Verbs Should Be Consistent

**Current**:
```typescript
buildSystemPrompt()         // "build"
computeTripContext()        // "compute"
validatePlanBusinessRules() // "validate"
parsePlanResponse()         // "parse"
renderItinerary()           // "render"
planItinerary()             // "plan"
getTravelHeuristics()       // "get"
summarizePlan()             // "summarize"
attemptPlanRepair()         // "attempt"
```

**Good**: Verbs are clear and domain-specific.  
**Minor Issue**: `attemptPlanRepair()` vs `repairPlan()` - verb order inconsistent  

**Recommendation**: Stay consistent with current pattern (verb-first), but rename:
- `attemptPlanRepair()` → `repairPlan()` (simpler, matches `renderItinerary`, `planItinerary`)

---

## 2. Duplication Analysis

### Issue 2.1: Two OpenAI Implementations ⚠️ CRITICAL

**Location**: `api/lib/openai.ts` + `api/lib/openaiService.ts`

**openai.ts** (OLD - fallback generation only):
```typescript
export async function generateItinerary(
  input: NormalizedTripInput,
  firstName?: string
): Promise<string> {
  const context = computeTripContext(input);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input, context, firstName);
  // ... simple GPT call
}
```

**openaiService.ts** (NEW - structured with config):
```typescript
export class OpenAIService {
  callPlanning(request: OpenAIRequest): Promise<OpenAIResponse>
  callRepair(request: OpenAIRequest): Promise<OpenAIResponse>
  callRendering(request: OpenAIRequest): Promise<OpenAIResponse>
}
```

**Finding**: Both exist and are used in different places:
- `openai.ts` → `generateItinerary()` used in **itinerary.ts** as fallback
- `openaiService.ts` → Used by planner, repair, renderer modules

**Recommendation**: **MERGE into single implementation**

Options:
1. **Option A** (Preferred): Keep `openaiService.ts`, add fallback method:
   ```typescript
   export class OpenAIService {
     callPlanning() { ... }
     callRepair() { ... }
     callRendering() { ... }
     callGenerateFallback() { ... }  // fallback for errors
   
   // Export function for backward compatibility:
   export async function generateItinerary(input, firstName) {
     return service.callGenerateFallback(input, firstName);
   }
   ```

2. **Option B**: Delete `openai.ts`, use renderItinerary instead of fallback

---

### Issue 2.2: Prompt Files Scattered

**Current**:
- `prompts.ts` — generic system/user prompts (fallback generation)
- `planningPrompts.ts` — planning-specific prompts
- `renderingPrompts.ts` — rendering-specific prompts

**Finding**: Works well, but could be cleaner. `prompts.ts` is only used for fallback.

**Recommendation**: Move `prompts.ts` content into `openaiService.ts` as fallback prompts, keep specialized prompts separate:
```
api/lib/
├── prompts/
│   ├── planning.ts       (buildPlanningSystemPrompt, buildPlanningUserPrompt)
│   ├── rendering.ts      (buildRenderingSystemPrompt, buildRenderingUserPrompt)
│   └── fallback.ts       (buildFallbackSystemPrompt, buildFallbackUserPrompt)
```

Or keep flat structure, just rename `prompts.ts` → `fallbackPrompts.ts` for clarity.

---

## 3. Code Verbosity Analysis

### Issue 3.1: Repetitive Console Logging

**Current**:
```typescript
console.log('[Handler] Step 1: Validate and normalize input');
console.log('[Handler] ✓ Input validation passed');
console.warn('[Handler] ✗ Rendering failed, falling back');
console.error('[Handler] Planning failed:', planningResult.error);

console.log('[Planner] Starting planning with max retries:', maxRetries);
console.log('[Planner] Attempt 1/2');
console.log(`[Planner] Empty response from OpenAI`);

console.log('[Renderer] Starting itinerary rendering');
console.log('[Renderer] Markdown rendered successfully');
```

**Issue**: 
- Many short log statements with repetitive prefixes
- Inconsistent emoji usage (✓, ✗, 🔍, 📝)
- Same format duplicated across modules

**Recommendation**: Create logging helper:
```typescript
// lib/logging.ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type Module = 'handler' | 'planner' | 'renderer' | 'parser' | 'validator';

function log(module: Module, level: LogLevel, message: string, data?: any) {
  const prefix = `[${module.toUpperCase()}]`;
  const logFn = console[level] || console.log;
  logFn(`${prefix} ${message}`, data ?? '');
}

// Usage:
log('handler', 'info', 'Input validation passed');
log('planner', 'warn', 'Repair failed:', repairMessage);
log('renderer', 'error', 'Empty response from OpenAI');
```

---

### Issue 3.2: Verbose Plan Validation Logic in Endpoint

**Current** (api/itinerary.ts):
```typescript
let planIsValid = false;
if (planningResult.repairAttempted) {
  console.log('[Handler] Plan required repair attempt');
  if (planningResult.repairResult) {
    if (planningResult.repairResult.success) {
      console.log('[Handler] ✓ Repair successful');
    } else {
      console.warn('[Handler] ✗ Repair failed:', planningResult.repairResult.repairMessage);
    }
  }
}

if (planningResult.success && planningResult.plan && planningResult.validationResult) {
  planIsValid = planningResult.validationResult.valid;
  console.log('[Handler] Plan validation score:', planningResult.validationResult.score);

  if (planIsValid) {
    const repairNote = planningResult.repairAttempted ? ' (after repair)' : '';
    console.log('[Handler] Plan is valid, ready for rendering' + repairNote);
  } else {
    console.warn('[Handler] Plan failed business-rule validation:');
    const errorCount = planningResult.validationResult.issues.filter(
      (i) => i.severity === 'error'
    ).length;
    console.warn(`  - ${errorCount} critical error(s)`);
    planningResult.validationResult.issues
      .filter((i) => i.severity === 'error')
      .forEach((issue) => {
        console.warn(`    • ${issue.rule}: ${issue.message}`);
      });
  }
}
```

**Recommendation**: Extract to helper:
```typescript
function logPlanningStatus(result: PlanningResult) {
  if (!result.success) {
    log('handler', 'error', 'Planning failed', result.error);
    return;
  }
  
  if (result.repairAttempted && result.repairResult) {
    log('handler', 'info', 
      result.repairResult.success ? '✓ Repair successful' : '✗ Repair failed'
    );
  }
  
  if (result.validationResult) {
    const { valid, score, issues } = result.validationResult;
    log('handler', 'info', `Validation score: ${score}${valid ? ' ✓' : ' ✗'}`);
    
    if (!valid) {
      issues
        .filter(i => i.severity === 'error')
        .forEach(issue => log('handler', 'warn', `  ${issue.rule}: ${issue.message}`));
    }
  }
}
```

---

## 4. Separation of Concerns - Structure Review

### Current Architecture ✅ GOOD

```
api/lib/
├── validation.ts              # Input validation + normalization
├── tripContext.ts             # Trip date/category/multi-city math
├── planningPrompts.ts         # Planning stage prompts
├── planParser.ts              # JSON extraction + parsing
├── planValidator.ts           # Business rule validation
├── planner.ts                 # Orchestrator (parser → validator → repair)
├── planRepair.ts              # Single repair attempt with feedback
├── renderingPrompts.ts        # Rendering stage prompts
├── renderer.ts                # Plan → Markdown conversion
├── openaiService.ts           # OpenAI API calls (centralized)
├── travelHeuristics.ts        # Destination-aware heuristics
├── debug.ts                   # Observability + logging
├── openai.ts                  # ⚠️ DUPLICATION (fallback generation)
├── prompts.ts                 # ⚠️ DUPLICATION (fallback prompts)
└── date.ts                    # Date utility functions

api/types/
├── trip.ts                    # Trip input/output types
└── plan.ts                    # Plan structure types

api/
└── itinerary.ts              # HTTP endpoint + orchestrator
```

### Concerns: Well-Separated ✅

1. **✅ Validation** — `validation.ts`
   - Single entry point for input validation
   - Collects all errors, returns normalized data

2. **✅ Trip Context** — `tripContext.ts`
   - Computes trip dates, nights, category, multi-city logic
   - Pure function, no side effects

3. **✅ Heuristics** — `travelHeuristics.ts`
   - Destination-aware rules (transfer times, region info)
   - Used to enhance planning prompts

4. **✅ Planning** — `planner.ts`, `planningPrompts.ts`, `planParser.ts`, `planValidator.ts`
   - Clear pipeline: prompts → API → parse → validate → repair

5. **✅ Repair** — `planRepair.ts`
   - Single responsibility: attempt one repair with feedback
   - Called only if validation fails

6. **✅ Rendering** — `renderer.ts`, `renderingPrompts.ts`
   - Takes validated plan + converts to markdown
   - Clean input/output

7. **✅ API Layer** — `openaiService.ts`
   - Centralized, config-driven
   - Handles planning, repair, rendering use cases

8. **✅ Observability** — `debug.ts`
   - Optional, guarded by config
   - Comprehensive pipeline logging

9. **✅ HTTP Handler** — `itinerary.ts`
   - Orchestrates all stages
   - Error handling + fallback

---

## 5. Remaining Technical Debt

### Item 1: Remove `openai.ts` (Old fallback generation) 
- **Impact**: Medium  
- **Effort**: 1 hour
- **Action**: Merge into `openaiService.ts` as fallback method

### Item 2: Consolidate prompt files
- **Impact**: Low  
- **Effort**: 30 minutes
- **Action**: Rename `prompts.ts` → `fallbackPrompts.ts` OR create `prompts/` folder

### Item 3: Standardize naming across format/log functions
- **Impact**: Low (cosmetic)
- **Effort**: 30 minutes
- **Action**: Rename functions for consistency

### Item 4: Extract Console Logging to Helper
- **Impact**: Low  
- **Effort**: 1 hour
- **Action**: Create `lib/logging.ts` helper

### Item 5: Simplify Plan Validation Logging in Endpoint
- **Impact**: Low  
- **Effort**: 30 minutes
- **Action**: Extract to `logPlanningStatus()` helper

### Item 6: Update Prompt Names for Clarity
- **Impact**: Low  
- **Effort**: 30 minutes
- **Action**: Rename `buildSystemPrompt()` → `buildFallbackSystemPrompt()` in `openai.ts`

---

## 6. Final Folder Structure Recommendation

```
api/
├── itinerary.ts                           # HTTP endpoint + main orchestrator
├── types/
│   ├── trip.ts                            # TripInput, NormalizedTripInput, ValidationError
│   └── plan.ts                            # ItineraryPlan, PlanStop, TransportSegment
│
└── lib/
    ├── validation.ts                      # validateAndNormalizeTripInput()
    │
    ├── tripContext.ts                     # computeTripContext(), describe*()
    │
    ├── prompts/                           # ✅ GROUPED
    │   ├── planning.ts                    # buildPlanningSystemPrompt(), buildPlanningUserPrompt()
    │   ├── rendering.ts                   # buildRenderingSystemPrompt(), buildRenderingUserPrompt()
    │   └── fallback.ts                    # buildFallbackSystemPrompt(), buildFallbackUserPrompt()
    │
    ├── planner.ts                         # planItinerary() - orchestrator
    ├── planningPrompts.ts                 # ← Can be moved to prompts/planning.ts
    ├── planParser.ts                      # parsePlanResponse()
    ├── planValidator.ts                   # validatePlanBusinessRules()
    ├── planRepair.ts                      # repairPlan()
    │
    ├── renderer.ts                        # renderItinerary()
    ├── renderingPrompts.ts                # ← Can be moved to prompts/rendering.ts
    │
    ├── travelHeuristics.ts               # getTravelHeuristics()
    │
    ├── openaiService.ts                   # OpenAIService class (centralized API)
    ├── openai.ts                          # ⚠️ DELETE (merge into openaiService)
    ├── prompts.ts                         # ⚠️ RENAME to fallbackPrompts.ts
    │
    ├── debug.ts                           # debugLog*(), config
    ├── logging.ts                         # ✅ NEW - log() helper
    │
    └── date.ts                            # formatDateForDisplay(), parseISODate()
```

---

## 7. Module Responsibilities - Final Summary

| Module | Responsibility | Depends On |
|--------|-----------------|------------|
| **itinerary.ts** | HTTP endpoint, CORS, orchestration | All lib modules |
| **validation.ts** | Input validation & normalization | types/trip, date |
| **tripContext.ts** | Trip math (dates, nights, category) | types/trip, date |
| **travelHeuristics.ts** | Destination-aware intelligence | tripContext |
| **planningPrompts.ts** | Planning stage prompts | tripContext, travelHeuristics |
| **planParser.ts** | JSON extraction + schema validation | types/plan, tripContext |
| **planValidator.ts** | Business rule validation | types/plan, validation |
| **planRepair.ts** | One-attempt repair with feedback | types/plan, planningPrompts, openaiService |
| **planner.ts** | Orchestrates parsing → validation → repair | All plan modules |
| **renderingPrompts.ts** | Rendering stage prompts | types/plan |
| **renderer.ts** | Plan → Markdown conversion | planner, renderingPrompts, openaiService |
| **openaiService.ts** | Centralized OpenAI API calls | types |
| **debug.ts** | Optional structured logging | All modules can use |
| **logging.ts** | ✅ NEW - Console logging helper | None (used by others) |
| **date.ts** | Date utilities | None |

---

## 8. Next Steps (Priority Order)

### Phase 1: Fix Critical Duplication (1 hour)
1. [ ] Merge `openai.ts` → `openaiService.ts`
   - Add `callGenerateFallback()` method to OpenAIService
   - Update endpoint to use service instead of direct `generateItinerary()`
   - Delete `openai.ts`

### Phase 2: Standardize Naming (30 minutes)
2. [ ] Rename format functions for clarity:
   - `formatDate()` → `formatDateForDisplay()`
   - `formatValidationIssues()` → `formatValidationIssuesForLogging()`
   - `formatHeuristicsForPrompt()` → `renderHeuristicsForPrompt()`

3. [ ] Standardize debug function names:
   - Use consistent pattern: `debugLog[Stage][Entity]()`

### Phase 3: Extract Helpers (1 hour)
4. [ ] Create `lib/logging.ts`:
   - Extract `log(module, level, message, data)` helper
   - Use throughout modules

5. [ ] Extract plan status logging:
   - Create `logPlanningStatus(result)` in endpoint

### Phase 4: Reorganize Prompts (Optional, low priority)
6. [ ] Create `prompts/` folder:
   - Move `planningPrompts.ts` → `prompts/planning.ts`
   - Move `renderingPrompts.ts` → `prompts/rendering.ts`
   - Create `prompts/index.ts` for re-exports

---

## 9. Code Quality Checklist

```
✅ Type Safety
  - All modules export complete types
  - No 'any' types used
  - Generics used appropriately

✅ Error Handling
  - All async functions wrapped in try/catch
  - Validation errors collected + returned
  - Fallback generation on pipeline failure

✅ Separation of Concerns
  - Each module has single responsibility
  - Clear input/output interfaces
  - Minimal cross-dependencies

✅ Testing Foundation
  - Types exportable for test fixtures
  - Pure functions easily testable
  - Mocking points available

✅ Production-Ready
  - Environment variable configuration
  - Debug logging (optional, guarded)
  - CORS headers + HTTP error handling
  - Graceful degradation (fallback generation)

⚠️ Naming Consistency
  - Some format/build function naming overlap
  - Debug function naming could be standardized
  - But doesn't impact functionality

⚠️ Code Duplication
  - Two OpenAI implementations (fixable)
  - Should be consolidated

```

---

## 10. Performance Notes

- ✅ No unnecessary computation (trip context computed once)
- ✅ API calls batched (planning, repair, rendering separate)
- ✅ Validation happens before expensive API calls
- ✅ Repair single-attempt (no exponential retry)
- ℹ️  Debug logging guarded by config (zero overhead when disabled)

---

## 11. Security Notes

- ✅ Input validation comprehensive (13+ checks)
- ✅ API keys not logged (redacted in debug)
- ✅ User names redacted from debug output
- ✅ Sensitive data (budget) redacted from logs
- ✅ Error messages safe (don't expose internals)

---

## Conclusion

**The itinerary generation module is production-ready and well-architected.**

### Current State: 8.5/10
- Excellent: Architecture, separation of concerns, error handling
- Good: Type safety, testing foundation
- Minor: Naming consistency, one duplication

### After Cleanup: 9.5/10
- Apply recommendations from Phase 1-2 (2 hours)
- Better: Naming, reduced duplication, clearer logging

### For Next Session
Start with **Phase 1** (merge OpenAI implementations) — highest impact, lowest complexity.
