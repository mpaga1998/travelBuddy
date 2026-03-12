/**
 * Render structured itinerary to markdown for display
 */

import { StructuredItinerary } from './itinerarySchema.js';

export function renderToMarkdown(
  itinerary: StructuredItinerary,
  firstName?: string
): string {
  let markdown = '';

  // Header
  if (firstName) {
    markdown += `# ${firstName}'s Itinerary\n\n`;
  } else {
    markdown += `# Your Itinerary\n\n`;
  }

  // Feasibility notice
  if (!itinerary.feasible) {
    markdown += `⚠️ **Feasibility Note:** ${itinerary.feasibilityNotes || 'This itinerary may be challenging to execute as planned.'}\n\n`;
  } else if (itinerary.feasibilityNotes) {
    markdown += `📌 **Note:** ${itinerary.feasibilityNotes}\n\n`;
  }

  // Trip summary
  markdown += `## Trip Overview\n`;
  markdown += `- **Dates:** ${itinerary.constraints.startDate} to ${itinerary.constraints.endDate}\n`;
  markdown += `- **Total nights:** ${itinerary.constraints.nightsAvailable}\n`;
  markdown += `- **Stops:** ${itinerary.stops.map((s) => s.location).join(' → ')}\n\n`;

  // Stop-by-stop breakdown
  itinerary.stops.forEach((stop, stopIdx) => {
    markdown += `## ${stop.location} | ${stop.totalNights} night${stop.totalNights > 1 ? 's' : ''}\n\n`;

    // Days within this stop
    stop.days.forEach((day, dayIdx) => {
      markdown += `### Day ${day.dayNumber}\n`;

      day.activities.forEach((activity) => {
        const timeLabel =
          activity.time.charAt(0).toUpperCase() + activity.time.slice(1);
        markdown += `- **${timeLabel}:** ${activity.description}`;

        if (activity.durationEstimate?.trim()) {
          markdown += ` (~${activity.durationEstimate})`;
        }

        markdown += '\n';
      });

      markdown += '\n';

      // Show where you sleep after each day
      if (day.nights > 0) {
        markdown += `🌙 **Sleep in:** ${stop.location}\n\n`;
      } else if (dayIdx === stop.days.length - 1 && stop.totalNights === 0) {
        // Final day with 0 nights - you're departing
        markdown += `✈️ **Depart from:** ${stop.location}\n\n`;
      }
    });

    // Transport to next stop (show AFTER sleep info)
    // BUT: Don't show if next stop is a departure stop (0 nights) - the travel is already in that day's activities
    if (stopIdx < itinerary.stops.length - 1) {
      const nextStop = itinerary.stops[stopIdx + 1];
      const nextTransport = nextStop.transportFromPrevious;

      // Only show transport if the next stop has nights (not a departure-only stop)
      if (nextTransport && nextStop.totalNights > 0) {
        markdown += `**Next morning - Travel to ${nextStop.location}:** ${nextTransport.mode} (${nextTransport.duration}) · ${nextTransport.costEstimate}\n\n`;
      }
    }
  });

  return markdown;
}
