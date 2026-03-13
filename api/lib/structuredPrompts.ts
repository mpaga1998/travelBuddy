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
2. **EXACT NIGHT MATCHING REQUIRED**: nightsAllocated MUST equal nightsAvailable (${nights}). Count on your fingers. Verify twice.
3. **ACTIVITY TIME MUST BE EXACTLY ONE OF**: "morning", "afternoon", or "evening" (no variations like "night", "early afternoon", "late morning", etc.)
4. Each stop must have complete day-by-day breakdown with activities and time estimates
5. **IMPORTANT: Days = calendar days, Nights = sleeps. With ${nights} nights, you have ${nights + 1} calendar days (${nights} full days + 1 departure day)**
6. **Each day's "nights" field = how many nights you sleep AFTER that day. Final day must have "nights": 0 (you leave on departure day)**

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

2. **CRITICAL: You MUST END in the departure location**:
   - The itinerary MUST end in **${input.departure.location}** (arrival location: ${input.arrival.location})
   - This is NON-NEGOTIABLE. If you cannot get back to ${input.departure.location} in time, mark feasible: false
   - Plan your final stop so you can travel back to ${input.departure.location} and ARRIVE by evening on ${endDate}
   - Include travel time in the final day's activities (e.g., "Morning: explore X, Afternoon: travel back to ${input.departure.location}")
   - If the last stop is NOT ${input.departure.location}, the itinerary is INVALID

3. **Night allocation must be EXACT**: Sum of all stop totalNights must equal ${nights}
3. **Night allocation must be EXACT**: Sum of all stop totalNights must equal ${nights}
   - Do NOT allocate the same number of nights to each stop
   - Example GOOD splits: 3-3-1, 2-2-2-1, etc.
   - Example BAD splits: 7-7-7 (totals 21, not 8)

3b. **Day/Night Structure - CRITICAL**:
   - You have ${nights} nights to allocate
   - BUT you have ${nights + 1} calendar days (arrival day + ${nights} full days + departure day)
   - Example: Arrive 13/03, Depart 16/03 = 3 nights (13→14, 14→15, 15→16), 4 calendar days (13, 14, 15, 16)
   - Each day's "nights" = sleeps AFTER that day
   - Final day (${endDate}) should have activities + "nights": 0 (you're leaving that day/evening)
   - Allocate days across stops so you hit ${nights} total nights and end in ${input.departure.location}
   - **OPTIONAL: If the final stop is ${input.departure.location}, it CAN have totalNights: 0** (you arrive there for departure, no sleep)

4. **Work backwards from departure**:
   - Calculate REVERSE: start from ${endDate} in ${input.departure.location}, work backwards
   - If you're in Venice 2.5 hours away, you need to leave Venice by midday on 15/03 to arrive by evening on 16/03
   - Final stop might be a closer location than the furthest destinations

5. **Reality check transport times**:
   - Don't use Google Maps optimistic times - add buffer
   - Include actual driving/transit speeds, not straight-line distance
   - Consider time-of-day effects (morning traffic, evening fatigue)

6. **Be honest about feasibility**:
   - If ${nights} nights is too tight for the distance + attractions, say so
   - Better to suggest 1-2 fewer locations than pretend it's doable
   - If feasible: false, explain what to cut or adjust

7. **Daily breakdown requirements**:
   - Each day must have morning, afternoon, AND evening activities
   - **Activity "time" field MUST be EXACTLY ONE OF**: "morning", "afternoon", "evening"
   - DO NOT use: "night", "early afternoon", "late morning", "midday", or any variations
   - Include realistic time estimates (e.g., "2 hours", "1.5 hours")
   - Activities should match the travel pace (${input.travelPace})

8. **Transportation details**:
   - Between stops, include: mode (bus/taxi/flight), duration, and cost estimate
   - First stop: no transportFromPrevious (or mark as arrival)
   - Last stop must have travel back to ${input.departure.location} on final day

${firstName ? `\n9. **Personalization**: Use ${firstName}'s name when addressing the traveler throughout the itinerary.` : ''}

---

**Generate the itinerary now. Remember: ONLY JSON output inside triple backticks, nothing else.**`;
}
