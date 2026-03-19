/**
 * Analytical Itinerary Rendering - Format analytical output with metadata
 */

import { TripFeasibilityAnalysis } from './feasibilityAnalyzer';

export function renderAnalyticalItinerary(
  analyticalMarkdown: string,
  feasibility: TripFeasibilityAnalysis,
  firstName?: string
): string {
  // Add header with key info
  let output = '';

  // Generation method indicator
  output += `> ✅ **Generated with Analytical Planning** (feasibility-aware itinerary)\n\n`;

  // Quick stats header
  output += `## 📊 Trip Summary\n`;
  output += `- **Dates:** ${feasibility.arrivalDate} to ${feasibility.departureDate}\n`;
  output += `- **Duration:** ${feasibility.calendarDays} calendar days, ${feasibility.nightsAvailable} nights\n`;
  output += `- **Assessment:** ${feasibility.overallAssessment.toUpperCase()}\n`;
  
  if (feasibility.majorChallenges.length > 0) {
    output += `- **Major Challenges:** ${feasibility.majorChallenges.join(', ')}\n`;
  }
  
  output += '\n---\n\n';

  // Location feasibility quick reference
  output += `## 🎯 Location Feasibility Reference\n`;
  feasibility.locations.forEach(loc => {
    const emoji = loc.rating === 'easy' ? '✅' : loc.rating === 'medium' ? '⚠️' : '❌';
    output += `${emoji} **${loc.name}** — ${loc.rating.toUpperCase()}\n`;
    if (loc.timeNeeded) output += `   Time needed: ${loc.timeNeeded}\n`;
    if (loc.requirements && loc.requirements.length > 0) {
      output += `   Requirements: ${loc.requirements.join(', ')}\n`;
    }
  });
  output += '\n---\n\n';

  // The main analytical itinerary from GPT
  output += analyticalMarkdown;

  // Footer with suggestions
  if (feasibility.suggestions.length > 0) {
    output += '\n\n---\n\n';
    output += `## 💡 Expert Suggestions to Make This Work\n`;
    feasibility.suggestions.forEach(suggestion => {
      output += `- ${suggestion}\n`;
    });
  }

  return output;
}
