# Architecture Cleanup Action Plan

## Quick Summary
- **Status**: Production-ready + minor cleanup recommended
- **Critical**: Merge 2 OpenAI implementations (1 hour)
- **Important**: Standardize naming (30 minutes)
- **Nice-to-have**: Extract logging helpers (1 hour)
- **Total Effort**: ~2.5 hours for full cleanup

---

## Phase 1: Fix Duplication (CRITICAL) - 1 hour

### Problem
Two separate OpenAI implementations:
- `api/lib/openai.ts` — fallback generation (old)
- `api/lib/openaiService.ts` — structured API (new)

### Solution
Merge `openai.ts` into `openaiService.ts`

### Steps

1. **In `openaiService.ts`**, add fallback method:
   ```typescript
   // Add to OpenAIService class
   async callGenerateFallback(
     input: NormalizedTripInput,
     firstName?: string
   ): Promise<OpenAIResponse> {
     const context = computeTripContext(input);
     const systemPrompt = buildFallbackSystemPrompt();
     const userPrompt = buildFallbackUserPrompt(input, context, firstName);
     
     return await this.call('rendering', {
       systemPrompt,
       userPrompt,
     });
   }
   ```

2. **Rename `prompts.ts` → `fallbackPrompts.ts`**:
   - `export function buildSystemPrompt()` → `buildFallbackSystemPrompt()`
   - `export function buildUserPrompt()` → `buildFallbackUserPrompt()`

3. **In `itinerary.ts`**, update imports and usage:
   ```typescript
   // OLD:
   import { generateItinerary } from './lib/openai';
   itinerary = await generateItinerary(normalizedInput, normalizedInput.userFirstName);
   
   // NEW:
   const service = getOpenAIService();
   const response = await service.callGenerateFallback(normalizedInput, normalizedInput.userFirstName);
   itinerary = response.content;
   ```

4. **Delete `api/lib/openai.ts`** (no longer used)

---

## Phase 2: Standardize Naming (30 minutes)

### Problem
Inconsistent "format" function names that don't clearly indicate their purpose

### Solution
Rename format functions for clarity

### Changes Needed

**In `lib/date.ts`**:
```typescript
// OLD: formatDate
// NEW:
export function formatDateForDisplay(date: Date): string {
```

**In `lib/validation.ts`**:
```typescript
// OLD: formatValidationErrors
// NEW:
export function formatErrorsForResponse(errors: ValidationError[]): string {
```

**In `lib/planParser.ts`**:
```typescript
// OLD: formatParseErrors
// NEW:
export function formatParseErrorsForLogging(errors: PlanParseError[]): string {
```

**In `lib/planValidator.ts`**:
```typescript
// OLD: formatValidationIssues
// NEW:
export function formatValidationIssuesForLogging(result: PlanValidationResult): string {
```

**In `lib/planRepair.ts`**:
```typescript
// OLD: formatRepairResult
// NEW:
export function formatRepairResultForLogging(result: RepairResult): string {
```

**In `lib/renderer.ts`**:
```typescript
// OLD: formatRenderingResult
// NEW:
export function formatRenderingResultForLogging(result: RenderingResult): string {
```

**In `lib/travelHeuristics.ts`**:
```typescript
// OLD: formatHeuristicsForPrompt (misleading - returns markdown)
// NEW:
export function renderHeuristicsForPrompt(heuristics: TripHeuristics): string {
```

### Update All Call Sites
Search and replace in all files that use these functions.

---

## Phase 3: Extract Logging Helper (1 hour)

### Problem
Repetitive console.log calls with manual prefix formatting

### Solution
Create centralized logging helper

### Steps

**Create `api/lib/logging.ts`**:
```typescript
/**
 * Centralized logging utility for pipeline stages
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Module = 
  | 'handler'
  | 'planner'
  | 'renderer'
  | 'parser'
  | 'validator'
  | 'repair'
  | 'context'
  | 'validation';

/**
 * Log message with module prefix
 */
export function log(
  module: Module,
  level: LogLevel,
  message: string,
  data?: any
): void {
  const prefix = `[${module.toUpperCase()}]`;
  const logFn = console[level] || console.log;
  
  if (data !== undefined) {
    logFn(`${prefix} ${message}`, data);
  } else {
    logFn(`${prefix} ${message}`);
  }
}

// Convenience functions
export const logInfo = (module: Module, msg: string, data?: any) => 
  log(module, 'info', msg, data);
export const logWarn = (module: Module, msg: string, data?: any) => 
  log(module, 'warn', msg, data);
export const logError = (module: Module, msg: string, data?: any) => 
  log(module, 'error', msg, data);
export const logDebug = (module: Module, msg: string, data?: any) => 
  log(module, 'debug', msg, data);
```

### Update Usage in Modules

**In `lib/planner.ts`**:
```typescript
// OLD:
console.log('[Planner] Starting planning with max retries:', maxRetries);
console.error('[Planner] Empty response from OpenAI');

// NEW:
import { log } from './logging';
log('planner', 'info', 'Starting planning', { maxRetries });
log('planner', 'error', 'Empty response from OpenAI');
```

**In `lib/renderer.ts`**:
```typescript
// OLD:
console.log('[Renderer] Starting itinerary rendering');
console.error('[Renderer] Empty response from OpenAI');

// NEW:
import { log } from './logging';
log('renderer', 'info', 'Starting itinerary rendering');
log('renderer', 'error', 'Empty response from OpenAI');
```

**In `itinerary.ts`**:
```typescript
// OLD:
console.log('[Handler] Step 1: Validate and normalize input');
console.error('[Handler] Planning failed:', planningResult.error);

// NEW:
import { log } from './lib/logging';
log('handler', 'info', 'Validating input');
log('handler', 'error', 'Planning failed', planningResult.error);
```

---

## Phase 4: Simplify Endpoint Plan Validation Logging (30 minutes)

### Problem
Verbose nested if-statements for checking plan validity

### Solution
Extract to helper function

### Steps

**Create helper in `itinerary.ts`**:
```typescript
/**
 * Log planning result and validation status
 */
function logPlanningStatus(
  result: PlanningResult,
  repairAttempted: boolean
): boolean {
  if (!result.success) {
    log('handler', 'error', 'Planning failed', result.error);
    return false;
  }

  if (repairAttempted && result.repairResult) {
    const status = result.repairResult.success ? 'successful' : 'failed';
    log('handler', 'info', `Repair attempt ${status}`);
  }

  if (result.validationResult) {
    const { valid, score, issues } = result.validationResult;
    
    if (!valid) {
      const errorCount = issues.filter(i => i.severity === 'error').length;
      log('handler', 'warn', `Plan validation failed`, {
        score,
        errorCount,
      });
      
      issues
        .filter(i => i.severity === 'error')
        .forEach(issue => {
          log('handler', 'warn', `  ${issue.rule}: ${issue.message}`);
        });
    } else {
      log('handler', 'info', `Plan validation passed`, { score });
    }
  }

  return result.validationResult?.valid ?? false;
}
```

**Simplify endpoint**:
```typescript
// OLD: 20+ lines of nested if statements
let planIsValid = false;
if (planningResult.repairAttempted) { ... }
if (planningResult.success && planningResult.plan && planningResult.validationResult) { ... }

// NEW:
const planIsValid = logPlanningStatus(planningResult, planningResult.repairAttempted);
```

---

## Phase 5: Standardize Debug Function Names (15 minutes)

### Problem
Inconsistent naming patterns in debug functions

### Current Pattern Issues:
```typescript
debugLogNormalizedInput()       ✓ Good
debugLogTripContext()           ✓ Good
debugLogPlanningPromptMetadata()  ✗ Inconsistent (has "Metadata")
debugLogPlannerResponse()       ✗ Inconsistent (has "Response")
debugLogParseResult()           ✗ Inconsistent (has "Result")
```

### Suggested Naming Pattern:
```typescript
// Stage [Phase name]
debugLogValidation()            // Input validation
debugLogContext()               // Context computed
debugLogPlanningStart()         // Planning started
debugLogPlanningComplete()      // Planning complete (parse + validate)
debugLogRepair()                // Repair attempted
debugLogRendering()             // Rendering started
debugLogPipelineComplete()      // Full pipeline complete
```

### Changes in `lib/debug.ts`

Rename (find and replace):
- `debugLogPlanningPromptMetadata()` → `debugLogPlanningPrompt()`
- `debugLogPlannerResponse()` → `debugLogPlanningResponse()`
- `debugLogParseResult()` → `debugLogPlanningParse()`
- `debugLogValidationIssues()` → `debugLogPlanningValidation()`
- `debugLogRenderingMetadata()` → `debugLogRenderingPrompt()`
- `debugLogRenderingResponse()` → `debugLogRenderingComplete()`
- `debugLogPipelineSummary()` → `debugLogPipelineComplete()`

---

## Implementation Order Summary

```
1. Phase 1 (CRITICAL - 1 hour)
   ✓ Merge openai.ts → openaiService.ts
   ✓ Delete openai.ts
   ✓ Rename prompts.ts → fallbackPrompts.ts
   ✓ Update itinerary.ts imports

2. Phase 2 (IMPORTANT - 30 min)
   ✓ Rename format functions (6 functions across 5 files)
   ✓ Update all call sites

3. Phase 3 (NICE-TO-HAVE - 1 hour)
   ✓ Create lib/logging.ts
   ✓ Update ~20 console.log calls across 4 files

4. Phase 4 (NICE-TO-HAVE - 30 min)
   ✓ Extract logPlanningStatus()
   ✓ Simplify endpoint code

5. Phase 5 (OPTIONAL - 15 min)
   ✓ Rename debug functions
   ✓ Update all call sites

Total Time: ~2.5 hours for full cleanup
         OR 1.5 hours for Phases 1-2 (critical + important)
```

---

## Validation Checklist After Changes

After each phase, verify:

```
Phase 1 - Compilation
[ ] TypeScript compile with 0 errors
[ ] All imports resolve
[ ] API endpoint still works with fallback

Phase 2 - Naming
[ ] All renamed functions update everywhere
[ ] Module exports updated
[ ] Tests (if any) reference new names

Phase 3 - Logging Helper  
[ ] log() function called correctly
[ ] All modules imported logging helper
[ ] Console output unchanged

Phase 4 - Plan Logging
[ ] No change to actual logs (just simpler code)
[ ] Endpoint behavior identical

Phase 5 - Debug Names
[ ] Debug logs still work (if DEBUG=true)
[ ] All upstream callers updated
```

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 1 | Medium (deleting file) | Create backup first, test endpoint |
| 2 | Low (renaming) | Find-replace carefully, test |
| 3 | Low (new extraction) | Add logging.ts, gradually migrate calls |
| 4 | Low (refactoring) | Behavior identical, just cleaner code |
| 5 | Low (renaming) | Straightforward function renames |

---

## Quick Reference: Files to Modify

### Phase 1
- [ ] `api/lib/openaiService.ts` — Add fallback method
- [ ] `api/lib/fallbackPrompts.ts` — Rename from prompts.ts
- [ ] `api/itinerary.ts` — Update imports
- [ ] DELETE `api/lib/openai.ts`

### Phase 2
- [ ] `api/lib/date.ts` — 1 function
- [ ] `api/lib/validation.ts` — 1 function
- [ ] `api/lib/planParser.ts` — 1 function
- [ ] `api/lib/planValidator.ts` — 1 function
- [ ] `api/lib/planRepair.ts` — 1 function
- [ ] `api/lib/renderer.ts` — 1 function
- [ ] `api/lib/travelHeuristics.ts` — 1 function
- [ ] All call sites in other modules

### Phase 3
- [ ] `api/lib/logging.ts` — CREATE new file
- [ ] `api/lib/planner.ts` — Update imports + calls
- [ ] `api/lib/renderer.ts` — Update imports + calls
- [ ] `api/itinerary.ts` — Update imports + calls

### Phase 4
- [ ] `api/itinerary.ts` — Add helper, use in endpoint

### Phase 5
- [ ] `api/lib/debug.ts` — Rename 7 functions
- [ ] `api/lib/planner.ts` — Update calls
- [ ] `api/lib/renderer.ts` — Update calls
- [ ] `api/itinerary.ts` — Update calls

---

## Notes

- All changes are **backward compatible** in behavior
- Code now will be **more maintainable** and **clearer**
- No breaking changes to API response format
- Debug observability **improved**
