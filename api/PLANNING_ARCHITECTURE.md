# Two-Stage Itinerary Generation: Planning + Rendering

## Overview

The generation flow now separates concerns:

```
Request (raw user input)
    ↓
validateAndNormalizeTripInput()
    ↓
computeTripContext()
    ↓
┌─────────────────────────────────────────────────────────┐
│ STAGE 1: PLANNING (Structured JSON)                    │
├─────────────────────────────────────────────────────────┤
│ Input: normalized input + trip context                 │
│ Process: route optimization, night allocation,         │
│          feasibility analysis                          │
│ Output: ItineraryPlan (JSON object)                   │
│                                                         │
│ planItinerary()                                        │
│  ├─ buildPlanningSystemPrompt() → constraints         │
│  ├─ buildPlanningUserPrompt() → trip facts            │
│  ├─ Call OpenAI (expect JSON only)                    │
│  ├─ parsePlanResponse()                               │
│  └─ validatePlan()                                    │
└─────────────────────────────────────────────────────────┘
    ↓
ItineraryPlan {
  isFeasible: boolean
  route: PlanStop[]
  transportSegments: TransportSegment[]
  warnings: string[]
  confidence: number
  ...
}
    ↓
┌─────────────────────────────────────────────────────────┐
│ STAGE 2: RENDERING (Markdown Output)                   │
├─────────────────────────────────────────────────────────┤
│ Input: plan object (+ context for future use)         │
│ Process: format stops, transport, activities          │
│ Output: readable markdown itinerary                   │
│                                                         │
│ generateItinerary() [or future renderItinerary()]     │
│  ├─ Format each stop                                  │
│  ├─ Include transport details                         │
│  └─ Output polished markdown                          │
└─────────────────────────────────────────────────────────┘
    ↓
Response { success: true, itinerary: markdown }
```

---

## Stage 1: Planning

### Types (`api/types/plan.ts`)

```typescript
interface PlanStop {
  location: string;
  startDay: number;    // 1-indexed
  endDay: number;      // inclusive
  nights: number;      // days sleeping (endDay - startDay)
  reason: string;      // why this stop
  highlights: string[]; // activities
  notes?: string;      // feasibility concerns
}

interface TransportSegment {
  from: string;
  to: string;
  departDay: number;   // day leaving origin
  duration: string;    // "3-4 hours"
  mode: string;        // "shared van", "flight", etc.
  costEstimate: string;// "~800 som"
  earlyStart: boolean; // whether early travel required
  departTime?: string; // "7:00 AM" if critical
  notes?: string;      // concerns
}

interface ItineraryPlan {
  isFeasible: boolean;
  summary: string;
  totalNights: number;
  totalCalendarDays: number;
  route: PlanStop[];
  transportSegments: TransportSegment[];
  issues: string[];           // blockers if !isFeasible
  warnings: string[];         // cautions even if feasible
  suggestedAlternatives: string[]; // cuts or changes if needed
  confidence: number;         // 0-10 planner confidence
  notes?: string;
}
```

### Planning System Prompt

```
You are a backpacker route planner. Your job: analyze a trip and produce a structured itinerary PLAN (as JSON) before any markdown rendering.

Think like a logistics expert:
- Check if the routing is feasible
- Allocate nights realistically
- Identify problematic legs
- Be honest about over-ambitious routes
- Suggest cuts or alternatives if needed

You will output ONLY valid JSON. No markdown, no text before/after.

[... JSON schema provided ...]

CRITICAL:
- If isFeasible = false, fill the "issues" array with reasons
- If feasible but risky, use "warnings" array
- "totalNights" MUST match the input total
- All days are 1-indexed
- Each stop's nights = endDay - startDay (exclusive end)
- Sum of all nights must equal totalNights
- transportSegments "departDay" is when they leave
- Return valid JSON only.
```

### Planning User Prompt

```
Plan {name}'s trip as JSON.

TRIP FACTS:
- Arrive: {date} in {location}
- Depart: {date} from {location}
- Total: {nights} nights, {calendarDays} calendar days
- Last overnight: {date}
- Planned stops: {stops joined}
- Pace: {pace}
- Wants: {attractions}
- Notes: {notes}

PLANNING RULES:
1. Must start in {arrivalLocation} on day 1
2. Must end in {departureLocation} on day {totalDays}
3. Last night is day {totalDays-1}
4. Route nights must sum to exactly {totalNights}
5. No leg on day {totalDays} should exceed 3 hours
6. Each transport segment needs: mode, duration, cost, early start
7. If routing infeasible, set isFeasible=false and explain

THINK:
- Is this ambitious or realistic?
- Can {nights} nights fit {stops} + travel?
- Are transfers doable without brutal days?
- Should stops be cut?

Output JSON only.
```

### Planning Function (`api/lib/planner.ts`)

```typescript
export async function planItinerary(
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string
): Promise<ItineraryPlan> {
  // 1. Build system + user prompts (specialized for planning)
  const systemPrompt = buildPlanningSystemPrompt();
  const userPrompt = buildPlanningUserPrompt(input, context, firstName);

  // 2. Call OpenAI (expects JSON output)
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  // 3. Parse + validate JSON
  const plan = parsePlanResponse(response.content);
  validatePlan(plan, context);

  return plan;
}
```

**Parsing:**
- Extracts JSON from response (handles GPT wrapping with text)
- Validates schema (all required fields present)
- Type checks (isFeasible is boolean, totalNights is number, route is array, etc.)

**Validation:**
- Check night math (route nights ≈ totalNights)
- Check start location = arrival, last stop = departure
- Check first day is 1
- Check confidence is 0-10
- Raises error if critical constraints violated

---

## Stage 2: Rendering (Future Work)

The `plan` object is now available but currently not used. Future work:

```typescript
// Future function:
export function renderPlanToMarkdown(
  plan: ItineraryPlan,
  context: TripContext
): string {
  // Use plan.route and plan.transportSegments
  // to construct final markdown, instead of re-deriving everything
}

// In endpoint:
const plan = await planItinerary(...);
const itinerary = await renderPlanToMarkdown(plan, context);
```

**Benefits of separating:**
- Plan is a clear contract between planning + rendering
- Can swap rendering (e.g., to JSON API response instead of markdown)
- Can inspect/validate plan before rendering
- Can implement A/B testing on rendering layer
- Multi-step refinements become possible (ask GPT to revise plan, then render)

---

## Integration into Endpoint

**Old flow:**
```
Validate → Normalize → Generate Itinerary → Return
```

**New flow:**
```
Validate → Normalize → Compute Context → PLAN → Generate Itinerary → Return
```

**Code (api/itinerary.ts):**
```typescript
export default async function handler(req, res) {
  // Step 1: Validate & normalize
  const validationResult = validateAndNormalizeTripInput(req.body);
  const normalizedInput = validationResult.data;

  // Step 2: Compute context (trip math)
  const context = computeTripContext(normalizedInput);

  // Step 3: Generate plan (NEW)
  let plan;
  try {
    plan = await planItinerary(normalizedInput, context, normalizedInput.userFirstName);
    console.log('[Handler] Plan:', summarizePlan(plan));
  } catch (planError) {
    console.error('[Handler] Planning failed:', planError);
    plan = null; // continue anyway for now
  }

  // Step 4: Generate itinerary (existing, TODO: refactor to use plan)
  const itinerary = await generateItinerary(normalizedInput, normalizedInput.userFirstName);

  // Return (API response unchanged)
  res.status(200).json({
    success: true,
    itinerary,
  });
}
```

---

## Example: Planning Output for 8-Day Multi-City Trip

**Request:**
```json
{
  "arrival": { "date": "2024-04-07", "location": "Bishkek" },
  "departure": { "date": "2024-04-15", "location": "Bishkek" },
  "stops": ["Issyk-Kul", "Osh"],
  "desiredAttractions": ["mountain hiking", "lake", "hiking trails"],
  "travelPace": "moderate"
}
```

**Plan Response:**
```json
{
  "isFeasible": true,
  "summary": "Bishkek → Issyk-Kul → Osh → Bishkek (8 nights, 9 days)",
  "totalNights": 8,
  "totalCalendarDays": 9,
  
  "route": [
    {
      "location": "Bishkek",
      "startDay": 1,
      "endDay": 3,
      "nights": 2,
      "reason": "Arrival, acclimatize, explore old town and Soviet monuments",
      "highlights": ["Ala-Too Square", "Bishkek ART Museum", "Osh Bazaar"],
      "notes": null
    },
    {
      "location": "Issyk-Kul Lake",
      "startDay": 4,
      "endDay": 6,
      "nights": 3,
      "reason": "Mountain lake, trekking, leisure",
      "highlights": ["Issyk-Kul shoreline", "Jyrgalan Valley trek", "local homestays"],
      "notes": "Good for active travelers, swimming season"
    },
    {
      "location": "Osh",
      "startDay": 7,
      "endDay": 8,
      "nights": 2,
      "reason": "Sulaiman Too hikes, bazaar, southern culture",
      "highlights": ["Sulaiman Too ancient site", "Osh Bazaar", "Sary Chelek trek day trip"],
      "notes": "Short to allow return to Bishkek"
    }
  ],
  
  "transportSegments": [
    {
      "from": "Bishkek",
      "to": "Issyk-Kul",
      "departDay": 3,
      "duration": "3-4 hours",
      "mode": "shared van",
      "costEstimate": "~800 som",
      "earlyStart": false,
      "departTime": null,
      "notes": "Mountain pass, road generally good"
    },
    {
      "from": "Issyk-Kul",
      "to": "Osh",
      "departDay": 6,
      "duration": "6-8 hours",
      "mode": "minibus",
      "costEstimate": "~1500 som",
      "earlyStart": true,
      "departTime": "6:00 AM",
      "notes": "Long day. Early start needed. Consider overnight minibus instead."
    },
    {
      "from": "Osh",
      "to": "Bishkek",
      "departDay": 8,
      "duration": "4-5 hours",
      "mode": "flight or van",
      "costEstimate": "Flight ~$80, Van ~2000 som",
      "earlyStart": false,
      "departTime": "noon max",
      "notes": "Last day. If flying, depart Osh morning. If van, maximum noon departure."
    }
  ],
  
  "issues": [],
  "warnings": [
    "Issyk-Kul to Osh leg is long (6-8 hours). Consider overnight minibus to avoid fatigue."
  ],
  "suggestedAlternatives": [
    "If time-limited: skip Osh, spend extra nights at Issyk-Kul for deeper trekking"
  ],
  
  "confidence": 8,
  "notes": "Solid routing for moderate pace. All constraints satisfied. Nights allocation is realistic."
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Client Request                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
                    validateAndNormalizeTripInput()
                                    ↓
                            NormalizedTripInput
                                    ↓
                           computeTripContext()
                                    ↓
                              TripContext { 
                                totalNights: 8
                                totalCalendarDays: 9
                                arrivalLocation: Bishkek
                                departureLocation: Bishkek
                                tripLengthCategory: long
                                ...
                              }
                                    ↓
                    ┌─────────────────────────────────────────┐
                    │ PLANNING STEP                           │
                    ├─────────────────────────────────────────┤
                    │ Input: normalizedInput + context        │
                    │ Prompts: buildPlanningSystemPrompt()   │
                    │          buildPlanningUserPrompt()     │
                    │ Output: JSON from GPT                  │
                    │ Parse: parsePlanResponse()             │
                    │ Validate: validatePlan()               │
                    └─────────────────────────────────────────┘
                                    ↓
                              ItineraryPlan {
                                isFeasible: true
                                route: PlanStop[]
                                transportSegments: TransportSegment[]
                                confidence: 8
                                ...
                              }
                                    ↓
                         [Plan stored but not used yet]
                                    ↓
                    ┌─────────────────────────────────────────┐
                    │ RENDERING STEP (TODO: use plan)        │
                    ├─────────────────────────────────────────┤
                    │ generateItinerary()                    │
                    │ → Returns markdown string              │
                    └─────────────────────────────────────────┘
                                    ↓
                       ItineraryResponse {
                         success: true
                         itinerary: "## Bishkek..."
                       }
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ Response sent to client (unchanged)                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Rendering Layer** — Refactor `generateItinerary()` to `renderItinerary()` that consumes ItineraryPlan
2. **Plan-Aware Requests** — Return plan data in response (for debugging/validation)
3. **Multi-Step Refinement** — Ask GPT to improve plan, resubmit before rendering
4. **Alternative Scenarios** — Generate multiple plans, let user choose
5. **Unit Tests** — Test `planItinerary()`, `parsePlanResponse()`, `validatePlan()`

---

## Error Handling

**If planning fails:**
- Try-catch in endpoint logs error but continues
- Falls back to original `generateItinerary()` (less optimized)
- Client receives markdown itinerary anyway (degraded but functional)

**If plan fails validation:**
- Raises error, caught in try-catch
- Endpoint logs reason
- Client receives 500 error

**Future:**
- If plan is infeasible, return plan + error response (allow client to show user why)
- Allow user to edit plan and regenerate
