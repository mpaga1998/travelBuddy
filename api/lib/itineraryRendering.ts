/**
 * Render structured itinerary to markdown for display
 */

import { StructuredItinerary } from './itinerarySchema';

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
    stop.days.forEach((day) => {
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
    });

    // Transport to next stop
    if (stop.transportFromPrevious) {
      const transport = stop.transportFromPrevious;
      markdown += `**Getting here:** ${transport.mode} (${transport.duration}) · ${transport.costEstimate}\n\n`;
    }

    // Transport to next stop (if not last)
    if (stopIdx < itinerary.stops.length - 1) {
      const nextStop = itinerary.stops[stopIdx + 1];
      const nextTransport = nextStop.transportFromPrevious;

      if (nextTransport) {
        markdown += `**To ${nextStop.location}:** ${nextTransport.mode} (${nextTransport.duration}) · ${nextTransport.costEstimate}\n\n`;
      }
    }
  });

  return markdown;
}
