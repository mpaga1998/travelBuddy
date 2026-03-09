import { ItineraryPlan } from './types/plan';
import { formatDateReadable } from './date';

/**
 * Convert a structured ItineraryPlan to readable markdown.
 * This is the rendering layer - separates logic (planning) from presentation (markdown).
 */
export function renderItineraryMarkdown(plan: ItineraryPlan): string {
  let markdown = '';

  // Header
  if (!plan.isFeasible) {
    markdown += `# ⚠️ Revised Trip Proposal\n\n`;
    markdown += `**Status**: This route is not feasible as originally planned.\n\n`;
  } else {
    markdown += `# Your ${plan.summary}\n\n`;
  }

  // Summary and warnings
  markdown += `**Routing**: ${plan.summary}\n`;
  markdown += `**Total allocated**: ${plan.totalNights} nights across ${plan.route.length} location(s)\n\n`;

  if (plan.warnings.length > 0) {
    markdown += `## ⚠️ Warnings\n\n`;
    plan.warnings.forEach((warning) => {
      markdown += `- ${warning}\n`;
    });
    markdown += '\n';
  }

  // Main itinerary section
  markdown += `## Itinerary\n\n`;

  plan.route.forEach((stop, index) => {
    markdown += `### ${stop.location} | Days ${stop.startDay}-${stop.endDay} | ${stop.nights} night${stop.nights > 1 ? 's' : ''}\n\n`;
    markdown += `${stop.reason}\n\n`;

    // Look for transport segment leaving this location
    const departingTransport = plan.transportSegments.find((seg) => seg.from === stop.location);
    if (departingTransport) {
      markdown += `**→ Transport to ${departingTransport.to}** (Day ${departingTransport.day})  \n`;
      markdown += `${departingTransport.mode}, ${departingTransport.estimatedDuration}, ~${departingTransport.cost}\n\n`;
    }
  });

  // Alternatives section
  if (plan.cutsOrAlternatives.length > 0) {
    markdown += `## 💡 Suggested Alternatives\n\n`;
    markdown += `If the above feels too ambitious, consider:\n\n`;
    plan.cutsOrAlternatives.forEach((alt) => {
      markdown += `- ${alt}\n`;
    });
    markdown += '\n';
  }

  // Feasibility footer
  if (!plan.isFeasible) {
    markdown += `---\n\n`;
    markdown += `**Recommendation**: The planned route is too ambitious for the available time. Review the alternatives above, or let me know if you'd like to adjust the dates or desired attractions.\n`;
  } else if (plan.warnings.length > 0) {
    markdown += `---\n\n`;
    markdown += `**Note**: This itinerary is feasible but may feel tight. See warnings above.\n`;
  }

  return markdown;
}
