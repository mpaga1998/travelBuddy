/**
 * Structured planning prompts - generates JSON output instead of freetext
 */

import { TripInput } from '../services/openaiService';
import { formatDate } from './date';
import { calculateNights } from './inputValidation';

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

**⚠️ CRITICAL - READ CAREFULLY:**
1. Return ONLY valid JSON wrapped in triple backticks (\`\`\`json ... \`\`\`). NO other text.
2. **NIGHT MATCHING IS CRITICAL**: nightsAllocated must equal nightsAvailable (${nights})
   - ${nights} nights means ${nights + 1} calendar days (e.g., 3 nights = arrival day + 3 nights + partial departure day)
   - Sum all stop.totalNights and verify they equal ${nights}. Count on your fingers.
   - Example: If you have 3 stops with 2 nights, 2 nights, and 1 night → total = 5 nights ✓
3. Every activity MUST have: time (optional: "morning", "afternoon", "night"), description, durationEstimate
4. Every day MUST have: dayNumber, location, at least 1 activity
5. Return feasible=false with explanation if the trip is infeasible

**🎯 JSON STRUCTURE:**
\`\`\`json
{
  "feasible": true,
  "feasibilityNotes": "Optional: explain constraints or feasibility concerns",
  "stops": [
    {
      "location": "Milan",
      "totalNights": 2,
      "transportFromPrevious": null,
      "days": [
        {
          "dayNumber": 1,
          "location": "Milan",
          "nights": 1,
          "activities": [
            {
              "time": "afternoon",
              "description": "Explore Duomo Cathedral, walk around main square",
              "durationEstimate": "2 hours"
            },
            {
              "time": "evening",
              "description": "Dinner in Brera district",
              "durationEstimate": "2 hours"
            }
          ]
        },
        {
          "dayNumber": 2,
          "location": "Milan",
          "nights": 1,
          "activities": [
            {
              "time": "morning",
              "description": "Visit Sforza Castle museum",
              "durationEstimate": "1.5 hours"
            },
            {
              "description": "Afternoon at Navigli canals",
              "durationEstimate": "3 hours"
            }
          ]
        }
      ]
    },
    {
      "location": "Como",
      "totalNights": 1,
      "transportFromPrevious": {
        "mode": "train",
        "duration": "1 hour",
        "costEstimate": "$15-20"
      },
      "days": [
        {
          "dayNumber": 3,
          "location": "Como",
          "nights": 1,
          "activities": [
            {
              "time": "morning",
              "description": "Lake Como boat tour",
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
    "nightsAllocated": 3
  }
}
\`\`\`

**IMPORTANT NOTES:**
- nightsAllocated in example = 2 + 1 = 3 nights (matches nightsAvailable) ✓
- activities can have optional "time" field (e.g., activity 2 on day 2 has no time specified)
- activities must always have description and durationEstimate
- For the trip from ${input.arrival.location} to ${input.departure.location}, nightsAllocated MUST equal ${nights}

---

**TRIP PARAMETERS:**
- Arrive: ${startDate} in **${input.arrival.location}** (PRIMARY START)
- Depart: ${endDate} from **${input.departure.location}** (PRIMARY END)
- Total: **${nights} nights** available
${input.stops && input.stops.length > 0 ? `- **Required Stops (main route):** ${input.stops.join(', ')}` : '(No additional stops - direct route from arrival to departure)'}
- Travel pace: ${input.travelPace === 'relaxed' ? '🐢 Relaxed (2-3 activities/day)' : input.travelPace === 'active' ? '⚡ Active (4-5 activities/day)' : '⚖️ Balanced (3-4 activities/day)'}
- Budget tier: ${input.budget || 'flexible'}
${input.interests && input.interests.length > 0 ? `- **Interests:** ${input.interests.join(', ')}` : ''}

${
  input.arrival.location.toLowerCase() === input.departure.location.toLowerCase()
    ? `\n**🏠 HUB-AND-SPOKE TRIP** (arrival and departure are the same city: ${input.arrival.location})\n${
        input.notes && (input.notes.toLowerCase().includes("don't visit") || input.notes.toLowerCase().includes("no ") + input.arrival.location.toLowerCase())
          ? `→ Per your notes, prioritize DAY TRIPS to ${input.desiredAttractions?.join(', ') || 'optional places'}\n→ Minimize or skip ${input.arrival.location} visits - focus on exploring nearby regions\n→ Sleep in ${input.arrival.location} only due to logistics (arrival/departure days)`
          : `→ Stay in ${input.arrival.location} as your base (sleep here most nights)\n→ Make day trips from there to ${input.desiredAttractions?.join(', ') || 'nearby attractions'}\n→ Return to ${input.arrival.location} hotel each night for convenience`
      }\n`
    : ''
}

${input.desiredAttractions && input.desiredAttractions.length > 0 ? `**OPTIONAL PLACES TO VISIT:**\n${input.desiredAttractions.map((attr) => `- ${attr}`).join('\n')}\n${
  input.arrival.location.toLowerCase() === input.departure.location.toLowerCase()
    ? '→ These are reachable as same-day or overnight excursions from ' + input.arrival.location
    : '→ These are SECONDARY to the required route\n→ Try to integrate as day trips from main stops\n→ Only include if proximity + time allows\n→ Do NOT create multi-day detours for these'
}` : '(No optional attractions specified)'}

${input.notes ? `**ADDITIONAL NOTES:** ${input.notes}` : ''}

---

**PLANNING RULES:**

1. **ITINERARY HIERARCHY**:
   - **Must Include**: Arrival (${input.arrival.location}) → Stops → Departure (${input.departure.location})
   - **Try to Include**: Optional attractions as day trips from the main route
   - **Do NOT Include**: Optional attractions if they require multi-day detours
   - If time is limited, ALWAYS prioritize the main route over optional attractions

2. **OPTIONAL ATTRACTIONS STRATEGY**:
   - Are they within 1-2 hours of a main stop? → Consider as day trip
   - Would visiting them require staying extra nights? → Skip them (not feasible)
   - Example GOOD: "From Milano, Lake Como is a 1-hour train ride → easy day trip"
   - Example BAD: "Insert Lake Como as a 3-day stop in the middle of the route"
   - If you can't reach it as a day trip, exclude it from the plan

3. **NIGHT ALLOCATION MUST BE EXACT**: Sum of all stop totalNights must equal EXACTLY ${nights}
   - Do NOT allocate the same number of nights to each stop
   - Example GOOD splits for 8 nights: 3-3-2, 4-2-2, 3-3-1-1, etc.
   - Example BAD splits: "night 1-night 2" (ambiguous), 4-3-2 (totals 9, not 8)
   - **VERIFY**: Count on your fingers. If your itinerary spans ${nights} nights, nightsAllocated must be ${nights}

4. **Work backwards from departure**:
   - You must END in ${input.departure.location} by evening on ${endDate}
   - Last stop should allow travel back on final day
   - Calculate travel time from final destination back to ${input.departure.location}

5. **Reality check transport times**:
   - Don't use Google Maps optimistic times - add buffer
   - Include actual driving/transit speeds, not straight-line distance
   - Consider time-of-day effects (morning traffic, evening fatigue)

6. **Be honest about feasibility**:
   - If ${nights} nights is too tight for the main route, say so
   - Better to suggest 1-2 fewer locations than pretend it's doable
   - If feasible: false, explain what to cut or adjust (cut optional attractions first)

7. **Daily breakdown requirements**:
   - Number of activities per day should match travel pace (see TRIP PARAMETERS)
   - **Activity "time" field MUST be EXACTLY ONE OF**: "morning", "afternoon", "night"
   - DO NOT use: "evening", "early afternoon", "late morning", "midday", or any variations
   - Include realistic time estimates (e.g., "2 hours", "1.5 hours")
   - Activities should match the travel pace (${input.travelPace})
   - Adjust daily activity count based on: travel pace, transfer days, and feasibility
   - Example: Relaxed pace = 2-3 activities, Active pace = 4-5 activities

8. **Transportation details**:
   - Between stops, include: mode (bus/taxi/flight), duration, and cost estimate
   - First stop: no transportFromPrevious (or mark as arrival)
   - Last transport should arrive at ${input.departure.location} by ${endDate} evening

${firstName ? `\n**Personalization**: Use ${firstName}'s name and tailor activities to their interests.` : ''}

---

**ACTIVITY TYPE GUIDANCE:**
${input.interests && input.interests.length > 0 ? `Based on ${firstName || 'your'} interests (${input.interests.join(', ')}), prioritize:
${[
  input.interests.includes('Architecture') ? '- **Architecture**: Museums, historic buildings, architectural tours, UNESCO sites' : '',
  input.interests.includes('Art & Culture') ? '- **Art & Culture**: Art galleries, cultural museums, local performances, street art' : '',
  input.interests.includes('Food & Dining') ? '- **Food & Dining**: Local restaurants, food tours, markets, cooking classes' : '',
  input.interests.includes('Nature & Hiking') ? '- **Nature & Hiking**: Hiking trails, national parks, nature reserves, outdoor activities' : '',
  input.interests.includes('Beach & Water') ? '- **Beach & Water**: Beach time, water sports, swimming, coastal activities' : '',
  input.interests.includes('Nightlife') ? '- **Nightlife**: Bars, clubs, local venues, evening entertainment' : '',
  input.interests.includes('Shopping') ? '- **Shopping**: Markets, boutiques, shopping districts, local products' : '',
  input.interests.includes('History') ? '- **History**: Historical sites, museums, ancient ruins, heritage tours' : '',
  input.interests.includes('Photography') ? '- **Photography**: Scenic viewpoints, photo tours, instagrammable spots' : '',
  input.interests.includes('Adventure') ? '- **Adventure**: Adventure sports, extreme activities, thrilling experiences' : ''
].filter(Boolean).join('\n')}` : 'Craft activities that provide a mix of cultural immersion, exploration, and rest.'}

**BUDGET GUIDANCE:**
${input.budget === 'budget' ? `- Prioritize: Free attractions, street food, local public transit, budget hostels
- Avoid: Fine dining, paid tours when free alternatives exist, expensive activities
- Estimate: Activities under $10-15 per person` : input.budget === 'luxury' ? `- Prioritize: Premium experiences, fine dining, private tours, upscale hotels
- Include: Unique splurges, high-end restaurants, luxury activities
- Estimate: Activities $50+ per person` : `- Mix of budget and mid-range options
- Estimate: Activities $15-40 per person`}

---

**Generate the itinerary now. Remember: ONLY JSON output inside triple backticks, nothing else.**`;
}
