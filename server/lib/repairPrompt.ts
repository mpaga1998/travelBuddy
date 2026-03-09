import { TripContext } from './tripContext';
import { ValidationError } from './planValidator';
import { formatDateReadable } from './date';

/**
 * Build a repair prompt that guides the model to fix validation errors.
 * Includes the invalid JSON, specific errors, and trip context to provide
 * clear correction guidance.
 */
export function buildRepairPrompt(
  context: TripContext,
  invalidPlan: Record<string, unknown>,
  validationErrors: ValidationError[]
): string {
  const errorSummary = validationErrors
    .map((e) => `- ${e.path}: ${e.message}`)
    .join('\n');

  const invalidJSONString = JSON.stringify(invalidPlan, null, 2);
  const arrivalDateStr = formatDateReadable(context.arrivalDate);
  const departureDateStr = formatDateReadable(context.departureDate);

  return `You generated an itinerary plan with validation errors. Please correct the JSON to fix all issues below.

VALIDATION ERRORS TO FIX:
${errorSummary}

TRIP CONTEXT (backend-computed):
- Arrival: ${arrivalDateStr} in ${context.arrivalLocation}
- Departure: ${departureDateStr} in ${context.departureLocation}
- Total nights: ${context.totalNights}
- Total calendar days: ${context.totalCalendarDays}
- Trip category: ${context.tripLengthCategory}
- Travel pace: ${context.travelPace}

YOUR INVALID JSON:
\`\`\`json
${invalidJSONString}
\`\`\`

CORRECTION REQUIREMENTS:
1. Fix ALL validation errors listed above
2. Keep route and reasoning unchanged where possible
3. Ensure field names and types match schema exactly:
   - route: array of {location, startDay, endDay, nights, reason}
   - transportSegments: array of {from, to, day, mode, estimatedDuration, cost}
   - totalNights: number (must equal sum of route.nights)
   - isFeasible: boolean
   - summary: string
   - warnings: array of strings
   - cutsOrAlternatives: array of strings

4. Never add fields not in schema
5. All numbers must be integers where appropriate
6. All arrays must be arrays (not null or single objects)

Return ONLY the corrected JSON object, no markdown, no explanation.`;
}
