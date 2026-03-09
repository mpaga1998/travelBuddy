/**
 * Planning prompts for structured itinerary generation
 * These prompts focus on JSON output for plan validation before markdown rendering
 */

import { NormalizedTripInput } from '../types/trip.js';
import { TripContext } from './tripContext.js';
import { formatDate } from './date.js';

/**
 * System prompt for planning step
 * Instructs model to think like a route planner and output structured JSON
 */
export function buildPlanningSystemPrompt(): string {
  return `You ONLY output valid JSON. NOTHING ELSE.

You are a route planner creating a JSON plan object.

OUTPUT FORMAT (Required structure):

{
  "isFeasible": true,
  "summary": "trip headline",
  "totalNights": 8,
  "totalCalendarDays": 9,
  "route": [
    {"location": "City", "startDay": 1, "endDay": 3, "nights": 2, "reason": "why", "highlights": ["a", "b"]}
  ],
  "transportSegments": [
    {"from": "A", "to": "B", "departDay": 3, "duration": "3h", "mode": "van", "costEstimate": "~800", "earlyStart": false}
  ],
  "issues": [],
  "warnings": [],
  "suggestedAlternatives": [],
  "confidence": 8
}

FIELD REQUIREMENTS:

isFeasible (boolean): true/false only
summary (string): one-line trip description
totalNights (integer): positive number
totalCalendarDays (integer): positive number
route (array): list of stops
  - location (string): city name
  - startDay (integer): 1-indexed day arrival
  - endDay (integer): 1-indexed day departure
  - nights (integer): endDay - startDay = nights sleeping
  - reason (string): why this stop
  - highlights (array of strings): activities
transportSegments (array): travel legs
  - from (string): origin city
  - to (string): destination city
  - departDay (integer): day leaving origin
  - duration (string): travel time like "3-4 hours"
  - mode (string): van, flight, bus, etc.
  - costEstimate (string): cost like "~800 som" or "$25-30"
  - earlyStart (boolean): true if early departure needed
issues (array of strings): problems if isFeasible=false, otherwise empty
warnings (array of strings): cautions even if feasible
suggestedAlternatives (array of strings): route changes if needed
confidence (integer): 0-10 planner confidence

RULES YOU MUST FOLLOW:

1. totalNights MUST match input exactly
2. First stop MUST start on day 1
3. Last stop MUST be in departure location
4. Sum of all route nights MUST equal totalNights
5. All days are 1-indexed
6. nights = endDay - startDay (for day counting)
7. If you cannot satisfy rules: set isFeasible=false, fill issues array
8. Do NOT wrap JSON in code blocks or backticks
9. Do NOT add markdown or comments
10. Output ONLY the JSON object, nothing before/after
11. Valid JSON syntax only

RESPOND WITH ONLY JSON.`;
}

export function buildPlanningUserPrompt(
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string,
  travelHeuristics?: string // optional formatted heuristics block
): string {
  const arrivalDate = formatDate(context.arrivalDate);
  const departureDate = formatDate(context.departureDate);

  let facts = `Analyze this trip and return JSON plan.

TRIP DATA:
- Arrives: ${arrivalDate} in ${context.arrivalLocation}
- Departs: ${departureDate} from ${context.departureLocation}
- Duration: ${context.totalNights} nights, ${context.totalCalendarDays} calendar days
- Last night: day ${context.totalCalendarDays - 1}
- Planned stops: ${input.stops && input.stops.length > 0 ? input.stops.join(', ') : 'none (single city)'}
- Interests: ${input.desiredAttractions.length > 0 ? input.desiredAttractions.join(', ') : 'not specified'}
- Pace: ${input.travelPace || 'moderate'}
${input.budget ? `- Budget: ${input.budget}` : ''}
${input.notes ? `- Notes: ${input.notes}` : ''}

CONSTRAINTS (Non-negotiable):
1. Starts: ${context.arrivalLocation}, day 1
2. Ends: ${context.departureLocation}, night before departure day
3. Total nights: exactly ${context.totalNights}
4. All days: 1-indexed
5. Nights math: nights = endDay - startDay

${travelHeuristics ? `TRAVEL KNOWLEDGE & HEURISTICS (Consider these for realistic routing):\n${travelHeuristics}\n` : ''}

If unable to satisfy all constraints:
- Set isFeasible = false
- List issues in issues array
- Suggest alternatives in suggestedAlternatives array

Return ONLY JSON.`;

  return facts;
}

/**
 * System prompt for repair step
 * Instructs model to fix a broken plan based on specific validation feedback
 */
export function buildRepairSystemPrompt(): string {
  return `You are a route repair specialist. Your job is to fix a broken JSON itinerary plan.

You will receive:
1. The original JSON plan that failed validation
2. The list of specific errors

YOUR TASK:
- Analyze the errors
- Correct ONLY the fields causing errors
- Keep successful parts unchanged
- Ensure all constraints are met
- Return CORRECTED JSON ONLY

OUTPUT:
Return ONLY valid JSON. No text before/after. No markdown. No backticks.
Same structure as original, with corrected values.

FIELD REQUIREMENTS (same as before):
- isFeasible (boolean)
- summary (string)
- totalNights (integer, must match input)
- totalCalendarDays (integer, must match input)
- route (array of stops with location, startDay, endDay, nights, reason, highlights)
- transportSegments (array of legs)
- issues (array, empty if feasible)
- warnings (array)
- suggestedAlternatives (array)
- confidence (integer 0-10)

REPAIR RULES:
1. If totalNights mismatch: adjust route nights to match exactly
2. If days out of order: reorder and renumber days
3. If negative/zero nights: ensure all nights > 0
4. If location mismatch: adjust to match departure location
5. If transport segments don't match route: adjust to connect stops
6. If marked infeasible with no issues: add explanation
7. Keep changes minimal - only fix what's broken

RESPOND WITH ONLY JSON.`;
}

/**
 * Build repair user prompt with context about what went wrong
 */
export function buildRepairUserPrompt(
  invalidPlan: any,
  validationIssues: Array<{ rule: string; severity: string; message: string; suggestion?: string }>,
  context: TripContext,
  input: NormalizedTripInput,
  travelHeuristics?: string // optional formatted heuristics
): string {
  const errorMessages = validationIssues
    .filter((i) => i.severity === 'error')
    .map((i) => `- [${i.rule}] ${i.message}${i.suggestion ? ` → ${i.suggestion}` : ''}`)
    .join('\n');

  const warningMessages = validationIssues
    .filter((i) => i.severity === 'warning')
    .map((i) => `- [${i.rule}] ${i.message}${i.suggestion ? ` → ${i.suggestion}` : ''}`)
    .join('\n');

  return `REPAIR REQUEST:

The following JSON plan failed validation. Fix the errors below.

TRIP CONSTRAINTS (unchangeable):
- Arrival: ${context.arrivalLocation}, day 1
- Departure: ${context.departureLocation}, day ${context.totalCalendarDays}
- Total nights: ${context.totalNights}
- Calendar days: ${context.totalCalendarDays}

${travelHeuristics ? `TRAVEL KNOWLEDGE & HEURISTICS (Apply these while fixing):\n${travelHeuristics}\n` : ''}

CRITICAL ERRORS TO FIX:
${errorMessages || '(none)'}

WARNINGS TO REVIEW:
${warningMessages || '(none)'}

BROKEN JSON (start here):
${JSON.stringify(invalidPlan, null, 2)}

CORRECTED JSON (return this):
Return the fixed JSON with errors resolved. Keep all other fields unchanged if possible.
Return ONLY JSON, nothing else.`;
}

