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
    markdown += `# ${firstName}'s Italian Itinerary\n\n`;
  } else {
    markdown += `# Your Italian Itinerary\n\n`;
  }

  // Feasibility notice
  if (!itinerary.feasible) {
    markdown += `⚠️ **Feasibility Note:** ${itinerary.feasibilityNotes || 'This itinerary may be challenging to execute as planned.'}\n\n`;
  } else if (itinerary.feasibilityNotes) {
    markdown += `📌 **Note:** ${itinerary.feasibilityNotes}\n\n`;
  }

  // Trip summary
  const nights = itinerary.days.reduce((total, day) => {
    return total + (day.sleep ? 1 : 0);
  }, 0);

  markdown += `## ✈️ Trip Overview\n`;
  markdown += `- **Dates:** ${itinerary.constraints.startDate} to ${itinerary.constraints.endDate}\n`;
  markdown += `- **Duration:** ${itinerary.days.length} days, ${nights} nights\n`;
  markdown += `- **Route:** ${itinerary.constraints.arrivalLocation} → ${itinerary.constraints.departureLocation}\n\n`;

  // Day-by-day breakdown
  itinerary.days.forEach((day) => {
    markdown += `## Day ${day.dayNumber}\n`;

    // Group activities by location for clarity
    const locationGroups = new Map<string, typeof day.activities>();
    day.activities.forEach((activity) => {
      const location = activity.location;
      if (!locationGroups.has(location)) {
        locationGroups.set(location, []);
      }
      locationGroups.get(location)!.push(activity);
    });

    // Render activities organized by location and time
    day.activities.forEach((activity) => {
      const timeEmoji = {
        morning: '🌅',
        afternoon: '☀️',
        evening: '🌆',
      }[activity.time];

      if (activity.isTravel) {
        markdown += `- ${timeEmoji} **${activity.time.charAt(0).toUpperCase() + activity.time.slice(1)}:** 🚄 Travel to ${activity.location}`;
        if (activity.travelMode) {
          markdown += ` (${activity.travelMode})`;
        }
        if (activity.durationEstimate) {
          markdown += ` • ${activity.durationEstimate}`;
        }
        if (activity.costEstimate) {
          markdown += ` • ${activity.costEstimate}`;
        }
      } else {
        markdown += `- ${timeEmoji} **${activity.time.charAt(0).toUpperCase() + activity.time.slice(1)}:** ${activity.description}`;
        
        // Add venue name with data attribute for client-side geocoding
        if (activity.venueName) {
          markdown += ` • **${activity.venueName}** [🗺️](mapbox:${encodeURIComponent(activity.venueName)}|${activity.location})`;
        } else if (activity.location) {
          markdown += ` (${activity.location})`;
        }
        
        if (activity.durationEstimate) {
          markdown += ` • ~${activity.durationEstimate}`;
        }
      }
      markdown += '\n';
    });

    // Sleep info
    if (day.sleep) {
      markdown += `\n🌙 **Sleep in:** ${day.sleep.location}\n`;
    }

    markdown += '\n';
  });

  return markdown;
}
