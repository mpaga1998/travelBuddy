/**
 * OpenAI service for API endpoints
 * Implements the structured itinerary generation pipeline
 */

import OpenAI from 'openai';
import { TripInput } from './types.js';
import { validateTripInput, calculateNights } from './inputValidation.js';
import {
  extractJSON,
  ExtractionError,
  ValidationError,
  validateStructuredItinerary,
} from './jsonExtraction.js';
import { renderToMarkdown } from './itineraryRendering.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import {
  generateSuggestions,
  buildRefinementPrompt,
  GenerationContext,
} from './itineraryRefinement.js';
import { generateItineraryDayBased } from './dayBasedGeneration.js';
import { buildStructuredPlanningPrompt } from './structuredPrompts.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerationResult {
  markdown: string;
  suggestions: string[];
}

/**
 * Get first name from request input
 */
function getUserFirstNameFromRequest(input: TripInput): string | undefined {
  if (input.userFirstName) {
    console.log(
      '✅ [Vercel] Using firstName from request:',
      input.userFirstName
    );
    return input.userFirstName;
  }
  return undefined;
}

/**
 * Legacy text-based itinerary generation (fallback)
 */
async function generateItineraryFallback(
  input: TripInput,
  firstName?: string
): Promise<string> {
  console.warn('⚠️ Using fallback text-based generation');

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(),
      },
      {
        role: 'user',
        content: buildUserPrompt(input, firstName),
      },
    ],
    max_tokens: 3000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  return content;
}

/**
 * Structured itinerary generation with validation pipeline + fallback chain
 * Tries: day-based → stop-based → text fallback
 */
export async function generateItinerary(
  input: TripInput,
  options: { maxRetries?: number } = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  console.log('📋 [Vercel] Generating itinerary for:', input.arrival.location);

  // STEP 1: Validate input
  const validationErrors = validateTripInput(input);
  if (validationErrors.length > 0) {
    console.error('❌ Input validation failed:', validationErrors);
    throw new Error(
      `Input validation failed: ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
    );
  }

  const firstName = getUserFirstNameFromRequest(input);
  console.log('✅ Input validated. Planning for:', firstName || 'traveler');

  // Try day-based generation first (PRIMARY)
  try {
    console.log('🎯 Attempting day-based generation (PRIMARY)...');
    return await generateItineraryDayBased(input, options);
  } catch (dayBasedError) {
    console.error(
      '⚠️ Day-based generation failed (1 initial + 1 retry), trying text-based fallback:',
      dayBasedError instanceof Error ? dayBasedError.message : dayBasedError
    );
  }

  // Skip stop-based, go directly to text fallback
  try {
    console.log('📄 Using text-based generation (FALLBACK)...');
    return await generateItineraryFallback(input, firstName);
  } catch (textFallbackError) {
    console.error(
      '❌ All generation methods failed:',
      textFallbackError instanceof Error
        ? textFallbackError.message
        : textFallbackError
    );
    throw new Error('Failed to generate itinerary using all available methods');
  }
}


