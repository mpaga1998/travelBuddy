import { TripContext } from './tripContext';
import { formatDateReadable } from './date';

/**
 * Build a planning prompt for the planner model.
 * This prompt asks for a structured JSON plan, not free-text itinerary.
 * Focus: feasibility, routing, night allocation, transport clarity.
 */
export function buildPlanningPrompt(context: TripContext): string {
  const { totalNights, tripLengthCategory, arrivalLocation, departureLocation, sameArrivalDepartureLocation } = context;
  const { userFirstName, stops, travelPace, budget, desiredAttractions, notes } = context.sourceInput;

  const startDate = formatDateReadable(context.arrivalDate);
  const endDate = formatDateReadable(context.departureDate);

  // Build attractions list
  const attractionsList =
    desiredAttractions.length > 0 ? desiredAttractions.map((a) => `- ${a}`).join('\n') : '(No specific attractions requested)';

  // Build stops hint
  const stopsSuggestion = stops && stops.length > 0 ? `Suggested stops: ${stops.join(', ')}.` : 'No specific stops requested.';

  // Build return logistics
  const returnLogistics = sameArrivalDepartureLocation
    ? `Return to ${departureLocation} by evening of ${endDate} for departure.`
    : `Return to ${departureLocation} by evening of ${endDate} for departure (requires travel from final location).`;

  return `You are a trip routing expert. Analyze this trip request and output a VALID JSON plan.

TRIP CONSTRAINTS:
- Traveler: ${userFirstName || 'Friend'}
- Duration: ${totalNights} nights (${tripLengthCategory} trip)
- Arrival: ${arrivalLocation} on ${startDate}
- Departure: ${departureLocation} on ${endDate}
- Pace: ${travelPace || 'balanced'}
- Budget: ${budget || 'flexible'}
${stopsSuggestion}

DESIRED EXPERIENCES:
${attractionsList}

${notes ? `SPECIAL NOTES: ${notes}` : ''}

${returnLogistics}

TASK: Output a JSON object (and ONLY JSON, no markdown, no explanation) matching this schema:

{
  "isFeasible": boolean,
  "summary": "one-line description of the planned route",
  "totalNights": number (must equal ${totalNights}),
  "route": [
    {
      "location": "city name",
      "startDay": number (1-indexed),
      "endDay": number (1-indexed),
      "nights": number,
      "reason": "why this location / allocation justification"
    }
  ],
  "transportSegments": [
    {
      "from": "origin city",
      "to": "destination city",
      "day": number (day the transfer happens),
      "mode": "transport mode (minibus, van, flight, etc)",
      "estimatedDuration": "e.g., '4-5 hours'",
      "cost": "e.g., '~800 som' or '\$50'"
    }
  ],
  "warnings": ["list of feasibility warnings if any"],
  "cutsOrAlternatives": ["possible simplifications if trip is too ambitious"]
}

RULES FOR YOUR JSON:
1. The first stop's startDay is always 1 (arrival day).
2. The last stop's endDay is ${totalNights} (day before departure).
3. nights = endDay - startDay + 1 for each stop.
4. Sum of all nights must equal ${totalNights}.
5. Transport segments must clearly show when transfers happen.
6. If the route is physically impossible or too ambitious, set isFeasible=false and explain in warnings.
7. If feasible but tight, set isFeasible=true but include warnings.
8. Do NOT add stops beyond what is realistic for ${totalNights} nights.
9. Be honest: if ${tripLengthCategory === 'short' ? '1-3 night trips' : tripLengthCategory === 'medium' ? '4-7 night trips' : '8+ night trips'} are too short to visit all suggested stops, recommend cuts in cutsOrAlternatives.

Output ONLY valid JSON. No other text.`;
}
