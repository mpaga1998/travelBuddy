/**
 * Analytical Itinerary Prompts - Multi-section itinerary generation
 */

import { TripInput } from '../services/openaiService';
import { calculateNights } from './inputValidation';
import { TripFeasibilityAnalysis } from './feasibilityAnalyzer';
import { formatDate } from './date';

export function buildAnalyticalItineraryPrompt(
  input: TripInput,
  feasibility: TripFeasibilityAnalysis,
  firstName?: string
): string {
  const nightsAvailable = feasibility.nightsAvailable;
  const calendarDays = feasibility.calendarDays;
  const arrivalDate = new Date(input.arrival.date);
  const departureDate = new Date(input.departure.date);
  
  const startDateStr = formatDate(arrivalDate);
  const endDateStr = formatDate(departureDate);

  return `You are an expert trip planner. Create a detailed, honest itinerary for ${firstName || 'the traveler'}.

**⚠️ CRITICAL TIME ACCOUNTING:**
- Calendar days: ${calendarDays} (from ${input.arrival.date} to ${input.departure.date})
- Nights available: ${nightsAvailable}  
- Arrival: ${startDateStr} at ${input.arrival.time || 'unspecified'} in ${input.arrival.location}
- Departure: ${endDateStr} at ${input.departure.time || 'unspecified'} from ${input.departure.location}

**FEASIBILITY CONSTRAINTS (from analysis):**
${feasibility.locations.map(loc => `- ${loc.name}: ${loc.rating.toUpperCase()} (${loc.reason})`).join('\n')}

**MAJOR CHALLENGES:**
${feasibility.majorChallenges.map(c => `- ${c}`).join('\n')}

**SUGGESTIONS TO IMPLEMENT:**
${feasibility.suggestions.map(s => `- ${s}`).join('\n')}

**TRIP PARAMETERS:**
- Pace: ${input.travelPace || 'moderate'}
- Budget: ${input.budget || 'flexible'}
- Interests: ${(input.interests || []).join(', ') || 'general'}
- Notes: ${input.notes || 'none'}

**YOUR TASK - CREATE A MULTI-SECTION ITINERARY:**

Format your response as MARKDOWN with these sections:

1. **Summary** - Total nights, dates, logistic overview
2. **Feasibility Assessment** - Quick feasibility for each place
3. **Day-by-Day Itinerary** - For each location:
   - How many nights
   - What to do (list of activities/sights)
   - Getting there (transportation)
   - Important info (permits, tips, warnings)
4. **Alternative Route** (if constraints are tight) - Simpler version
5. **Honest Verdict** - Is this feasible? What should they know?

**SPECIFIC REQUIREMENTS:**

🌙 **Night Allocation:**
You must allocate EXACTLY ${nightsAvailable} nights across locations.
Show clearly: Location A = X nights, Location B = Y nights, etc.
Sum must equal ${nightsAvailable}.

📅 **Calendar Days:**
You have ${calendarDays} calendar days (${input.arrival.date} through ${input.departure.date}).
If arrival is ${input.arrival.time || 'morning'}, day 1 is partial.
If departure is ${input.departure.time || 'morning'}, final day is partial.

✈️ **Travel Days:**
Count travel time (flights, drives) as time used. Be realistic about jet lag and transfers.
If traveling between cities, show "Travel day: [location A] → [location B], estimated time: X"

📍 **Location Priority:**
${input.arrival.location === input.departure.location 
  ? `SAME ARRIVAL/DEPARTURE: ${input.arrival.location} is base city.
     ${(input.notes && (input.notes.toLowerCase().includes('not') || input.notes.toLowerCase().includes('skip')))
       ? 'Per notes: minimize time in base city, maximize attractions.'
       : 'Plan day trips from base city.'}` 
  : `DIFFERENT CITIES: Multi-city trip.
     ${(input.stops && input.stops.length > 0) 
       ? 'MUST include required stops: ' + input.stops.join(', ') 
       : 'No required intermediate stops.'}`}

💡 **Be Honest:**
- If something is logistically hard, say so
- If allocating the desired stops is unrealistic, explain why
- If skipping certain attractions makes the trip better, recommend it
- If there's a better alternative route, present it

🎯 **Format with Emojis:**
- ✅ Easy/doable
- ⚠️ Challenging but possible
- ❌ Not feasible in this timeframe
- 📍 Location
- ✈️ Transportation
- 🌙 Sleep/night
- 🏔️ Attractions/activities
- 💡 Tips

**OUTPUT MUST BE MARKDOWN** (not JSON). Include all sections above. Be conversational and honest.`;
}
