/**
 * Day-based structured itinerary prompt
 * Activities have explicit locations - travel is an activity, not implicit
 */

import { TripInput } from './types.js';
import { formatDate } from './date.js';
import { calculateNights } from './inputValidation.js';

export function buildDayBasedPlanningPrompt(
  input: TripInput,
  firstName?: string
): string {
  const arrival = new Date(input.arrival.date);
  const departure = new Date(input.departure.date);
  const nights = calculateNights(input);
  const startDate = formatDate(arrival);
  const endDate = formatDate(departure);

  return `You are an expert backpacker trip planner. Your job: create a realistic, day-by-day JSON itinerary where travel IS an activity.

**KEY DIFFERENCE: Activities have explicit locations. Travel is NOT implicit - it's an activity with time/cost.**

**CRITICAL INSTRUCTIONS:**
1. Return ONLY valid JSON wrapped in triple backticks (no other text before/after)
2. Each activity MUST have a location field
3. Travel activities: set "isTravel": true, "travelMode": "train|bus|flight", include "costEstimate"
4. Days are flexible - can have activities in multiple locations (with travel between)
5. Each day must have morning, afternoon, and/or evening activities
6. Account for travel TIME in duration estimates - if you travel 1.5 hours, that counts as 1.5 hours
7. Ensure all sleep happens in valid locations (don't sleep in airports or trains)

**RESPONSE MUST BE VALID JSON:**
\`\`\`json
{
  "feasible": true,
  "feasibilityNotes": "Optional explanation",
  "days": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "time": "morning",
          "location": "Milano, Milan, Italy",
          "description": "Arrival and check-in at hotel",
          "durationEstimate": "2 hours"
        },
        {
          "time": "afternoon",
          "location": "Milano, Milan, Italy",
          "description": "Visit Duomo di Milano",
          "durationEstimate": "3 hours"
        },
        {
          "time": "evening",
          "location": "Milano, Milan, Italy",
          "description": "Dinner at local trattoria",
          "durationEstimate": "2 hours"
        }
      ],
      "sleep": {
        "location": "Milano, Milan, Italy",
        "night": 1
      }
    },
    {
      "dayNumber": 2,
      "activities": [
        {
          "time": "morning",
          "location": "Milano, Milan, Italy",
          "description": "Last activities in Milano",
          "durationEstimate": "2 hours"
        },
        {
          "time": "afternoon",
          "location": "Firenze, Florence, Italy",
          "location": "Train from Milano to Firenze",
          "description": "Travel by high-speed train",
          "durationEstimate": "1.5 hours",
          "isTravel": true,
          "travelMode": "train",
          "costEstimate": "$30-50"
        },
        {
          "time": "evening",
          "location": "Firenze, Florence, Italy",
          "description": "Dinner in Florence",
          "durationEstimate": "2 hours"
        }
      ],
      "sleep": {
        "location": "Firenze, Florence, Italy",
        "night": 2
      }
    }
  ],
  "constraints": {
    "startDate": "${input.arrival.date}",
    "endDate": "${input.departure.date}",
    "arrivalLocation": "${input.arrival.location}",
    "departureLocation": "${input.departure.location}",
    "nightsAvailable": ${nights},
    "nightsAllocated": ${nights}
  }
}
\`\`\`

---

**TRIP PARAMETERS:**
- Arrive: ${startDate} in **${input.arrival.location}**
- Depart: ${endDate} from **${input.departure.location}**
- Total: **${nights} nights** available = **${nights + 1} calendar days**
${input.stops && input.stops.length > 0 ? `- **REQUIRED STOPS (YOU MUST VISIT ALL):** ${input.stops.join(', ')}` : '- No specific stops requested'}
- Travel pace: ${input.travelPace === 'relaxed' ? '🐢 Relaxed' : input.travelPace === 'active' ? '⚡ Active' : '⚖️ Balanced'}

${input.desiredAttractions && input.desiredAttractions.length > 0 ? `**ATTRACTIONS TO INCLUDE:**
${input.desiredAttractions.map((attr) => `- ${attr}`).join('\n')}` : ''}

${input.notes ? `**ADDITIONAL NOTES:** ${input.notes}` : ''}

---

**PLANNING RULES:**

1. **Activities must be location-specific**:
   - Every activity has a location field
   - All morning activities in location X, then you can travel in afternoon to location Y
   - Don't put activities in a location you haven't reached yet

2. **Travel is an activity**:
   - Takes time (e.g., train 1.5 hours = 1.5 hours of your afternoon)
   - Has a cost
   - Cannot split (you can't be in Milano and Firenze simultaneously)
   - Set isTravel: true, travelMode: "train|bus|flight"

3. **Night allocation**:
   - Total nights across all sleep objects must equal ${nights}
   - Sleep only happens after activities (not during)
   - Last day can have activities but usually has you depart/travel back

4. **Day structure**:
   - Can have morning in Milano + afternoon travel + evening in Firenze
   - NOT: Activities that assume you're already somewhere
   - Each activity's location must be reachable from previous activity's location

5. **Realism check**:
   - Don't suggest 3 hours of sightseeing + 1.5 hour train in one afternoon
   - Split across days if too ambitious
   - Morning/afternoon/evening are flexible slots - use actual time needs

6. **Must end in departure location**:
   - Final day's activities should be in or include travel to ${input.departure.location}
   - If last activity is travel, you should arrive by evening of final day

${firstName ? `\n7. **Personalization**: Address ${firstName} by name.` : ''}

---

**Generate the itinerary now. Remember: ONLY JSON, activities have locations, travel is explicit.**`;
}
