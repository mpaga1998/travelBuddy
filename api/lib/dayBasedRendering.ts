/**
 * Render day-based itinerary to markdown
 */

import { StructuredItinerary } from './itinerarySchema.js';

export function renderDayBasedItinerary(
  itinerary: StructuredItinerary,
  firstName?: string
): string {
  let markdown = '';

  // Header - use arrival location for destination
  const destination = itinerary.constraints.arrivalLocation || 'Your Trip';
  
  if (firstName) {
    markdown += `# ${firstName}'s ${destination} Itinerary\n\n`;
  } else {
    markdown += `# Your ${destination} Itinerary\n\n`;
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
      const timeEmoji = activity.time ? {
        morning: '🌅',
        afternoon: '☀️',
        night: '🌆',
      }[activity.time] : '⏱️';

      if (activity.isTravel) {
        const timeLabel = activity.time ? activity.time.charAt(0).toUpperCase() + activity.time.slice(1) : 'Travel';
        markdown += `- ${timeEmoji} **${timeLabel}:** 🚄 Travel to ${activity.location}`;
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
        const timeLabel = activity.time ? activity.time.charAt(0).toUpperCase() + activity.time.slice(1) : '';
        markdown += `- ${timeEmoji} **${timeLabel}${timeLabel ? ': ' : ''}${activity.description}`;
        
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
