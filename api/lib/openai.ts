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
      '⚠️ Day-based generation failed, trying stop-based fallback:',
      dayBasedError instanceof Error ? dayBasedError.message : dayBasedError
    );
  }

  // Fall back to stop-based generation (SECONDARY)
  try {
    console.log('📝 Attempting stop-based generation (FALLBACK 1)...');
    return await generateItineraryStopBased(input, options);
  } catch (stopBasedError) {
    console.error(
      '⚠️ Stop-based generation failed, trying text fallback:',
      stopBasedError instanceof Error ? stopBasedError.message : stopBasedError
    );
  }

  // Final fallback to text generation (TERTIARY)
  try {
    console.log('📄 Using text-based generation (FALLBACK 2)...');
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

/**
 * Stop-based generation (legacy, used as first fallback)
 */
async function generateItineraryStopBased(
  input: TripInput,
  options: { maxRetries?: number } = {}
): Promise<string> {
  const maxRetries = options.maxRetries ?? 1;
  const nights = calculateNights(input);

  const firstName = getUserFirstNameFromRequest(input);

  let lastValidationContext: GenerationContext = {
    nightsAvailable: nights,
    validationErrors: [],
    validationWarnings: [],
    attemptNumber: 0,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      let prompt = buildStructuredPlanningPrompt(input, firstName);

      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt} with refinements...`);
        prompt = buildRefinementPrompt(prompt, {
          ...lastValidationContext,
          attemptNumber: attempt,
        });
      }

      console.log('🤖 Calling OpenAI with stop-based prompt...');
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_PLANNING_MODEL || 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert trip planner. Return ONLY valid JSON wrapped in triple backticks. No other text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new ExtractionError('No response from OpenAI', '');
      }

      console.log('📦 Received response, extracting JSON...');

      let structuredItinerary;
      try {
        structuredItinerary = extractJSON(responseText);
      } catch (error) {
        if (error instanceof ExtractionError) {
          console.error('❌ JSON extraction failed:', error.message);
          throw error;
        }
        throw error;
      }

      console.log('✅ JSON extracted. Validating structure...');

      const validationResult = validateStructuredItinerary(
        structuredItinerary,
        input
      );

      lastValidationContext = {
        nightsAvailable: nights,
        nightsAllocated: structuredItinerary.constraints.nightsAllocated,
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings,
        attemptNumber: attempt,
      };

      if (!validationResult.valid) {
        console.error('❌ Structure validation failed:', validationResult.errors);

        if (attempt < maxRetries) {
          console.log(
            `⚠️ Validation failed but retrying (attempt ${attempt + 1}/${maxRetries})...`
          );
          continue;
        }

        const error = new ValidationError(
          'Itinerary structure validation failed after retries',
          validationResult.errors,
          validationResult.warnings,
          structuredItinerary
        );
        (error as any).context = lastValidationContext;
        throw error;
      }

      if (validationResult.warnings.length > 0) {
        console.warn('⚠️ Validation warnings:', validationResult.warnings);
      }

      console.log('✅ Structure validated. Rendering to markdown...');

      const markdown = renderToMarkdown(structuredItinerary, firstName);
      console.log('✅ Itinerary generated successfully (stop-based)');

      return markdown;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          '⚠️ Stop-based generation failed after retries:',
          error instanceof Error ? error.message : error
        );
        throw error;
      }
    }
  }

  throw new Error('Stop-based generation exhausted retries');
}
