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

  if (context.validationErrors.some((e) => e.includes('Night count mismatch'))) {
    refinement += `\n1. **EXACT NIGHT REQUIREMENT**: nightsAllocated must be EXACTLY ${context.nightsAvailable}, not ${context.nightsAllocated || 'unknown'}\n`;
    refinement += `   - Double-check: sum all stop.totalNights = ${context.nightsAvailable}\n`;
    refinement += `   - Do NOT round or approximate\n`;
  }

  if (context.validationErrors.some((e) => e.includes('activity'))) {
    refinement += `\n2. **DAILY STRUCTURE**: Each day MUST have morning, afternoon, AND evening activities\n`;
    refinement += `   - Never skip a time period\n`;
    refinement += `   - Include durationEstimate for each\n`;
  }

  if (context.validationErrors.some((e) => e.includes('transport'))) {
    refinement += `\n3. **TRANSPORT DETAILS**: Always include for transitions between stops\n`;
    refinement += `   - First stop can skip transportFromPrevious\n`;
    refinement += `   - Include: mode, duration (string like "3 hours"), costEstimate\n`;
  }

  refinement += `\n\nRegenerate with these fixes applied.`;

  return refinement;
}
