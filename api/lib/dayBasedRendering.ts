/**
 * Render day-based itinerary to markdown with enhanced conversational style
 * Matches the app's backpacker vibe with visual scanning, reasoning, and practical details
 */

import { StructuredItinerary } from './itinerarySchema.js';

// Time-of-day emoji mapping
const TIME_EMOJI: Record<string, string> = {
  morning: '🌅',
  afternoon: '☀️',
  night: '🌙',
};

export function renderDayBasedItinerary(
  itinerary: StructuredItinerary,
  firstName?: string
): string {
  let markdown = '';

  // Header - personalized greeting
  const destination = itinerary.constraints.arrivalLocation || 'Your Trip';
  const personalization = firstName ? `${firstName}'s` : 'Your';
  
  markdown += `# 🎒 ${personalization} ${destination} Adventure\n\n`;

  // Make it feel friendly from the start
  markdown += `Get ready for an amazing trip! Here's your personalized itinerary designed to help you make the most of your time.\n\n`;

  // Feasibility notice (at top, clear visibility)
  if (!itinerary.feasible) {
    markdown += `⚠️ **Feasibility Note:** ${itinerary.feasibilityNotes || 'This itinerary may be challenging to execute as planned.'}\n\n`;
  } else if (itinerary.feasibilityNotes) {
    markdown += `📌 **Planning Note:** ${itinerary.feasibilityNotes}\n\n`;
  }

  // Trip overview with more context
  const nights = itinerary.days.reduce((total, day) => {
    return total + (day.sleep ? 1 : 0);
  }, 0);
  const activityCount = itinerary.days.reduce(
    (total, day) => total + day.activities.filter(a => !a.isTravel).length,
    0
  );
  const locationCount = new Set(itinerary.days.flatMap(d => d.activities.map(a => a.location))).size;

  markdown += `---\n\n`;
  markdown += `## 📍 Trip Snapshot\n`;
  markdown += `- **Dates:** ${itinerary.constraints.startDate} to ${itinerary.constraints.endDate}\n`;
  markdown += `- **Duration:** ${itinerary.days.length} days, ${nights} nights\n`;
  markdown += `- **Route:** ${itinerary.constraints.arrivalLocation} → ${itinerary.constraints.departureLocation}\n`;
  markdown += `- **Locations:** Visiting ${locationCount} ${locationCount === 1 ? 'place' : 'places'}\n`;
  markdown += `- **Activities:** ${activityCount} main experiences\n\n`;

  // Day-by-day breakdown
  itinerary.days.forEach((day) => {
    const isArrivalDay = day.dayNumber === 1;
    const isDepartureDay = day.dayNumber === itinerary.days.length;
    
    // Day header with vibe
    let dayVibe = '';
    if (isArrivalDay) {
      dayVibe = ' 🛬 Arrival & Settling In';
    } else if (isDepartureDay) {
      dayVibe = ' ✈️ Final Adventures';
    } else if (day.dayNumber === 2) {
      dayVibe = ' 🌟 First Full Day';
    } else if (day.dayNumber === itinerary.days.length - 1) {
      dayVibe = ' 🌅 Last Full Day';
    }

    markdown += `## Day ${day.dayNumber}${dayVibe}\n\n`;

    // Separate travel from activities
    const travelActivities = day.activities.filter(a => a.isTravel);
    const regularActivities = day.activities.filter(a => !a.isTravel);

    // Show travel/transit info first (if present)
    if (travelActivities.length > 0) {
      markdown += `### 🚄 Transit\n`;
      travelActivities.forEach((activity) => {
        const timeLabel = activity.time
          ? activity.time.charAt(0).toUpperCase() + activity.time.slice(1)
          : 'Travel';
        markdown += `- **${timeLabel}:** → **${activity.location}**`;
        if (activity.travelMode) {
          markdown += ` (${activity.travelMode})`;
        }
        if (activity.durationEstimate) {
          markdown += ` \`${activity.durationEstimate}\``;
        }
        if (activity.costEstimate) {
          markdown += ` • ${activity.costEstimate}`;
        }
        markdown += '\n';
      });
      markdown += '\n';
    }

    // Group regular activities by location for visual organization
    if (regularActivities.length > 0) {
      const locationGroups = new Map<string, typeof regularActivities>();
      regularActivities.forEach((activity) => {
        const location = activity.location || 'Unknown Location';
        if (!locationGroups.has(location)) {
          locationGroups.set(location, []);
        }
        locationGroups.get(location)!.push(activity);
      });

      markdown += `### 🎯 Experiences\n`;

      // Render activities grouped by location
      locationGroups.forEach((activities, location) => {
        markdown += `\n**📍 ${location}**\n`;
        
        activities.forEach((activity) => {
          const timeEmoji = activity.time ? (TIME_EMOJI[activity.time] || '⏱️') : '⏱️';

          markdown += `- ${timeEmoji} **${activity.description}**`;

          // Add venue link if available
          if (activity.venueName) {
            markdown += ` • *${activity.venueName}* [🗺️](mapbox:${encodeURIComponent(activity.venueName)}|${location})`;
          }

          // Duration and cost details
          if (activity.durationEstimate) {
            markdown += ` \`${activity.durationEstimate}\``;
          }
          if (activity.costEstimate) {
            markdown += ` • ${activity.costEstimate}`;
          }

          markdown += '\n';
        });
      });

      markdown += '\n';
    }

    // Sleep info - visual and clear
    if (day.sleep) {
      markdown += `### 🛏️ Overnight\n`;
      markdown += `Stay in **${day.sleep.location}**\n\n`;
    }

    // Day separator for visual scanning
    if (!isDepartureDay) {
      markdown += `---\n\n`;
    }
  });

  // Footer with encouragement
  markdown += `\n---\n\n`;
  markdown += `## 💡 Pro Tips\n`;
  markdown += `- Download offline maps and save this itinerary\n`;
  markdown += `- Check transit schedules the evening before travel days\n`;
  markdown += `- Leave room for serendipity—some of the best travel moments are unplanned!\n`;
  markdown += `- Pack light and stay flexible\n\n`;
  markdown += `**Happy travels! 🌍**\n`;

  return markdown;
}
