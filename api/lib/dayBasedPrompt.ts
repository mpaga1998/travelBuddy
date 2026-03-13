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

⚠️ CRITICAL: The arrival and departure times are ABSOLUTE and NON-NEGOTIABLE. Plan Day 1 and final day strictly around them.

CRITICAL RULES:

1. **PRIMARY ROUTE** - MUST visit ALL these locations (the core itinerary):
   - Start: ${arrivalLocation} (arriving ${input.arrival.date}${arrivalTimeInfo})
   - End: ${departureLocation} (departing ${input.departure.date}${departureTimeInfo})${userStopsText}${desiredAttractionsText}

2. **MUST RETURN to ${departureLocation}** on the departure date

3. **ARRIVAL & DEPARTURE TIMING** - CRITICAL, MUST FOLLOW:
   - Arrival: ${input.arrival.time ? `The user arrives in the ${input.arrival.time}` : 'Check when the user arrives'}
   - Departure: ${input.departure.time ? `The user departs in the ${input.departure.time}` : 'Check when the user departs'}
   
   **DAY 1 ACTIVITIES (BASED ON ARRIVAL TIME)**:
   ${input.arrival.time === 'morning' ? 
     `- Morning arrival: Plan full day starting morning (user has whole day)
     - Include morning, afternoon, and evening activities
     - Travel to ${arrivalLocation} counts as morning activity` 
   : input.arrival.time === 'afternoon' ? 
     `- Afternoon arrival: DO NOT plan morning activities
     - Day 1 should be: Arrival/check-in + evening activity only
     - Start main activities on Day 2
     - MANDATORY: No morning activities on Day 1` 
   : input.arrival.time === 'night' ? 
     `- Night arrival: Only include arrival/check-in activity on Day 1
     - Day 1: Just one activity - "Arrive at accommodation and rest" or similar check-in
     - NO sightseeing or tourist activities on Day 1
     - Start all sightseeing activities on Day 2 morning
     - MANDATORY: Only check-in/rest, no other activities` 
   : ''}
   
   **FINAL DAY ACTIVITIES (BASED ON DEPARTURE TIME)**:
   ${input.departure.time === 'morning' ? 
     `- Morning departure: DO NOT plan afternoon/evening activities on final day
     - Final day: Morning activity only, then travel
     - MANDATORY: No afternoon or evening activities` 
   : input.departure.time === 'afternoon' ? 
     `- Afternoon departure: DO NOT plan evening activities on final day
     - Final day: Morning activities + Lunch/early afternoon + Travel to airport/station
     - Then depart in afternoon (before evening)
     - MANDATORY: No evening activities
     - Example: Morning museum (2h) + Lunch (1.5h) + travel to airport (1h) = done by 2-3pm` 
   : input.departure.time === 'night' ? 
     `- Night departure: Plan FULL day on final day
     - Final day: Full morning, afternoon, evening activities + depart night
     - MANDATORY: Include full day of activities` 
   : ''}

4. **DAYS vs NIGHTS**: ${calendarDays} calendar days, ${nights} nights available
   - CRITICAL: Generate exactly ${calendarDays} days in the itinerary (one for each calendar day from ${input.arrival.date} to ${input.departure.date})
   - Sleep ${nights} times (nights allocated = ${nights})
   - Each day gets dayNumber 1 through ${calendarDays}
   - Do NOT skip any days, do NOT combine days

5. **DAILY PACING - ${input.travelPace?.toUpperCase() || 'MODERATE'} PACE**:
   - Maximum activity time: ${pacing.maxHours} hours per day
   - This includes: museums, attractions, meals, activities (EXCLUDES sleep)
   - Travel time counts toward the daily total!
   - Example: 2-hour travel + 3-hour museum = ${pacing.maxHours - 2} hours left for other activities
   - DO NOT pack more than ${pacing.maxHours} hours into one day

5. **REALISTIC TRAVEL TIMES** - Use these actual travel times:
   - Milano ↔ Venice (train): 2.5 hours
   - Milano ↔ Firenze (train): 2 hours
   - Venice ↔ Firenze (train): 3.5 hours
   - Como ↔ Milano (train): 1 hour
   - Lake Como boat tours: 1-2 hours
   - DO NOT suggest unrealistic times like "30 mins" or "1 hour" between distant cities

6. **ACTIVITY LOCATIONS** - Every activity MUST have an explicit location:
   - Morning activity location
   - Afternoon activity location
   - Evening activity location
   - If locations differ, travel MUST be shown as an activity!

7. **TRAVEL IS AN ACTIVITY** - Not invisible:
   - Mark with "isTravel": true
   - Include: mode (train/bus/flight), duration, cost
   - Travel occupies time! (e.g., 2.5-hour train to Venice = less time for Venice activities)

8. **VALID DAILY STRUCTURE**:
   - Option A: All activities in same location → sleep in that location
   - Option B: Morning in City A → Travel to City B (afternoon/evening) → Evening activities in City B → Sleep in City B
   - NOT VALID: Morning activity, then travel, then another activity without accounting for travel time
   - NOT VALID: Activities in places you haven't arrived at yet

9. **LOGICAL LOCATION FLOW** - No teleportation:
   - Day 1 ends sleeping in: City X
   - Day 2 morning must be in City X OR show travel as morning activity
   - Can't appear in City Y without travel activity moving there

10. **REALISTIC SCHEDULING**:
    - Morning: Start activities 9-10am after breakfast
    - Travel day morning: breakfast + light activity OR prep for travel
    - Lunch: 1-2 hours (often included in activity time)
    - Afternoon: 2-3 hour activity window (museums close by 5-6pm in peak season)
    - Evening: dinner 1.5-2 hours + casual stroll
    - Sleep: 11pm-8am

PACING EXAMPLES:

**Relaxed (${pacing.maxHours}hr max):**
Day 1 in Venice:
- Morning: Basilica di San Marco (1.5 hrs)
- Lunch: Rialto Market (1.5 hrs)
- Afternoon: Free time, walking around
- Evening: Dinner
- Sleep: Venice
TOTAL: 3 hours structured activity

**Moderate (7hr max):**
Day 1 in Venice, Day 2 travel to Firenze:
- Day 1:
  - Morning: Basilica di San Marco (1.5 hrs)
  - Afternoon: Doge's Palace (1.5 hrs)
  - Evening: Dinner (1.5 hrs)
  - Sleep: Venice
  TOTAL: 4.5 hours

- Day 2:
  - Morning: Rialto Market (1.5 hrs)
  - Afternoon: 🚄 Train to Firenze (3.5 hrs travel)
  - Evening: Walk city, dinner (1 hr)
  - Sleep: Firenze
  TOTAL: 6 hours (including travel)

**Active (${pacing.maxHours}hr max):**
- Early start 8am, packed schedule until 9pm
- Multiple major attractions in one day
- Example Milano: Duomo (1.5 hrs) + Brera Museum (2.5 hrs) + Lunch (1 hr) + Galleria (1 hr) + Dinner (1.5 hrs) = 7.5 hours

REQUIRED JSON FORMAT:
{
  "feasible": true,
  "days": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "time": "morning",
          "location": "Milano",
          "description": "Visit Duomo Cathedral",
          "durationEstimate": "1.5 hours"
        },
        {
          "time": "afternoon",
          "location": "Milano",
          "description": "Lunch and shopping in Galleria Vittorio Emanuele II",
          "durationEstimate": "2 hours"
        },
        {
          "time": "evening",
          "location": "Milano",
          "description": "Dinner near Navigli canal district",
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
    "nightsAvailable": ${nights - 1},
    "nightsAllocated": ${nights - 1}
  },
  "feasibilityNotes": "Optional notes about constraints or recommendations"
}

${input.desiredAttractions ? `\nUSER'S INTERESTS:\n${input.desiredAttractions}\n` : ''}

Plan an amazing trip! Respect the ${pacing.maxHours}-hour daily limit. Use realistic travel times. Ensure all activities have explicit locations.`;
}
