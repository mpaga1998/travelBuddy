/**
 * Day-based itinerary planning prompt
 * Includes travel time realism + pacing guidance based on user's travel pace
 */

import { TripInput } from './types.js';

/**
 * Normalize location name: "Milano, Milan, Italy" -> "Milano"
 * Extracts only the first part (city name) before any commas
 */
function normalizeLocationName(location: string): string {
  if (!location) return location;
  return location.split(',')[0].trim();
}

function getPacingGuidance(pace?: string): { maxHours: number; description: string } {
  switch (pace) {
    case 'relaxed':
      return {
        maxHours: 5,
        description: 'Relaxed pace - 4-5 hours of activities per day, lots of free time for meals, cafes, exploring at leisure',
      };
    case 'active':
      return {
        maxHours: 9,
        description:
          'Active pace - 8-9 hours of structured activities per day, efficient scheduling, early starts and late finishes',
      };
    case 'moderate':
    default:
      return {
        maxHours: 7,
        description:
          'Moderate pace - 6-7 hours of activities per day, balanced between seeing things and having downtime',
      };
  }
}

export function buildDayBasedPlanningPrompt(
  input: TripInput,
  firstName?: string
): string {
  const nights = Math.ceil(
    (new Date(input.departure.date).getTime() -
      new Date(input.arrival.date).getTime()) /
      (1000 * 60 * 60 * 24)
  );
  
  const calendarDays = nights + 1; // Night difference + 1 = total calendar days
  const nightsToAllocate = Math.max(1, nights - 1); // Nights allocated = calendar nights minus departure day

  // Normalize all location names: "Milano, Milan, Italy" -> "Milano"
  const arrivalLocation = normalizeLocationName(input.arrival.location);
  const departureLocation = normalizeLocationName(input.departure.location);
  const normalizedStops = input.stops?.map(s => normalizeLocationName(s)) || [];

  const userStopsText =
    normalizedStops.length > 0
      ? `\n- **REQUIRED STOPS (YOU MUST VISIT ALL):**\n${normalizedStops.map((s) => `  - ${s}`).join('\n')}`
      : '';

  const desiredAttractionsText =
    input.desiredAttractions && input.desiredAttractions.length > 0
      ? `\n- **OPTIONAL PLACES TO VISIT (if feasible):**\n${input.desiredAttractions.map((a) => `  - ${a}`).join('\n')}\n  → Integrate these as DAY TRIPS from the main route if possible\n  → DO NOT create multi-day detours for optional attractions\n  → If time/proximity doesn't allow, leave them out`
      : '';

  const personalization = firstName ? `${firstName}'s` : 'the traveler\'s';
  const pacing = getPacingGuidance(input.travelPace);
  
  // Extract destination from arrival location or stops
  const destination = arrivalLocation || (normalizedStops?.[0] || 'the destination');
  
  // Add time information to arrival/departure
  const arrivalTimeInfo = input.arrival.time ? ` in the ${input.arrival.time}` : '';
  const departureTimeInfo = input.departure.time ? ` in the ${input.departure.time}` : '';

  return `You are an expert trip planner. Plan ${personalization} trip to ${destination} with ${pacing.description.toLowerCase()}.

🔴 **ABSOLUTELY CRITICAL - RULES YOU MUST FOLLOW OR OUTPUT WILL BE REJECTED:**

1. **ACTIVITY TIME VALUES - EXACTLY THREE ALLOWED, NO EXCEPTIONS:**
   ✅ VALID ONLY: "morning", "afternoon", "night" 
   ❌ DO NOT USE THESE: "evening", "early afternoon", "late night", "midday", "early morning", "late morning", or ANY other text
   → Every activity.time MUST be exactly one of: "morning" OR "afternoon" OR "night"
   → Case-sensitive and lowercase
   → This is verified automatically - invalid times = REJECTED

2. **NIGHT ALLOCATION - MUST BE EXACT:**
   - Trip: ${input.arrival.date} → ${input.departure.date}
   - Calendar days: ${calendarDays}
   - Nights to sleep: ${nightsToAllocate}
   - Your constraints.nightsAllocated MUST = ${nightsToAllocate} (verify by counting: ${nightsToAllocate} sleeps)
   - Off-by-one errors = REJECTED immediately

3. **PRIMARY ROUTE - MUST INCLUDE ALL:**
   - Start: ${arrivalLocation} (arriving ${input.arrival.date}${arrivalTimeInfo})
   - End: ${departureLocation} (departing ${input.departure.date}${departureTimeInfo})${userStopsText}${desiredAttractionsText}

4. **MUST END IN ${departureLocation}** on departure date - this is verified. Missing it = REJECTED.

5. **ARRIVAL & DEPARTURE TIMING - CLEAR TIME WINDOW LOGIC:**

   **GOLDEN RULE:** Activities can ONLY occur in time periods AFTER arrival or BEFORE departure.
   
   **DAY 1 (${input.arrival.date}) - User arrives in the "${input.arrival.time}"**:
   ${input.arrival.time === 'morning' ? 
     `✅ Activities allowed: AFTERNOON + NIGHT (user has free time after morning arrival)
     Example: AFTERNOON - reach city center & accommodation | NIGHT - activity or rest` 
   : input.arrival.time === 'afternoon' ? 
     `✅ Activities allowed: NIGHT ONLY (user arrives afternoon, rest after)
     Example: AFTERNOON - accommodation & settle in | NIGHT - light activity or rest
     ❌ DO NOT: Include any "morning" activities on Day 1` 
   : input.arrival.time === 'night' ? 
     `✅ Activities: CHECK-IN/ARRIVAL ONLY (1 activity with time="night")
     ❌ DO NOT: Include any planning/sightseeing activities on Day 1 (user sleeps after late arrival)
     Example: NIGHT - check-in accommodation & rest` 
   : `✅ Activities allowed: morning, afternoon, night (full day)`}
   
   **FINAL DAY (${input.departure.date}) - User departs in the "${input.departure.time}"**:
   ${input.departure.time === 'morning' ? 
     `✅ Activities: DEPARTURE ONLY (user leaves in morning, no time for activities)
     ❌ DO NOT: Include any "morning", "afternoon", or "night" activities
     Example: MORNING - travel to airport/station | DEPART` 
   : input.departure.time === 'afternoon' ? 
     `✅ Activities allowed: MORNING ONLY (activities before afternoon departure)
     ❌ DO NOT: Include "afternoon" or "night" activities on final day
     Example: MORNING - Activity Y | AFTERNOON - travel to departure point` 
   : input.departure.time === 'night' ? 
     `✅ Activities allowed: MORNING + AFTERNOON (full day before night departure)
     Example: MORNING - Activity A | AFTERNOON - Activity B | EVENING - travel to station | NIGHT - DEPART` 
   : `✅ Activities allowed: morning, afternoon, night (full day)`}

6. **CALENDAR DAYS REQUIREMENT:**
   - Generate exactly ${calendarDays} days (dayNumber 1 through ${calendarDays})
   - One day per calendar date
   - Do NOT skip days, do NOT combine days
   - Final day can have night="departure" or null

7. **DAILY PACING - ${input.travelPace?.toUpperCase() || 'MODERATE'} PACE:**
   - Max activity hours: ${pacing.maxHours} hours/day (${pacing.description.toLowerCase()})
   - Travel time COUNTS toward the limit
   - Don't overpack

8. **TRAVEL REALISM:**
   - Milano ↔ Venice: 2.5 hours
   - Milano ↔ Firenze: 2 hours
   - Venice ↔ Firenze: 3.5 hours
   - Como ↔ Milano: 1 hour

9. **ACTIVITY STRUCTURE - EACH DAY MUST HAVE:**
   - activities array with time: "morning", "afternoon", "night" (valid values only)
   - Each activity has: location, description, durationEstimate
   - sleep object with location where user sleeps that night

10. **NO TELEPORTATION:**
    - Can't do activities in places you haven't traveled to
    - Morning activity is where you slept the previous night (or arrival city on Day 1)
    - If changing cities, travel must be an afternoon or night activity

---

REQUIRED JSON STRUCTURE (EXACT FORMAT):
\`\`\`json
{
  "feasible": true,
  "days": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "time": "morning",
          "location": "Milano",
          "description": "Arrive and visit Duomo",
          "durationEstimate": "1.5 hours"
        },
        {
          "time": "afternoon",
          "location": "Milano",
          "description": "Galleria shopping",
          "durationEstimate": "2 hours"
        },
        {
          "time": "night",
          "location": "Milano",
          "description": "Dinner at Navigli",
          "durationEstimate": "1.5 hours"
        }
      ],
      "sleep": {
        "location": "Milano"
      }
    }
  ],
  "constraints": {
    "startDate": "${input.arrival.date}",
    "endDate": "${input.departure.date}",
    "arrivalLocation": "${arrivalLocation}",
    "departureLocation": "${departureLocation}",
    "nightsAvailable": ${nightsToAllocate},
    "nightsAllocated": ${nightsToAllocate}
  },
  "feasibilityNotes": "Optional"
}
\`\`\`

Remember: ONLY these three values for "time": "morning", "afternoon", "evening"
nightsAllocated must equal ${nightsToAllocate}
Generate exactly ${calendarDays} days

Now plan the itinerary:`
}
