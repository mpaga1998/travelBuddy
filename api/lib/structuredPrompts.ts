/**
 * Structured planning prompts - generates JSON output instead of freetext
 */

import { TripInput } from './types.js';
import { formatDate } from './date.js';
import { calculateNights } from './inputValidation.js';

export function buildStructuredPlanningPrompt(
  input: TripInput,
  firstName?: string
): string {
  const arrival = new Date(input.arrival.date);
  const departure = new Date(input.departure.date);
  const nights = calculateNights(input);
  const startDate = formatDate(arrival);
  const endDate = formatDate(departure);

  return `You are an expert backpacker trip planner. Your job: create a realistic, JSON-formatted itinerary.

**CRITICAL INSTRUCTIONS:**
1. Return ONLY valid JSON wrapped in triple backticks (no other text before/after)
2. Double-check that nightsAllocated matches nightsAvailable
3. If the trip is infeasible, set "feasible": false and explain in feasibilityNotes
4. Each stop must have complete day-by-day breakdown with activities and time estimates

**RESPONSE MUST BE VALID JSON:**
\`\`\`json
{
  "feasible": true,
  "feasibilityNotes": "Optional explanation of constraints or why infeasible",
  "stops": [
    {
      "location": "City Name",
      "totalNights": 3,
      "transportFromPrevious": {
        "mode": "bus",
        "duration": "3 hours",
        "costEstimate": "$50-80"
      },
      "days": [
        {
          "dayNumber": 1,
          "location": "City Name",
          "nights": 1,
          "activities": [
            {
              "time": "morning",
              "description": "Activity description",
              "durationEstimate": "2 hours"
            }
          ]
        }
      ]
    }
  ],
  "constraints": {
    "startDate": "${input.arrival.date}",
    "endDate": "${input.departure.date}",
    "nightsAvailable": ${nights},
    "nightsAllocated": ${nights}
  }
}
\`\`\`

---

**TRIP PARAMETERS:**
- Arrive: ${startDate} in **${input.arrival.location}**
- Depart: ${endDate} from **${input.departure.location}**
- Total: **${nights} nights** available
${input.stops && input.stops.length > 0 ? `- **REQUIRED STOPS (YOU MUST VISIT ALL):** ${input.stops.join(', ')}` : '- No specific stops requested - suggest logical route'}
- Travel pace: ${input.travelPace === 'relaxed' ? '🐢 Relaxed' : input.travelPace === 'active' ? '⚡ Active' : '⚖️ Balanced'}
- Budget tier: ${input.budget || 'flexible'}

${input.desiredAttractions && input.desiredAttractions.length > 0 ? `**ATTRACTIONS TO INCLUDE:**
${input.desiredAttractions.map((attr) => `- ${attr}`).join('\n')}` : '(No specific attractions specified - create a flexible itinerary)'}

${input.notes ? `**ADDITIONAL NOTES:** ${input.notes}` : ''}

---

**PLANNING RULES:**

1. **MANDATORY: Include all user-requested stops**:
   - If user specified stops (${input.stops && input.stops.length > 0 ? `${input.stops.join(', ')}` : 'any'}), EVERY stop must appear in your itinerary
   - Do NOT substitute, skip, or replace user stops with alternatives
   - Do NOT add extra stops beyond what the user requested (unless feasibility is false)
   - The stops array must contain exactly the locations user specified

2. **Night allocation must be EXACT**: Sum of all stop totalNights must equal ${nights}
   - Do NOT allocate the same number of nights to each stop
   - Example GOOD splits: 3-3-1, 2-2-2-1, etc.
   - Example BAD splits: 7-7-7 (totals 21, not 8)

2. **Work backwards from departure**:
   - You must END in ${input.departure.location} by evening on ${endDate}
   - Last stop should allow travel back on final day
   - Calculate travel time from final destination back to ${input.departure.location}

3. **Reality check transport times**:
   - Don't use Google Maps optimistic times - add buffer
   - Include actual driving/transit speeds, not straight-line distance
   - Consider time-of-day effects (morning traffic, evening fatigue)

4. **Be honest about feasibility**:
   - If ${nights} nights is too tight for the distance + attractions, say so
   - Better to suggest 1-2 fewer locations than pretend it's doable
   - If feasible: false, explain what to cut or adjust

5. **Daily breakdown requirements**:
   - Each day must have morning, afternoon, AND evening activities
   - Include realistic time estimates (e.g., "2 hours", "1.5 hours")
   - Activities should match the travel pace (${input.travelPace})

6. **Transportation details**:
   - Between stops, include: mode (bus/taxi/flight), duration, and cost estimate
   - First stop: no transportFromPrevious (or mark as arrival)
   - Last transport should arrive at ${input.departure.location} by ${endDate} evening

${firstName ? `\n7. **Personalization**: Use ${firstName}'s name when addressing the traveler throughout the itinerary.` : ''}

---

**Generate the itinerary now. Remember: ONLY JSON output inside triple backticks, nothing else.**`;
}
