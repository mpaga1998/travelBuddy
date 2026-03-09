/**
 * TRIP CONTEXT INTEGRATION - CODE WALKTHROUGH
 * 
 * This file demonstrates how the new trip context system works end-to-end.
 * It's for documentation purposes - NOT meant to be executed.
 */

// ============================================================================
// STEP 1: REQUEST ARRIVES AT ENDPOINT
// ============================================================================

// User sends POST /api/itinerary with body:
{
  "arrival": { "date": "2024-04-07", "location": "Bishkek" },
  "departure": { "date": "2024-04-15", "location": "Bishkek" },
  "desiredAttractions": ["Mountain hiking", "Lake", "Local food"],
  "stops": ["Issyk-Kul", "Osh"],
  "travelPace": "moderate",
  "userFirstName": "Alex"
}

// ============================================================================
// STEP 2: VALIDATION & NORMALIZATION (api/itinerary.ts)
// ============================================================================

// Old: validateTripInput(req.body) → string | null
// New: validateAndNormalizeTripInput(req.body) → ValidationResult

const validationResult = validateAndNormalizeTripInput(req.body);
// Returns:
{
  valid: true,
  data: {
    // All strings trimmed
    // All arrays cleaned of empty strings
    // Defaults applied (travelPace already provided, so kept as-is)
    // Dates validated as YYYY-MM-DD
    // Departure confirmed > arrival
    
    userId: undefined,
    userFirstName: "Alex",
    arrival: {
      date: "2024-04-07",
      location: "Bishkek"
    },
    departure: {
      date: "2024-04-15", 
      location: "Bishkek"
    },
    stops: ["Issyk-Kul", "Osh"],
    desiredAttractions: ["Mountain hiking", "Lake", "Local food"],
    travelPace: "moderate",
    budget: undefined,
    interests: undefined,
    notes: undefined
  }
}

// ============================================================================
// STEP 3: TRIP CONTEXT COMPUTATION (api/lib/tripContext.ts)
// ============================================================================

const context = computeTripContext(validationResult.data);

// Returns TripContext with ALL calculations pre-computed:
{
  // Parsed dates (safe, deterministic)
  arrivalDate: Date(2024-04-07),      // JavaScript Date object
  departureDate: Date(2024-04-15),    // JavaScript Date object
  arrivalDateStr: "2024-04-07",       // Reference string
  departureDateStr: "2024-04-15",     // Reference string

  // Duration metrics
  totalNights: 8,                     // April 7-8, 8-9, 9-10, 10-11, 11-12, 12-13, 13-14, 14-15 = 8 nights
  totalCalendarDays: 9,               // April 7, 8, 9, 10, 11, 12, 13, 14, 15 = 9 calendar days
  
  // Last night calculation
  // For 8 nights starting April 7:
  // Arrivals = April 7 (Day 1)
  // Nights = April 7, 8, 9, 10, 11, 12, 13, 14 (8 nights)
  // Last overnight date = April 14 (the 8th night)
  // Departure = April 15 (morning/day-of after last night)
  lastOvernightDate: Date(2024-04-14),
  lastOvernightDateStr: "2024-04-14",

  // Locations
  arrivalLocation: "Bishkek",
  departureLocation: "Bishkek",
  sameArrivalDepartureLocation: true,   // Same city → circular route

  // Categorization
  tripLengthCategory: "medium",         // 8 nights = medium (4-7 boundary, this is 8 so actually "long")
  // Wait, let me recalculate: short (1-3), medium (4-7), long (8+)
  // 8 nights = "long"
  tripLengthCategory: "long",

  // Multi-city analysis
  stopCount: 2,                         // Issyk-Kul, Osh
  isMultiCity: true
}

// ============================================================================
// STEP 4: PROMPT BUILDING (api/lib/prompts.ts)
// ============================================================================

// OLD FLOW:
// buildUserPrompt(input, "Alex") {
//   const arrivalDate = parseISODate(input.arrival.date);
//   const departureDate = parseISODate(input.departure.date);
//   const nights = calculateNights(arrivalDate, departureDate);
//   const long = isLongTrip(nights);
//   ... build prompts with locally calculated values ...
// }

// NEW FLOW:
const userPrompt = buildUserPrompt(normalizedInput, context, "Alex");

// Inside buildUserPrompt:
// - Get tripLengthCategory from context → decide format (day-by-day vs regional)
// - Use context.totalNights, context.totalCalendarDays directly → NO recalculation
// - Use context.arrivalDate for date formatting → safe, deterministic
// - No date parsing happens in prompts, all was done earlier

// Resulting user prompt for this trip:
`Hey Alex! Building your 9-day trip (8 nights)...

**TRIP CONSTRAINTS:**
- Arrive: Sunday, April 7, 2024 in Bishkek
- Depart: Monday, April 15, 2024 from Bishkek
- Stops: Issyk-Kul, Osh
- Total: 8 nights on the ground
- Pace: Balanced pace
- Budget: (Not specified)

**WANT TO SEE:**
- Mountain hiking
- Lake
- Local food

**YOUR MISSION:**
1. Figure out which cities/regions can realistically fit in 8 nights. Be honest if it's too ambitious.
2. Allocate nights across locations (e.g., 3-3-1 split across 3 cities, not 7-7-7).
3. Include transport times between every stop. Don't hide the travel.
4. Remember: You must END in Bishkek on your final day. Plan return logistics carefully.
5. For each location, show real daily breakdown with time estimates.
6. If it's a tight squeeze, say so and suggest alternatives.

Use Alex's name throughout. Be realistic. Quality over coverage.`

// ============================================================================
// STEP 5: OPENAI GENERATION (api/lib/openai.ts)
// ============================================================================

const itinerary = await generateItinerary(normalizedInput, "Alex");

// Inside generateItinerary:
// 1. Compute context: context = computeTripContext(normalizedInput)
// 2. Build system prompt: buildSystemPrompt() [unchanged]
// 3. Build user prompt: buildUserPrompt(normalizedInput, context, "Alex") [with context]
// 4. Call OpenAI API with both prompts
// 5. Return itinerary

// GPT receives the prompt with ALL computed values, formats choices, etc.
// Returns something like:

`## Bishkek | Days 1-3 | 3 nights
...

## Issyk-Kul Lake | Days 4-6 | 3 nights
...

## Osh | Days 7-8 | 2 nights
...`

// ============================================================================
// WHAT CHANGED: THE AGGREGATION LAYER
// ============================================================================

// BEFORE:
// - Validation: minimal (required fields only)
// - Prompt building: re-calculated dates, nights, trip category
// - OpenAI call: received raw input

// AFTER:
// - Validation: comprehensive with 13+ checks + normalization
// - Context computation: single source of truth for all trip math
// - Prompt building: consumes pre-computed context, no derivation
// - OpenAI call: receives normalized data + precomputed context

// Benefits:
// ✅ DRY: trip calculations happen once, in one place (tripContext.ts)
// ✅ Type-safe: TripContext interface guarantees all fields present
// ✅ Deterministic: safe date parsing, no ambiguous JS Date() usage
// ✅ Maintainable: to add a new trip metric, add to TripContext, use it everywhere
// ✅ Testable: computeTripContext has no side effects, pure function
// ✅ Auditable: logs show category/nights/structure for debugging

// ============================================================================
// EXAMPLE: ADDING A NEW METRIC
// ============================================================================

// Say you want "hasInternationalTravel" (departure !== arrival location)

// STEP 1: Add to TripContext interface (api/lib/tripContext.ts)
// export interface TripContext {
//   ...existing fields...
//   hasInternationalTravel: boolean;  // NEW
// }

// STEP 2: Compute it in computeTripContext
// const hasInternationalTravel = !sameArrivalDepartureLocation;

// STEP 3: Use it anywhere in prompts, context, or logs
// if (context.hasInternationalTravel) {
//   userPrompt += "\n**NOTE: International travel detected - include visa info**";
// }

// That's it. No need to thread it through 5 functions. It's part of context.

// ============================================================================
// DATES: NIGHTS VS CALENDAR DAYS EXPLAINED
// ============================================================================

// Example: Arrive Monday 7th, Depart Friday 11th

// Tuesday  <-- Night 1
// Wednesday <-- Night 2
// Thursday <-- Night 3
// Friday morning = depart

// totalNights = 3
// totalCalendarDays = 5 (Mon, Tue, Wed, Thu, Fri)

// Use for itinerary: "Your 5-day trip" or "5 days in Kyrgyzstan"
// Use for sleeping: "3 nights" or "You'll spend nights in..."

// ============================================================================
// TRIP LENGTH CATEGORY: THE THREE-TIER SYSTEM
// ============================================================================

// short (1-3 nights)
// - Format: Day-by-day breakdown
// - Example message: "For your 2-day quick visit..."
// - GPT gets: buildDayByDayMission()

// medium (4-7 nights)
// - Format: Regional breakdown
// - Example message: "For your week in Kyrgyzstan..."
// - GPT gets: buildRegionalMission()

// long (8+ nights)
// - Format: Regional breakdown
// - Example message: "For your extended 12-day tour..."
// - GPT gets: buildRegionalMission()

// Note: 8 nights = 9 calendar days, so "9-day trip" messaging but "8 nights" for calculations
