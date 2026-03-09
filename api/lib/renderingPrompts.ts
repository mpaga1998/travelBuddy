/**
 * Rendering prompts for final markdown itinerary
 * Converts structured ItineraryPlan into engaging, readable markdown
 */

import { NormalizedTripInput } from './validation';
import { TripContext } from './tripContext';
import { ItineraryPlan } from '../types/plan';
import { formatDate } from './date';

/**
 * System prompt for rendering step
 * Instructs model to convert structured plan to engaging markdown
 */
export function buildRenderingSystemPrompt(): string {
  return `You are a travel writer converting a structured trip plan into an engaging, readable itinerary.

YOUR ROLE:
- Take the provided structured plan as canonical truth
- Convert it to conversational, readable markdown
- Maintain all route details, nights, and transport info
- Add travel context and tips, but do NOT change the route

DO NOT:
- Change which cities or stops are visited
- Alter the number of nights at each location
- Add stops, remove stops, or reorder stops
- Change travel dates or day numbers
- Invent different transport options

DO:
- Write naturally and conversationally
- Use the traveler's name if provided (naturally, not forced)
- Organize by day/location groups
- Include transport details and timing between stops
- Highlight the main activities/attractions for each location
- Add context about why each stop is good
- Mention any warnings or tight aspects honestly
- Keep a friendly, backpacker-oriented tone
- Minimize emoji use (only if truly helpful)

OUTPUT:
Return professional, readable markdown. Include:
- Trip overview/summary
- Day-by-day or location-by-location breakdown
- Clear transport info between stops
- Estimated nights and arrival/departure times
- Practical tips (early starts, bus schedules, etc.)
- Warnings about tight timing if applicable
- Confidence note about feasibility`;
}

/**
 * Build user prompt with the plan data
 */
export function buildRenderingUserPrompt(
  plan: ItineraryPlan,
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string
): string {
  const arrivalDate = formatDate(context.arrivalDate);
  const departureDate = formatDate(context.departureDate);

  // Build transport summary
  const transportSummary = plan.transportSegments
    .map(
      (seg, i) =>
        `${i + 1}. ${seg.from} to ${seg.to}: ${seg.mode} (${seg.duration}), depart day ${seg.departDay}${seg.earlyStart ? ', EARLY START' : ''}`
    )
    .join('\n');

  // Build route summary
  const routeSummary = plan.route
    .map(
      (stop, i) =>
        `${i + 1}. ${stop.location}: days ${stop.startDay}-${stop.endDay} (${stop.nights} night${stop.nights > 1 ? 's' : ''}) - ${stop.reason}`
    )
    .join('\n');

  const travelerName = firstName ? `for ${firstName}` : 'for you';

  return `Convert this structured plan ${travelerName} into engaging markdown itinerary:

TRIP BASICS:
- Arrival: ${context.arrivalLocation} on ${arrivalDate}
- Departure: ${context.departureLocation} on ${departureDate}
- Total duration: ${context.totalNights} nights, ${context.totalCalendarDays} calendar days
- Interests: ${input.desiredAttractions.length > 0 ? input.desiredAttractions.join(', ') : 'general'}
- Travel pace: ${input.travelPace || 'moderate'}

STRUCTURED PLAN (Do NOT change this):

Route (CANONICAL - do not alter):
${routeSummary}

Transport Segments (CANONICAL - do not alter):
${transportSummary || '(no segments data)'}

Plan Feasibility: ${plan.isFeasible ? 'Yes' : 'No'}
Route Confidence: ${plan.confidence}/10
Summary: ${plan.summary}

${plan.warnings && plan.warnings.length > 0 ? `Warnings: ${plan.warnings.join('; ')}` : ''}

${plan.issues && plan.issues.length > 0 ? `Issues/Constraints: ${plan.issues.join('; ')}` : ''}

INSTRUCTIONS:
1. Write markdown itinerary using the route and transport segments above
2. Organize clearly by stop or day
3. Show exactly the nights specified for each location
4. Include transport details between stops
5. Mention highlights/activities for each stop
6. Use traveler's name (${firstName || 'their name'}) naturally if mentioned
7. Be honest about tight timing or warnings
8. Keep friendly, backpacker tone
9. Return ONLY markdown, no other text`;
}
