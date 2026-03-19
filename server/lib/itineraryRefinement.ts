/**
 * Suggestion and refinement utilities for itinerary generation
 */

import { TripInput } from '../services/openaiService.js';
import { calculateNights } from './inputValidation.js';

export interface GenerationContext {
  nightsAvailable: number;
  nightsAllocated?: number;
  validationErrors: string[];
  validationWarnings: string[];
  attemptNumber: number;
}

/**
 * Generate user-friendly suggestions based on validation errors
 */
export function generateSuggestions(
  input: TripInput,
  context: GenerationContext
): string[] {
  const suggestions: string[] = [];
  const nights = calculateNights(input);

  // Night allocation issues
  if (context.validationErrors.some((e) => e.includes('Night count mismatch'))) {
    suggestions.push(
      `Consider adjusting your trip dates: you have ${nights} nights available. Try extending by 1-2 days for more flexibility.`
    );
  }

  // Feasibility issues
  if (context.validationErrors.some((e) => e.includes('infeasible'))) {
    const numAttractions = input.desiredAttractions?.length || 0;
    if (numAttractions > 2) {
      suggestions.push(
        `Your trip might be too ambitious. Try focusing on ${Math.max(1, numAttractions - 1)} key locations instead of ${numAttractions}.`
      );
    }
    suggestions.push(
      `Consider increasing your trip duration to allow realistic travel time between locations.`
    );
  }

  // Travel pace suggestions
  if (
    (!input.travelPace || input.travelPace === 'active') &&
    nights < 7
  ) {
    suggestions.push(
      `For a short trip (${nights} days), a relaxed pace might be more enjoyable than active. Would you like to adjust?`
    );
  }

  // No attractions provided
  if (!input.desiredAttractions || input.desiredAttractions.length === 0) {
    suggestions.push(
      `Tip: Adding specific attractions (e.g., "Issyk Kul Lake", "Burana Tower") helps create more personalized itineraries.`
    );
  }

  // Budget-pace mismatch
  if (input.budget === 'budget' && input.travelPace === 'active') {
    suggestions.push(
      `Active pace often requires more budget for transport. Consider a balanced pace to optimize costs.`
    );
  }

  return suggestions;
}

/**
 * Build a refinement prompt for retry attempts
 */
export function buildRefinementPrompt(
  basePrompt: string,
  context: GenerationContext
): string {
  let refinement = basePrompt;

  if (context.validationErrors.length === 0) {
    return basePrompt;
  }

  refinement += `\n\n---\n\n**CRITICAL REFINEMENTS (Attempt ${context.attemptNumber + 1}):**\n`;
  refinement += `\nErrors found: ${context.validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`;

  if (context.validationErrors.some((e) => e.includes('Night count mismatch'))) {
    refinement += `\n**FIX 1 - EXACT NIGHT COUNT**: nightsAllocated MUST be EXACTLY ${context.nightsAvailable}\n`;
    refinement += `   Current: ${context.nightsAllocated || '?'} | Expected: ${context.nightsAvailable}\n`;
    refinement += `   → Verify by ADDING all stop.totalNights: they must sum to exactly ${context.nightsAvailable}\n`;
    refinement += `   → Count carefully: ${context.nightsAvailable} nights = ${context.nightsAvailable + 1} calendar days\n`;
  }

  if (context.validationErrors.some((e) => e.includes('activity'))) {
    refinement += `\n**FIX 2 - ACTIVITIES**: Each activity MUST have:\n`;
    refinement += `   - description (required, non-empty)\n`;
    refinement += `   - durationEstimate (required, e.g., "2 hours")\n`;
    refinement += `   - time field is OPTIONAL (can be "morning", "afternoon", or "night" if specified)\n`;
    refinement += `   - At least 1 activity per day\n`;
  }

  if (context.validationErrors.some((e) => e.includes('Date'))) {
    refinement += `\n**FIX 3 - DATES**: Use YYYY-MM-DD format exactly\n`;
    refinement += `   - startDate: "${basePrompt.match(/startDate.*?(\d{4}-\d{2}-\d{2})/)?.[1] || 'YYYY-MM-DD'}"\n`;
    refinement += `   - endDate: same format\n`;
  }

  if (context.validationErrors.some((e) => e.includes('location'))) {
    refinement += `\n**FIX 4 - LOCATIONS**: Every day and stop must have a non-empty location field\n`;
  }

  refinement += `\n\nRegenerate the ENTIRE JSON response with these fixes. Return ONLY the corrected JSON in triple backticks.`;

  return refinement;
}
