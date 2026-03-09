import { formatDateReadable } from './date';
/**
 * Build a planning prompt for the planner model.
 * This prompt asks for a structured JSON plan, not free-text itinerary.
 * Emphasis on strict JSON format and feasibility logic.
 */
export function buildPlanningPrompt(context) {
    const { totalNights, tripLengthCategory, arrivalLocation, departureLocation, sameArrivalDepartureLocation } = context;
    const { userFirstName, stops, travelPace, budget, desiredAttractions, notes } = context.sourceInput;
    const startDate = formatDateReadable(context.arrivalDate);
    const endDate = formatDateReadable(context.departureDate);
    // Build attractions list
    const attractionsList = desiredAttractions.length > 0 ? desiredAttractions.map((a) => `- ${a}`).join('\n') : '(No specific attractions requested)';
    // Build stops hint
    const stopsSuggestion = stops && stops.length > 0 ? `Suggested stops: ${stops.join(', ')}.` : 'No specific stops requested.';
    // Build return logistics
    const returnLogistics = sameArrivalDepartureLocation
        ? `Return to ${departureLocation} by evening of ${endDate} for departure.`
        : `Return to ${departureLocation} by evening of ${endDate} for departure (requires travel from final location).`;
    return `You are a trip routing expert. Analyze this request and output ONLY a valid JSON plan.

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

---

CRITICAL: Output ONLY valid JSON. No markdown, no explanation, no code blocks. Just raw JSON.

Required JSON schema (exact field names and types):

{
  "isFeasible": true or false (boolean, required),
  "summary": "one-line route description" (string, required, non-empty),
  "totalNights": number (integer, required, must equal ${totalNights}),
  "route": [
    {
      "location": "city name" (string, required),
      "startDay": integer (required, 1-indexed),
      "endDay": integer (required, >= startDay),
      "nights": integer (required, nights = endDay - startDay + 1),
      "reason": "allocation justification" (string, required, non-empty)
    }
  ],
  "transportSegments": [
    {
      "from": "origin city" (string, required),
      "to": "destination city" (string, required),
      "day": integer (required, when transfer happens),
      "mode": "minibus|van|flight|etc" (string, required),
      "estimatedDuration": "e.g. 4-5 hours" (string, required),
      "cost": "e.g. ~800 som or \$50" (string, required)
    }
  ],
  "warnings": ["warning 1", "warning 2"] (array of strings, required, can be empty),
  "cutsOrAlternatives": ["alternative 1"] (array of strings, required, can be empty)
}

STRICT VALIDATION RULES:
1. isFeasible must be boolean (true or false).
2. summary must be a non-empty string.
3. totalNights must be a positive integer equal to ${totalNights}.
4. route must be an array with at least 1 stop.
  - First stop MUST have startDay = 1.
  - Last stop MUST have endDay = ${totalNights}.
  - Each stop's nights must equal (endDay - startDay + 1).
  - Sum of stopNights must equal totalNights.
  - No duplicate locations.
5. transportSegments must be an array (can be empty, or one less than num stops).
6. warnings must be an array of strings (can be empty).
7. cutsOrAlternatives must be an array of strings (can be empty).

FEASIBILITY LOGIC:
- isFeasible = true if route is viable and respects all constraints.
- isFeasible = false if route is impossible (e.g., too many stops, no time for travel).
- If false, populate warnings and cutsOrAlternatives to explain why.

---

Output valid JSON only. Do not add any explanation or markdown.`;
}
