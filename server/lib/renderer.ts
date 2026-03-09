import { ItineraryPlan } from './types/plan';
import { TripContext } from './tripContext';
import { formatDateReadable } from './date';

/**
 * Rendering template / format guide.
 * Describes the style and structure for markdown output.
 * Not sent to model—used by renderItinerary() to format consistently.
 */
const RENDER_TEMPLATE = `
ITINERARY FORMAT GUIDE:
- Personal greeting (use traveler name if available)
- Overview: dates, locations, night allocation, pace
- Per-location: day range, nights, reason, daily notes, transport to next
- Honest warnings if schedule is tight
- Optional alternatives if route is over-ambitious
- Closing: realistic logistics note

TONE:
- Backpacker-friendly: conversational, practical, social
- Honest: acknowledge trade-offs, long travel days, packed schedules
- Encouraging but realistic: "this works, but you'll be moving"
- Minimal emojis: use sparingly for visual breaks, not decoration

DAILY FLOW:
- Per stop, describe realistic day-to-day (arrival day, middle days, departure day)
- Include estimated arrival times if transport day known
- Note if day 1 is partial (arrival afternoon) or full day
- Mention buffer time for delays if relevant
`;

interface RendererInput {
  /** The validated itinerary plan from planner */
  plan: ItineraryPlan;
  
  /** Trip context with dates and categorization */
  context: TripContext;
  
  /** Traveler first name for personalization (optional) */
  travelerName?: string;
}

/**
 * Render a validated itinerary plan to readable markdown.
 * 
 * Takes a structured ItineraryPlan (from planner) and produces final markdown
 * suitable for user consumption. Adds context awareness (dates, trip length),
 * personalization (traveler name), and realistic daily flow.
 * 
 * This stage is purely presentation—planning logic handled in planner stage.
 */
export function renderItinerary(input: RendererInput): string {
  const { plan, context, travelerName } = input;
  let md = '';

  // === GREETING & OVERVIEW ===
  
  const greeting = travelerName 
    ? `Hey ${travelerName}! Here's your itinerary for your ${context.tripLengthCategory} trip to Kyrgyzstan.`
    : `Here's your itinerary for your ${context.tripLengthCategory} trip to Kyrgyzstan.`;
  
  md += `# ${greeting}\n\n`;

  // Quick facts
  const arrivalStr = formatDateReadable(context.arrivalDate);
  const departureStr = formatDateReadable(context.departureDate);
  
  md += `**Trip**: ${arrivalStr} → ${departureStr}\n`;
  md += `**Route**: ${plan.route.map(s => s.location).join(' → ')}\n`;
  md += `**Total**: ${context.totalNights} nights, ${context.totalCalendarDays} calendar days\n`;
  md += `**Pace**: ${context.travelPace}  \n\n`;

  // === FEASIBILITY SUMMARY ===
  
  if (!plan.isFeasible) {
    md += `## Status: Over-Ambitious\n\n`;
    md += `This route is too packed for the time available. See suggestions below to make it work.\n\n`;
  } else if (plan.warnings.length > 0) {
    md += `## Status: Tight but Doable\n\n`;
    md += `This itinerary works, but you'll be moving frequently. See details below.\n\n`;
  } else {
    md += `## Status: Good Pacing\n\n`;
    md += `Realistic schedule with some breathing room.\n\n`;
  }

  // === WARNINGS SECTION ===
  
  if (plan.warnings.length > 0) {
    md += `## Things to Know\n\n`;
    plan.warnings.forEach((warning) => {
      md += `- ${warning}\n`;
    });
    md += '\n';
  }

  // === MAIN ITINERARY ===
  
  md += `## Day-by-Day Itinerary\n\n`;

  plan.route.forEach((stop, index) => {
    const isFirstStop = index === 0;
    const isLastStop = index === plan.route.length - 1;
    
    // Stop header with day range and nights
    md += `### ${stop.location}\n`;
    md += `Days ${stop.startDay}–${stop.endDay} · ${stop.nights} night${stop.nights > 1 ? 's' : ''}\n\n`;

    // Arrival day description
    if (isFirstStop) {
      md += `**Day ${stop.startDay} (Arrival)**: Land in ${stop.location}. ${stop.reason}\n`;
    } else {
      md += `**Day ${stop.startDay} (Arrival)**: Arrive in ${stop.location}.\n`;
    }

    // Middle days (days between start and end)
    if (stop.nights > 1) {
      const middleDays = stop.endDay - stop.startDay;
      if (middleDays === 1) {
        md += `**Day ${stop.startDay + 1} (Full day)**: Explore ${stop.location}.\n`;
      } else {
        md += `**Days ${stop.startDay + 1}–${stop.endDay - 1}** (${middleDays} days): Explore and enjoy.\n`;
      }
    }

    // Departure day or travel day
    if (isLastStop) {
      md += `**Day ${stop.endDay} (Departure)**: Travel to ${context.departureLocation}.\n`;
    } else {
      const nextStop = plan.route[index + 1];
      if (nextStop) {
        md += `**Day ${stop.endDay} (Travel day)**: Depart towards ${nextStop.location}.\n`;
      }
    }

    // Transport info if available
    const transport = plan.transportSegments.find(seg => seg.from === stop.location);
    if (transport && !isLastStop) {
      md += `\n**Journey to ${transport.to}**  \n`;
      md += `Mode: ${transport.mode} | Duration: ~${transport.estimatedDuration} | Cost: ${transport.cost}\n`;
    }

    md += '\n';
  });

  // === ALTERNATIVES (if not feasible or provided) ===
  
  if (plan.cutsOrAlternatives.length > 0) {
    md += `## If You Want to Adjust\n\n`;
    if (!plan.isFeasible) {
      md += `The route above is ambitious. Here are realistic options:\n\n`;
    } else {
      md += `If you want a different pace, consider:\n\n`;
    }
    plan.cutsOrAlternatives.forEach((alt) => {
      md += `- ${alt}\n`;
    });
    md += '\n';
  }

  // === CLOSING NOTES ===
  
  md += `## Logistics Tips\n\n`;
  
  if (!plan.isFeasible) {
    md += `- Your trip is over-ambitious for the time available. Pick 1-2 cuts from above to make it realistic.\n`;
  } else if (plan.warnings.length > 0) {
    md += `- You'll be on the move. Pack light and stay flexible.\n`;
  } else {
    md += `- Good balance of travel and rest. You'll enjoy each location.\n`;
  }

  md += `- Check transit schedules for exact times and costs.\n`;
  md += `- Build in buffer days if possible—mountain roads can have delays.\n`;
  
  return md;
}

/**
 * Legacy function for backward compatibility.
 * Renders using plan only (no context or name).
 */
export function renderItineraryMarkdown(plan: ItineraryPlan): string {
  const minimalContext: TripContext = {
    arrivalDate: new Date(),
    departureDate: new Date(),
    arrivalLocation: 'Unknown',
    departureLocation: 'Unknown',
    totalNights: plan.totalNights,
    totalCalendarDays: plan.totalNights + 1,
    lastOvernightDate: new Date(),
    travelPace: 'moderate',
    tripLengthCategory: 'medium',
  };
  
  return renderItinerary({
    plan,
    context: minimalContext,
    travelerName: undefined,
  });
}
