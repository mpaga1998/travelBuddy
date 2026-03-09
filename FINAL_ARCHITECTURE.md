# Final Itinerary Generation Architecture

## Overview

A two-stage, production-ready itinerary generation system with comprehensive validation, repair, and rendering capabilities.

---

## Architecture Diagram

```
HTTP Request (Post /api/itinerary)
    ↓
┌─────────────────────────────────────────────────────────┐
│  Endpoint Handler (itinerary.ts)                        │
│  - CORS headers                                         │
│  - Route validation                                     │
│  - Error handling + response formatting                │
└───────────────┬──────────────────────────────────────────┘
                ↓
        ┌───────────────────┐
        │ STAGE 1: VALIDATE │
        └───────┬───────────┘
                ↓
    ┌───────────────────────────┐
    │ Validate & Normalize    │ (validation.ts)
    │ - 13+ input constraints │
    │ - Normalize data types │
    │ - Return: NormalizedTripInput
    └───────┬───────────────────┘
            ↓
    ┌───────────────────────────┐
    │ Compute Trip Context    │ (tripContext.ts)
    │ - Calculate nights      │
    │ - Determine category    │
    │ - Multi-city detection  │
    │ - Return: TripContext  │
    └───────┬───────────────────┘
            ↓
        ┌────────────────────┐
        │ STAGE 2: PLAN     │
        └────┬───────────────┘
            ↓
    ┌────────────────────────────────────┐
    │ Get Travel Heuristics            │ (travelHeuristics.ts)
    │ - Destination-aware rules        │
    │ - Transfer times, borders, pace  │
    │ - Region-specific constraints    │
    └────────┬───────────────────────────┘
             ↓
    ┌────────────────────────────────────┐
    │ Build Planning Prompts           │ (planningPrompts.ts)
    │ - System prompt: JSON format     │
    │ - User prompt: constraints       │
    │ - Inject heuristics              │
    └────────┬───────────────────────────┘
             ↓
    ┌────────────────────────────────────┐
    │ OpenAI API Call                  │ (openaiService.ts)
    │ - Planning model                 │
    │ - Configurable temperature/tokens│
    │ - Return: Raw response           │
    └────────┬───────────────────────────┘
             ↓
    ┌────────────────────────────────────┐
    │ Parse JSON Response              │ (planParser.ts)
    │ - 3-level validation:            │
    │   1. JSON extraction             │
    │   2. Schema validation           │
    │   3. Constraint validation       │
    │ - Return: ItineraryPlan or errors
    └────────┬───────────────────────────┘
             ↓
    ┌────────────────────────────────────┐
    │ Validate Business Rules          │ (planValidator.ts)
    │ - 7+ rules (nights match, etc.)  │
    │ - Calculate confidence score     │
    │ - Return: valid/issues/warnings  │
    └────────┬───────────────────────────┘
             ↓
        REPAIR DECISION?
             ↓
    ┌─────────────────────────────────────┐
    │ IF: Infeasible or very low score  │
    │     THEN: Attempt Repair          │ (planRepair.ts)
    │           - Inject error feedback │
    │           - Single attempt (no retry)
    │           - Re-validate           │
    │     ELSE: Skip repair             │
    └────────┬────────────────────────────┘
             ↓
    Plan Status: Valid ✓
             ↓
        ┌────────────────────┐
        │ STAGE 3: RENDER   │
        └────┬───────────────┘
            ↓
    ┌────────────────────────────────────┐
    │ Build Rendering Prompts          │ (renderingPrompts.ts)
    │ - System prompt: Travel writer   │
    │ - User prompt: Structured plan   │
    │ - Ensure plan is canonical truth │
    └────────┬───────────────────────────┘
             ↓
    ┌────────────────────────────────────┐
    │ OpenAI API Call                  │ (openaiService.ts)
    │ - Rendering model                │
    │ - Configurable temperature/tokens│
    │ - Return: Markdown text          │
    └────────┬───────────────────────────┘
             ↓
    ┌────────────────────────────────────┐
    │ Render to Markdown               │ (renderer.ts)
    │ - Convert plan to engaging copy  │
    │ - Return: Markdown string        │
    └────────┬───────────────────────────┘
             ↓
        ┌──────────────────┐
        │ FALLBACK CHECK  │
        └────┬─────────────┘
             ↓
    IF: No valid plan or rendering failed
    THEN: Use fallback generation (openaiService.ts)
    ELSE: Return rendered markdown
             ↓
        ┌──────────────┐
        │ DEBUG LOG   │ (debug.ts)
        │ - Optional  │ (guarded by DEBUG env var)
        │ - Structured│ (module prefixes)
        │ - Safe      │ (secrets redacted)
        └──────┬───────┘
               ↓
        ┌──────────────┐
        │ HTTP 200    │
        │ Success = OK│
        │ Itinerary   │ (markdown)
        └──────────────┘
```

---

## Module Responsibilities

### Tier 1: HTTP & Orchestration

#### `itinerary.ts` — Main Handler
- **In**: HTTP POST request with trip parameters
- **Out**: HTTP response (200 with markdown or error code)
- **Job**: 
  - CORS headers
  - Route validation (POST only)
  - Orchestrate all stages
  - Error handling + fallback
  - Response formatting

#### Dependencies: All lib modules

---

### Tier 2: Input Processing

#### `validation.ts` — Input Validation
- **In**: Request body (unknown)
- **Out**: `ValidationResult` with `NormalizedTripInput` or errors
- **Job**:
  - 13+ input constraint checks
  - Type coercion (strings → dates, numbers, etc.)
  - Normalization (trim, lowercase, etc.)
  - Discriminated union error types
  - Collect all errors before returning

**Exports**:
- `validateAndNormalizeTripInput(input)` 
- `formatValidationErrors(errors)` → logging helper

**Uses**:
- `date.ts` for date parsing

---

#### `tripContext.ts` — Trip Math
- **In**: `NormalizedTripInput`
- **Out**: `TripContext` with computed trip metrics
- **Job**:
  - Calculate total nights (arrival to departure)
  - Determine trip category (short/medium/long)
  - Detect multi-city trips
  - Flag return trips (same arrival/departure)
  - Compute last overnight date
  - Provide trip descriptions

**Exports**:
- `computeTripContext(input)` → `TripContext`
- `describeTripDuration(context)` → string
- `describeTripStructure(context)` → string

**Uses**:
- `date.ts` for math

**Key Interface**:
```typescript
interface TripContext {
  totalNights: number
  calendarDays: number
  tripCategory: 'short' | 'medium' | 'long'
  isMultiCity: boolean
  isReturnTrip: boolean
  lastOvernightDate: string
  startDay: number
  endDay: number
  dateRange: { arrival: string; departure: string }
  stopCount: number
}
```

---

### Tier 3: Planning Stage

#### `travelHeuristics.ts` — Destination Knowledge
- **In**: `NormalizedTripInput` + `TripContext`
- **Out**: `TripHeuristics` (region-specific rules)
- **Job**:
  - Identify destination region (SE Asia, Europe, S. Asia, etc.)
  - Extract destination-aware heuristics:
    - Transfer times between cities
    - Border crossing rules
    - Transport recommendations
    - Regional scheduling wisdom
    - Pace-specific constraints
  - Format for prompt injection

**Exports**:
- `getTravelHeuristics(input, context)` → `TripHeuristics`
- `formatHeuristicsForPrompt(heuristics)` → markdown
- `summarizeHeuristics(heuristics)` → string

**Key Data**:
```typescript
interface TravelHeuristic {
  category: 'transfer_time' | 'border_crossing' | ... // 10+ categories
  location: string
  rule: string
  severity: 'caution' | 'warning' | 'critical'
  regions: string[]
  applicablePaces: ('relaxed' | 'moderate' | 'active')[]
}
```

---

#### `planningPrompts.ts` — Prompts for Planning
- **In**: `NormalizedTripInput`, `TripContext`, heuristics text
- **Out**: Structured system + user prompts
- **Job**:
  - Build strict JSON format instructions (system prompt)
  - Build constraints + facts + heuristics (user prompt)
  - Ensure model outputs machine-readable JSON

**Exports**:
- `buildPlanningSystemPrompt()` → strict JSON instructions
- `buildPlanningUserPrompt(input, context, firstName, heuristics)` → structured facts
- `buildRepairSystemPrompt()` → repair specialist instructions
- `buildRepairUserPrompt(plan, issues, context, input, heuristics)` → repair request

---

#### `planner.ts` — Planning Orchestrator (CORE)
- **In**: `NormalizedTripInput`, `TripContext`, optional firstName, maxRetries
- **Out**: `PlanningResult` (plan or detailed error)
- **Job**:
  - Get travel heuristics
  - Build planning prompts
  - Call OpenAI with retry logic
  - Parse JSON response
  - Validate business rules
  - If invalid: attempt repair (once)
  - Return structured result

**Exports**:
- `planItinerary(input, context, firstName?, maxRetries?)` → `PlanningResult`
- `summarizePlan(plan)` → string

**Key Interface**:
```typescript
interface PlanningResult {
  success: boolean
  plan?: ItineraryPlan          // Structured plan
  error?: string                 // If failed
  validationResult?: PlanValidationResult
  repairAttempted?: boolean
  repairResult?: RepairResult
  retryable: boolean
}
```

---

#### `planParser.ts` — JSON Parser (3-level validation)
- **In**: Raw OpenAI response string + `TripContext`
- **Out**: `ParseResult` with `ItineraryPlan` or errors
- **Job**:
  - Level 1: Extract JSON from response
  - Level 2: Validate JSON schema
  - Level 3: Validate business constraints
  - Return detailed errors if any step fails

**Exports**:
- `parsePlanResponse(content, context)` → `ParseResult`
- `formatParseErrorsForLogging(errors)` → string

---

#### `planValidator.ts` — Business Rule Validator
- **In**: `ItineraryPlan` + `NormalizedTripInput` + `TripContext`
- **Out**: `PlanValidationResult` with score and issues
- **Job**:
  - Run 7+ business rules:
    1. Total nights match expected
    2. Minimum stops present
    3. No negative or zero nights
    4. Final stop compatible with departure
    5. Return journey logic correct
    6. Transport segment coherence
    7. Infeasibility explanation
    8. Day ordering continuous
  - Calculate confidence score (0-100)
  - Separate errors from warnings

**Exports**:
- `validatePlanBusinessRules(plan, input, context)` → `PlanValidationResult`
- `formatValidationIssuesForLogging(result)` → string

**Key Interface**:
```typescript
interface PlanValidationResult {
  valid: boolean                    // No critical errors
  issues: PlanValidationIssue[]     // All issues
  warnings: PlanValidationIssue[]   // Warnings only
  score: number                     // 0-100 confidence
  summary: string
}
```

---

#### `planRepair.ts` — Plan Repair (Single Attempt)
- **In**: Invalid `ItineraryPlan` + validation issues + context
- **Out**: `RepairResult` with repaired plan or failure reason
- **Job**:
  - Build repair prompts (specialist instructions + feedback)
  - Call OpenAI once (no retry)
  - Parse and validate repaired plan
  - Return before/after comparison

**Exports**:
- `repairPlan(plan, issues, input, context, heuristics?)` → `RepairResult`
- `formatRepairResultForLogging(result)` → string

**Key Interface**:
```typescript
interface RepairResult {
  success: boolean
  repairedPlan?: ItineraryPlan
  repairMessage: string
  originalErrorCount: number
  repairErrorCount: number
}
```

---

### Tier 4: Rendering Stage

#### `renderingPrompts.ts` — Prompts for Rendering
- **In**: `ItineraryPlan`, `NormalizedTripInput`, `TripContext`
- **Out**: System + user prompts for markdown generation
- **Job**:
  - Build travel writer instructions (system)
  - Provide structured plan as canonical truth (user)
  - Ensure model expands plan into engaging markdown

**Exports**:
- `buildRenderingSystemPrompt()` → travel writer instructions
- `buildRenderingUserPrompt(plan, input, context, firstName)` → structured facts

---

#### `renderer.ts` — Plan to Markdown Converter
- **In**: Valid `ItineraryPlan` + input + context
- **Out**: `RenderingResult` with markdown or error
- **Job**:
  - Build rendering prompts
  - Call OpenAI to expand plan
  - Return markdown string

**Exports**:
- `renderItinerary(plan, input, context, firstName?)` → `RenderingResult`
- `formatRenderingResultForLogging(result)` → string

**Key Interface**:
```typescript
interface RenderingResult {
  success: boolean
  markdown?: string              // Final itinerary
  error?: string                 // If failed
}
```

---

### Tier 5: API & Services

#### `openaiService.ts` — OpenAI API Centralization (NEW RECOMMENDATION)
- **In**: `OpenAIRequest` (system + user prompts)
- **Out**: `OpenAIResponse` (content + tokens + model)
- **Job**:
  - Singleton service for all OpenAI calls
  - Three separate endpoints: planning, repair, rendering
  - Configurable models, temperatures, tokens
  - Call timeout handling
  - Token usage tracking (optional)
  - **NEW**: Add fallback generation method

**Exports**:
- `class OpenAIService` with:
  - `callPlanning(request)` → `OpenAIResponse`
  - `callRepair(request)` → `OpenAIResponse`
  - `callRendering(request)` → `OpenAIResponse`
  - `callGenerateFallback(input, firstName)` → `OpenAIResponse` **(new)**
- `buildOpenAIConfig(env)` → `OpenAIServiceConfig`
- `initializeOpenAIService(env)` → singleton
- `getOpenAIService()` → singleton

**Removes Need For**:
- `openai.ts` (old fallback generation) — DELETE after merge

---

#### `fallbackPrompts.ts` — Fallback Prompts (RENAMED from `prompts.ts`)
- **In**: `NormalizedTripInput`, `TripContext`
- **Out**: System + user prompts for free-form generation
- **Job**:
  - Build prompts for fallback generation
  - Used when plan/rendering fails
  - Same format as original simple generation

**Exports**:
- `buildFallbackSystemPrompt()` → string
- `buildFallbackUserPrompt(input, context, firstName)` → string

---

### Tier 6: Utilities & Support

#### `debug.ts` — Observability & Logging
- **In**: Various pipeline state objects
- **Out**: Structured console logs (when DEBUG enabled)
- **Job**:
  - Environment-based debug configuration
  - Optional guidance logging for each stage
  - Safe redaction of secrets (API keys, names, budget)
  - Zero overhead when disabled

**Exports**:
- `buildDebugConfig(env)` → `DebugConfig`
- `initializeDebugConfig(env)` → void (sets singleton)
- `isDebugEnabled()` → boolean
- `debugLog*()` functions (11 different stages)
- Helper functions for redaction

**Environment Variables**:
- `DEBUG=true/false` — Enable/disable
- `DEBUG_VERBOSE=true/false` — Show full prompts

---

#### `logging.ts` — Logging Helper (NEW RECOMMENDATION)
- **In**: Module name, log level, message, optional data
- **Out**: Formatted console output
- **Job**:
  - Centralized logging with module prefixes
  - Consistent format across codebase
  - Convenience functions (logInfo, logWarn, etc.)

**Exports**:
- `log(module, level, message, data?)` → void
- `logInfo()`, `logWarn()`, `logError()`, `logDebug()` conveniences

---

#### `date.ts` — Date Utilities
- **In**: Date objects, date strings
- **Out**: Formatted strings, parsed dates, calculations
- **Job**:
  - Consistent date formatting
  - ISO date parsing
  - Night calculations
  - Trip length classification

**Exports**:
- `formatDateForDisplay(date)` → string
- `parseISODate(dateString)` → Date
- `calculateNights(startDate, endDate)` → number
- `isLongTrip(nights)` → boolean

---

### Type Definitions

#### `types/trip.ts`
```typescript
// Input types
interface TripInput { ... }
interface NormalizedTripInput { ... }

// Validation types
interface ValidationError { ... }
interface ValidationResult { ... }

// Response type
interface ItineraryResponse { ... }
```

#### `types/plan.ts`
```typescript
interface ItineraryPlan { ... }
interface PlanStop { ... }
interface TransportSegment { ... }
```

---

## Data Flow Summary

```
TripInput
  ↓ (validation.ts)
NormalizedTripInput
  ↓ (tripContext.ts)
TripContext
  ↓ + input.stops
TripHeuristics (travelHeuristics.ts)
  ↓
ItineraryPlan (via planner.ts → parser.ts → validator.ts → repair.ts)
  ↓ (renderer.ts)
Markdown String
  ↓
HTTP 200 Response
```

---

## Error Handling Strategy

1. **Validation Stage**: Collect all errors, return before proceeding
2. **Planning Stage**: Parse errors → immediate fail (retryable)
3. **Parsing Stage**: Invalid JSON → retry if attempts remaining
4. **Validation Stage**: Business rule failure → attempt repair (once)
5. **Rendering Stage**: Empty markdown → use fallback generation
6. **Fallback**: If all fails → return fallback markdown or error

---

## Configuration via Environment

```bash
# OpenAI Models (optional, defaults provided)
OPENAI_PLANNING_MODEL=gpt-3.5-turbo
OPENAI_REPAIR_MODEL=gpt-3.5-turbo
OPENAI_RENDERING_MODEL=gpt-3.5-turbo

# Temperature Settings
OPENAI_PLANNING_TEMPERATURE=0.7
OPENAI_REPAIR_TEMPERATURE=0.5
OPENAI_RENDERING_TEMPERATURE=0.7

# Token Limits
OPENAI_PLANNING_MAX_TOKENS=2000
OPENAI_REPAIR_MAX_TOKENS=2000
OPENAI_RENDERING_MAX_TOKENS=3000

# Timeout
OPENAI_TIMEOUT_MS=30000

# Debug
DEBUG=false          # Enable debug logs
DEBUG_VERBOSE=false  # Show full prompts/responses
```

---

## Production Checklist

```
✅ Type Safety
   - All modules fully typed
   - No 'any' types
   - Discriminated unions for errors

✅ Error Handling
   - All async wrapped in try/catch
   - Validation errors collected
   - Fallback generation for failures

✅ Performance
   - Trip context computed once
   - Validation before expensive API calls
   - Single repair attempt (no exponential retry)
   - Debug logging guarded (zero overhead)

✅ Security
   - Input validation comprehensive
   - Secrets redacted from logs
   - User data safe (names, budget not exposed)
   - Error messages non-revealing

✅ Observability
   - Optional debug logging
   - Environment-based configuration
   - Structured with module prefixes
   - Detailed error context

✅ Maintainability
   - Clear separation of concerns
   - Single responsibility per module
   - Consistent interfaces
   - Comprehensive documentation

⚠️  Recommendations (low-priority cleanup)
   - Merge duplicate OpenAI implementations
   - Standardize naming patterns
   - Extract logging helper
```

---

## For Next Session

**If proceeding with cleanup** (see CLEANUP_ACTION_PLAN.md):

Priority 1: Merge OpenAI implementations (critical duplication)
Priority 2: Standardize naming (consistency)
Priority 3: Extract logging helpers (maintainability)

**If not cleaning up**: System is production-ready as-is.
