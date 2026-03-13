/**
 * Render day-based itinerary to markdown
 */

import { StructuredItinerary } from './itinerarySchema.js';

export function renderDayBasedItinerary(
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
  markdown += `- **Total nights:** ${itinerary.constraints.nightsAllocated}\n`;
  markdown += `- **From:** ${itinerary.constraints.arrivalLocation} → **To:** ${itinerary.constraints.departureLocation}\n\n`;

  // Day-by-day breakdown
  itinerary.days.forEach((day) => {
    markdown += `## Day ${day.dayNumber}\n\n`;

    // Group activities by location for clarity
    const locationGroups: { [location: string]: typeof day.activities } = {};
    day.activities.forEach((activity) => {
      if (!locationGroups[activity.location]) {
        locationGroups[activity.location] = [];
      }
      locationGroups[activity.location].push(activity);
    });

    // Render activities in order they appear
    day.activities.forEach((activity) => {
      const timeLabel = activity.time.charAt(0).toUpperCase() + activity.time.slice(1);
      
      let line = `- **${timeLabel}:** `;
      
      // Add location for clarity (especially for travel)
      if (activity.isTravel) {
        line += `🚄 Travel to ${activity.location}: ${activity.description}`;
      } else {
        line += `${activity.description} (${activity.location})`;
      }

      if (activity.durationEstimate?.trim()) {
        line += ` (~${activity.durationEstimate})`;
      }

      if (activity.isTravel && activity.costEstimate) {
        line += ` · ${activity.costEstimate}`;
      }

      markdown += line + '\n';
    });

    markdown += '\n';

    // Sleep info
    if (day.sleep) {
      markdown += `🌙 **Sleep in:** ${day.sleep.location}\n\n`;
    }
  });

  return markdown;
}
