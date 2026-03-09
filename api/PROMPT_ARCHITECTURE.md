# Prompt Architecture: Layered Approach

## Overview

The new prompt system separates concerns into three distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│ SYSTEM PROMPT (Universal across all trips)                  │
│ - Hard Constraints (what MUST be true)                      │
│ - Output Format (how to structure the response)             │
│                                                              │
│ This never changes per trip. It's the "constitution."       │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│ USER PROMPT (Specific to this trip)                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SECTION 1: TRIP FACTS                                   │ │
│ │ (Objective data from TripContext)                       │ │
│ │ - Dates, locations, nights count, stops, preferences   │ │
│ │                                                         │ │
│ │ PURPOSE: GPT knows the exact constraints               │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SECTION 2: PLANNING MISSION                             │ │
│ │ (Heuristics: how to approach THIS trip)                │ │
│ │ - Adapted for trip length (short vs multi-city)        │ │
│ │ - Specific instructions for this trip type             │ │
│ │                                                         │ │
│ │ PURPOSE: GPT knows the strategy for this specific trip │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SECTION 3: SUCCESS CRITERIA                             │ │
│ │ (What "good" looks like)                               │ │
│ │ - Checklist of success metrics specific to this trip   │ │
│ │                                                         │ │
│ │ PURPOSE: GPT knows what to optimize for                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                             ↓
                      GPT Response
```

---

## EXAMPLE 1: Short Trip (2 Days, Bishkek)

### System Prompt Sent
```
You are a backpacker trip planner expert. Your job: build realistic, logistically-sound itineraries that travelers can actually execute.

## HARD CONSTRAINTS (Non-Negotiable)

1. **Night Math Must Match** - You are given a total night count. The sum of nights across all locations MUST equal this total. No shortcuts.

2. **Departure Logic** - Work backwards from the last day:
   - The traveler must END in the departure location on the final night
   - The last overnight date was calculated on the backend
   - If departing from Bishkek on April 15, they must be back in Bishkek by April 14 evening
   - Plan travel time TO the departure location on the final day

3. **No Unrealistic Routing** - You cannot:
   - Suggest a 5+ hour journey on departure day (too risky, unfeasible)
   - Repeat the same night count for every stop
   - Ignore travel time between stops
   - If routing is infeasible, say so explicitly and suggest alternatives

4. **Transport Visibility** - Every leg between stops MUST show:
   - Estimated travel time (realistic, not optimistic)
   - Transport mode (van, minibus, flight, etc.)
   - Cost estimate if available
   - Early start times if needed

## OUTPUT FORMAT

Structure each location as:

\`\`\`
## [Location] | Days X-Y | Z nights
[Day-by-day activities with time estimates]

Transport to [Next Destination]: [Mode], [Duration], ~[Cost]
\`\`\`

For short trips (1-3 days): Include hour-by-hour breakdown
For extended trips (4+ days): Day summaries with key highlights

Use markdown for readability. Minimal emojis (headers only).
```

### User Prompt Sent
```
Hey Alex! Let's build your 2-day trip.

## TRIP FACTS
- **Arrival**: Sunday, April 7, 2024 in Bishkek
- **Departure**: Monday, April 8, 2024 from Bishkek
- **Duration**: 2 calendar days | 1 night of sleep
- **Last overnight**: Sunday, April 7
- **Pace**: relaxed pace (fewer moves, deep immersion)
- **Wants to see**: Old town, cafes, local markets

## YOUR MISSION

Plan realistically. Quality matters more than coverage.

1. Create a realistic day-by-day breakdown (all 2 days).
2. For each day: show morning, afternoon, evening with actual TIME estimates.
3. For Alex's final day: schedule return to Bishkek by 1 PM latest (leaves room for delays).
4. Be honest: if 2 days feels rushed, say what to cut.
5. Prioritize: depth of experience over breadth of coverage.

**Remember**: Day 2 = final day. You must be BACK in Bishkek to depart.

## SUCCESS LOOKS LIKE

✓ Each location has a specific night count that adds up to 1
✓ Transport between stops is visible and time-budgeted
✓ No day is overloaded with 6+ hours of travel
✓ Return to Bishkek on Day 2 is feasible
✓ Activities are backpacker-friendly (social, local experiences where possible)

If any of these can't be satisfied: flag the issue and propose a better route.
```

---

## EXAMPLE 2: Multi-City Trip (8 Days, 3 Stops)

### System Prompt Sent
(Same as above—universal)

### User Prompt Sent
```
Hey Alex! Let's build your 9-day trip.

## TRIP FACTS
- **Arrival**: Sunday, April 7, 2024 in Bishkek
- **Departure**: Monday, April 15, 2024 from Bishkek
- **Duration**: 9 calendar days | 8 nights of sleep
- **Last overnight**: Sunday, April 14
- **Planned stops**: Issyk-Kul, Osh
- **Trip style**: Circular route (start and end same city)
- **Pace**: moderate pace (balance activity and rest)
- **Wants to see**: Mountain hiking, trekking, remote regions, local village stays
- **Notes**: First time in Central Asia, open to adventure but need some comfort

## YOUR MISSION

Plan realistically. Quality matters more than coverage.

1. Map out the route realistically: 2 stops in 8 nights.
2. Allocate nights across locations (not equal per stop—shorter for travel days, longer for favorites).
3. For every leg: show transport mode, duration, cost estimate, and required start time.
4. Night math: show how you're allocating the 8 nights. They must sum exactly.
5. Be honest: if the routing is infeasible, propose alternatives (cut a stop, add time, adjust pace).
6. Final leg: Day 9 return to Bishkek must be achievable (show the timeline).

**Remember**: Day 9 = final day. You must be BACK in Bishkek to depart.

⚠️ **Tight squeeze**: 2 stops in 8 nights is aggressive. If it doesn't fit, say so and suggest cuts.

## SUCCESS LOOKS LIKE

✓ Each location has a specific night count that adds up to 8
✓ Transport between stops is visible and time-budgeted
✓ No day is overloaded with 6+ hours of travel
✓ Return to Bishkek on Day 9 is feasible
✓ Activities are backpacker-friendly (social, local experiences where possible)

If any of these can't be satisfied: flag the issue and propose a better route.
```

---

## Why This Architecture Works

### 1. System Prompt: Hard Constraints

**What it does:** Defines NON-NEGOTIABLE rules that apply to EVERY trip.

**Rules covered:**
- Night math MUST sum correctly
- Departure location logic MUST be respected
- Unrealistic routing MUST be rejected
- Transport visibility MUST be included

**Why it matters:**
- GPT never forgets the fundamental math
- Prevents vague or infeasible suggestions
- Output format is predictable

**Changed from old:** Old prompt mixed constraints with trip-specific examples. New version is shorter, universal, and constraint-focused.

### 2. Section 1: Trip Facts

**What it does:** Presents objective, pre-computed data from the backend.

**Data included:**
- Exact dates (already formatted by `formatDate()`)
- Total nights and calendar days (computed by `computeTripContext()`)
- Last overnight date (computed, not re-derived)
- Stops, preferences, notes

**Why it matters:**
- No re-derivation of dates or calculations
- GPT has exact numbers (e.g., "8 nights" not "approximately a week")
- Prevents "new information" from changing mid-response

**Changed from old:** Old prompt buried facts in narrative text. New version uses a clean bullet list—parseable, unambiguous.

### 3. Section 2: Planning Mission

**What it does:** Adapts planning heuristics to THIS trip's characteristics.

**Adapts based on:**
- Trip length category (short vs medium vs long)
- Multi-city status (single location vs multiple stops)
- Available nights relative to complexity

**Examples:**

**Short trip (1-3 nights):**
```
1. Create a realistic day-by-day breakdown (all 2 days).
2. For each day: show morning, afternoon, evening with actual TIME estimates.
...
```

**Multi-city trip (4+ nights):**
```
1. Map out the route realistically: 2 stops in 8 nights.
2. Allocate nights across locations (not equal per stop—shorter for travel days, longer for favorites).
...
```

**Why it matters:**
- Instructions are tailored, not generic
- GPT doesn't waste tokens on irrelevant strategies
- Different trip types get different guidance

**Changed from old:** Old prompt had two separate functions (`buildDayByDayMission` vs `buildLongTripMission`). New version has one adaptive function that chooses the right path.

### 4. Section 3: Success Criteria

**What it does:** Defines what "good" looks like, specific to THIS trip.

**Checklist:**
- ✓ Nights sum to total
- ✓ Transport is visible
- ✓ No brutal travel days
- ✓ Return logistics is feasible
- ✓ Experiences are backpacker-friendly

**Why it matters:**
- GPT has a concrete checklist to validate against
- Encourages self-correction ("If any of these can't be satisfied...")
- Measurable success criteria

**Changed from old:** Old prompt implied success but didn't state it explicitly. New version gives GPT a scorecard.

---

## Comparing Old vs New: Revision Example

### Old Approach
```
**USER PROMPT (Mixed, longer, repetitive):**

- Arrival: Sunday, April 7, 2024 in Bishkek
- Depart: Monday, April 15, 2024 from Bishkek
- Stops: Issyk-Kul, Osh
- Total: 8 nights on the ground
- Pace: Balanced pace
- Budget: (Not specified)
- Wants to see: Mountain hiking, Trekking, Remote regions
- Notes: First time...

YOUR MISSION:
1. Figure out which cities/regions can realistically fit in 8 nights. Be honest if it's too ambitious.
2. Allocate nights across locations (e.g., 3-3-1 split...).
3. Include transport times between every stop. Don't hide the travel.
4. Remember: You must END in Bishkek on your final day. Plan return logistics.
5. For each location, show real daily breakdown with time estimates.
6. If it's a tight squeeze, say so and suggest alternatives.

Use Alex's name throughout. Be realistic. Quality over coverage.
```

**Problems:**
- Facts + strategy + tone mixed together
- Generic format (doesn't adapt to trip type)
- No explicit success criteria
- Name usage instruction separate from mission
- 350+ words of narrative

### New Approach
```
**USER PROMPT (Layered, shorter, adaptive):**

## TRIP FACTS
- **Arrival**: Sunday, April 7, 2024 in Bishkek
- **Departure**: Monday, April 15, 2024 from Bishkek
- **Duration**: 9 calendar days | 8 nights of sleep
- **Last overnight**: Sunday, April 14
- **Planned stops**: Issyk-Kul, Osh
- **Trip style**: Circular route
- **Pace**: moderate pace (balance activity and rest)
- **Wants to see**: Mountain hiking, Trekking, Remote regions

## YOUR MISSION
Plan realistically. Quality matters more than coverage.

1. Map out the route realistically: 2 stops in 8 nights.
2. Allocate nights across locations (shorter for travel days, longer for favorites).
3. For every leg: transport mode, duration, cost estimate, start time.
4. Night math: show how you're allocating 8 nights. They must sum exactly.
5. Be honest: if routing is infeasible, propose alternatives.
6. Final leg: Day 9 return to Bishkek must be achievable.

**Remember**: Day 9 = final day. You must be BACK in Bishkek to depart.

⚠️ **Tight squeeze**: 2 stops in 8 nights is aggressive. If it doesn't fit, flag it.

## SUCCESS LOOKS LIKE
✓ Each location has specific night count that sums to 8
✓ Transport between stops is visible and time-budgeted
✓ No day overloaded with 6+ hours travel
✓ Return to Bishkek on Day 9 is feasible
✓ Activities are backpacker-friendly

If these can't be satisfied: flag and propose better route.
```

**Improvements:**
- 30% fewer words
- Clear section headers
- Facts section is parseable (use → bullet format)
- Mission section is numbered and specific
- Success criteria explicitly listed
- Warnings highlighted with ⚠️
- All dates pre-computed (no re-derivation)

---

## Data Flow

```
Request arrives with raw dates/preferences
         ↓
validateAndNormalizeTripInput()
         ↓
NormalizedTripInput (clean, validated data)
         ↓
computeTripContext() ← (SINGLE PLACE for all trip math)
         ↓
TripContext {
  totalNights, totalCalendarDays, lastOvernightDate,
  tripLengthCategory, isMultiCity, ...
}
         ↓
buildUserPrompt(input, context)
    ├─ buildTripFactsSection() ← pulls from context, no re-calculation
    ├─ buildPlanningMissionSection() ← adapts based on tripLengthCategory
    └─ buildSuccessCriteriaSection() ← references context values
         ↓
User Prompt (fully formed, context-aware)
         ↓
buildSystemPrompt() [unchanged, universal]
         ↓
Both prompts → OpenAI API
         ↓
Itinerary response
```

---

## Key Principles

1. **No Re-Derivation:**
   - Trip math happens once in `computeTripContext()`
   - Prompts consume pre-computed values
   - Dates use safe ISO-8601 parsing, formatted once

2. **Layered Concerns:**
   - System prompt: constraints + format (universal)
   - Trip facts: objective data (specific)
   - Planning mission: heuristics (adaptive)
   - Success criteria: measurable goals (specific)

3. **Adaptivity:**
   - Mission section changes based on `tripLengthCategory`
   - Warning for tight squeezes based on stops/nights
   - Different instructions for short vs multi-city

4. **Clarity:**
   - Each section has one purpose
   - No nested instructions
   - Success criteria are explicit, not implied

5. **Efficiency:**
   - Shorter prompts (less token usage)
   - More structured (easier for GPT to parse)
   - Less repetition (old prompt mentioned "trip is tight" multiple times)
