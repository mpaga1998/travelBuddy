/**
 * Layered prompt architecture for OpenAI itinerary generation
 * Separates: hard constraints | planning heuristics | output formatting
 * Uses pre-computed TripContext to avoid re-deriving trip metrics
 */

import { NormalizedTripInput } from '../types/trip';
import { TripContext } from './tripContext';
import { formatDate } from './date';

/**
 * ============================================================================
 * SYSTEM PROMPT: Hard Constraints + Output Format Expectations
 * ============================================================================
 *
 * This prompt defines WHAT IS NON-NEGOTIABLE for all itinerary generation.
 * Not tied to any specific trip—applies to all trips universally.
 */
export function buildSystemPrompt(): string {
  return `You are a backpacker trip planner expert. Your job: build realistic, logistically-sound itineraries that travelers can actually execute.

## HARD CONSTRAINTS (Non-Negotiable)

1. **Night Math Must Match** - You are given a total night count. The sum of nights across all locations MUST equal this total. No shortcuts.

2. **Departure Logic** - Work backwards from the last day:
   - The traveler must END in the departure location on the final night
   - The last overnight date was calculated on the backend
   - If departing from Bishkek on April 15, they must be back in Bishkek by April 14 evening
   - Plan travel time TO the departure location on the final day

3. **No Unrealistic Routing** - You cannot:
   - Suggest a 5+ hour journey on departure day (too risky, unfeasible)
   - Repeat the same night count across all stops (e.g., "Place A: 5 nights, Place B: 5 nights")
   - Ignore travel time between stops
   - If routing is infeasible, say so explicitly and suggest alternatives

4. **Transport Visibility** - Every leg between stops MUST show:
   - Estimated travel time (realistic, not optimistic)
   - Transport mode (van, minibus, flight, etc.)
   - Cost estimate if available
   - Early start times if needed

## OUTPUT FORMAT

Structure each location as:

\`\`\`
## [Location] | Days X-Y | Z nights
[Day-by-day activities with time estimates]

Transport to [Next Destination]: [Mode], [Duration], ~[Cost]
\`\`\`

For short trips (1-3 days): Include hour-by-hour breakdown
For extended trips (4+ days): Day summaries with key highlights

Use markdown for readability. Minimal emojis (headers only).`;
}

/**
 * ============================================================================
 * USER PROMPT: Trip Specifics + Planning Heuristics
 * ============================================================================
 *
 * This prompt is specific to the user's trip. Includes:
 * - Trip facts (from TripContext)
 * - Planning heuristics (how to think about this trip)
 * - Success criteria (what good planning looks like)
 */
export function buildUserPrompt(
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string
): string {
  const greeting = firstName ? `Hey ${firstName}!` : 'Hello!';
  
  // Section 1: Trip Facts (objective, computed)
  const tripFacts = buildTripFactsSection(input, context);
  
  // Section 2: Planning Mission (heuristics for this trip)
  const planningMission = buildPlanningMissionSection(input, context, firstName);
  
  // Section 3: What Success Looks Like (criteria)
  const successCriteria = buildSuccessCriteriaSection(context);

  return `${greeting} Let's build your ${context.totalCalendarDays}-day trip.

${tripFacts}

${planningMission}

${successCriteria}`;
}

/**
 * ============================================================================
 * SECTION 1: TRIP FACTS
 * ============================================================================
 * Objective trip data (computed on backend, not re-derived here)
 * Gives GPT the exact numbers and constraints to work with
 */
function buildTripFactsSection(input: NormalizedTripInput, context: TripContext): string {
  const arrivalDate = formatDate(context.arrivalDate);
  const departureDate = formatDate(context.departureDate);

  let factsLines = [
    '## TRIP FACTS',
    `- **Arrival**: ${arrivalDate} in ${context.arrivalLocation}`,
    `- **Departure**: ${departureDate} from ${context.departureLocation}`,
    `- **Duration**: ${context.totalCalendarDays} calendar days | ${context.totalNights} nights of sleep`,
    `- **Last overnight**: ${formatDate(context.lastOvernightDate)}`,
  ];

  // Add stops if multi-city
  if (context.isMultiCity && input.stops?.length) {
    factsLines.push(`- **Planned stops**: ${input.stops.join(', ')}`);
  }

  // Add trip type
  if (context.sameArrivalDepartureLocation) {
    factsLines.push('- **Trip style**: Circular route (start and end same city)');
  }

  // Add preferences
  if (input.desiredAttractions.length > 0) {
    factsLines.push(`- **Wants to see**: ${input.desiredAttractions.join(', ')}`);
  }

  if (input.travelPace) {
    const paceDescriptions: Record<string, string> = {
      relaxed: 'relaxed pace (fewer moves, deep immersion)',
      moderate: 'moderate pace (balance activity and rest)',
      active: 'active pace (maximize coverage)',
    };
    factsLines.push(`- **Pace**: ${paceDescriptions[input.travelPace] || 'moderate'}`);
  }

  if (input.notes) {
    factsLines.push(`- **Notes**: ${input.notes}`);
  }

  return factsLines.join('\n');
}

/**
 * ============================================================================
 * SECTION 2: PLANNING MISSION
 * ============================================================================
 * Heuristics specific to THIS trip (how to approach it)
 * Adapts based on trip length category and structure
 */
function buildPlanningMissionSection(
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string
): string {
  const { tripLengthCategory, totalNights, isMultiCity, departureLocation } = context;

  let mission = '## YOUR MISSION\n\n';
  mission += 'Plan realistically. Quality matters more than coverage.\n\n';

  // Adapt mission to trip type
  if (tripLengthCategory === 'short') {
    mission += buildShortTripMission(context, firstName);
  } else {
    // medium and long trips
    mission += buildMultiCityMission(context, input, firstName);
  }

  // Add departure location reminder (critical for end-of-trip planning)
  mission += `\n**Remember**: Day ${context.totalCalendarDays} = final day. You must be BACK in ${departureLocation} to depart.`;

  // Add specific warning for ambitious multi-city trips
  if (isMultiCity && totalNights <= 7) {
    mission += `\n\n⚠️ **Tight squeeze**: ${input.stops?.length} stops in ${totalNights} nights is aggressive. If it doesn't fit, say so and suggest cuts.`;
  }

  return mission;
}

/**
 * Mission for short trips (1-3 nights): focus on depth, not coverage
 */
function buildShortTripMission(context: TripContext, firstName?: string): string {
  const dayCount = context.totalCalendarDays;
  const userName = firstName ? `${firstName}'s` : 'the';

  return `1. Create a realistic day-by-day breakdown (all ${dayCount} days).
2. For each day: show morning, afternoon, evening with actual TIME estimates.
3. For ${userName} final day: schedule return to ${context.departureLocation} by 1 PM latest (leaves room for delays).
4. Be honest: if ${dayCount} days feels rushed, say what to cut.
5. Prioritize: depth of experience over breadth of coverage.`;
}

/**
 * Mission for multi-city trips (4+ nights): focus on realistic routing
 */
function buildMultiCityMission(
  context: TripContext,
  input: NormalizedTripInput,
  firstName?: string
): string {
  const { totalNights, departureLocation, isMultiCity } = context;
  const userName = firstName ? `${firstName}'s` : 'the';

  let mission = `1. Map out the route realistically: ${input.stops?.length || 'multiple'} stops in ${totalNights} nights.
2. Allocate nights across locations (not equal per stop—shorter for travel days, longer for favorites).
3. For every leg: show transport mode, duration, cost estimate, and required start time.
4. Night math: show how you're allocating the ${totalNights} nights. They must sum exactly.
5. Be honest: if the routing is infeasible, propose alternatives (cut a stop, add time, adjust pace).
6. Final leg: Day ${context.totalCalendarDays} return to ${departureLocation} must be achievable (show the timeline).`;

  return mission;
}

/**
 * ============================================================================
 * SECTION 3: SUCCESS CRITERIA
 * ============================================================================
 * What "good" looks like for this specific trip
 * Helps GPT understand what to optimize for
 */
function buildSuccessCriteriaSection(context: TripContext): string {
  const lines = [
    '## SUCCESS LOOKS LIKE',
    '',
    '✓ Each location has a specific night count that adds up to ' + context.totalNights,
    '✓ Transport between stops is visible and time-budgeted',
    '✓ No day is overloaded with 6+ hours of travel',
    '✓ Return to ' + context.departureLocation + ' on Day ' + context.totalCalendarDays + ' is feasible',
    '✓ Activities are backpacker-friendly (social, local experiences where possible)',
    '',
    'If any of these can\t be satisfied: flag the issue and propose a better route.',
  ];

  return lines.join('\n');
}

/**
 * Format travel pace for display
 */
function formatPace(pace?: string): string {
  switch (pace) {
    case 'relaxed':
      return 'Relaxed pace - time to breathe';
    case 'active':
      return 'Active pace - pack it in';
    default:
      return 'Balanced pace';
  }
}
