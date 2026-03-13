/**
 * Day-based itinerary planning prompt
 * Explains structure to model: activities have explicit locations, travel is an activity
 */

import { TripInput } from './types.js';

export function buildDayBasedPlanningPrompt(
  input: TripInput,
  firstName?: string
): string {
  const nights = Math.ceil(
    (new Date(input.departure.date).getTime() -
      new Date(input.arrival.date).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const userStopsText =
    input.stops && input.stops.length > 0
      ? `\n- **REQUIRED STOPS (YOU MUST VISIT ALL):**\n${input.stops.map((s) => `  - ${s}`).join('\n')}`
      : '';

  const personalization = firstName ? `${firstName}'s` : 'the traveler\'s';

  return `You are an expert trip planner. Plan ${personalization} Italian trip.

CRITICAL RULES:
1. **REQUIRED STOPS** - MUST visit ALL these locations:
   - Start: ${input.arrival.location} (arriving ${input.arrival.date})
   - End: ${input.departure.location} (departing ${input.departure.date})${userStopsText}

2. **MUST RETURN to ${input.departure.location}** on the departure date

3. **DAYS vs NIGHTS**: ${nights} calendar days = ${nights - 1} nights (you sleep ${nights - 1} times)

4. **ACTIVITY LOCATIONS** - Every activity MUST have an explicit location:
   - Morning activity location
   - Afternoon activity location
   - Evening activity location
   - If locations differ, travel must be shown as an activity!

5. **TRAVEL IS AN ACTIVITY** - Not invisible:
   - Mark with "isTravel": true
   - Include: mode (train/bus/flight), duration, cost
   - Travel occupies time! (e.g., 2-hour train = less time at destination)

6. **VALID DAILY STRUCTURE**:
   - Option A: All activities in same location → sleep in that location
   - Option B: Morning in City A → Travel to City B (afternoon) → Evening in City B → Sleep in City B
   - NOT VALID: Morning in Milano, then "4pm in Firenze" without showing travel
   - NOT VALID: Activities in places you haven't arrived at yet

7. **LOGICAL LOCATION FLOW** - No teleportation:
   - Day 1 ends sleeping in: City X
   - Day 2 morning must be in City X OR show travel as morning activity
   - Can't appear in City Y without travel activity moving there

EXAMPLE - Mixed location day:
Day 2:
- Morning: Visit Duomo (Milano) - 2 hours
- Afternoon: 🚄 Train to Venice - 2 hours, €30-50 [isTravel: true]
- Evening: Explore St. Mark's Square (Venice) - 1.5 hours
Sleep: Venice

Required JSON format:
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
          "durationEstimate": "2 hours"
        },
        {
          "time": "afternoon",
          "location": "Milano",
          "description": "Shopping in Galleria Vittorio Emanuele II",
          "durationEstimate": "2 hours"
        },
        {
          "time": "evening",
          "location": "Milano",
          "description": "Dinner at a local restaurant",
          "durationEstimate": "2 hours"
        }
      ],
      "sleep": {
        "location": "Milano"
      }
    },
    {
      "dayNumber": 2,
      "activities": [
        {
          "time": "morning",
          "location": "Milano",
          "description": "Breakfast and last minute shopping",
          "durationEstimate": "2 hours"
        },
        {
          "time": "afternoon",
          "location": "Venice",
          "description": "🚄 Train from Milano Central to Venice",
          "durationEstimate": "2 hours",
          "isTravel": true,
          "travelMode": "train",
          "costEstimate": "€30-50"
        },
        {
          "time": "evening",
          "location": "Venice",
          "description": "Explore Grand Canal and St. Mark's Square",
          "durationEstimate": "2 hours"
        }
      ],
      "sleep": {
        "location": "Venice"
      }
    }
  ],
  "constraints": {
    "startDate": "${input.arrival.date}",
    "endDate": "${input.departure.date}",
    "arrivalLocation": "${input.arrival.location}",
    "departureLocation": "${input.departure.location}",
    "nightsAvailable": ${nights - 1},
    "nightsAllocated": ${nights - 1}
  },
  "feasibilityNotes": "Optional notes about constraints or recommendations"
}

${input.desiredAttractions ? `\nDESIRED ATTRACTIONS:\n${input.desiredAttractions}\n` : ''}

Plan an amazing trip! Ensure all activities have explicit locations and travel is shown as activities.`;
}
