/**
 * Day-based itinerary generation pipeline
 * Uses structured planning with explicit location tracking and travel activities
 */

import OpenAI from 'openai';
import { TripInput } from './types.js';
import { validateTripInput, calculateNights } from './inputValidation.js';
import { buildDayBasedPlanningPrompt } from './dayBasedPrompt.js';
import {
  extractJSON,
  ExtractionError,
} from './jsonExtraction.js';
import { renderDayBasedItinerary } from './dayBasedRendering.js';
import { validateDayBasedItinerary } from './dayBasedValidation.js';
import { StructuredItinerary } from './itinerarySchema.js';
import {
  buildRefinementPrompt,
  GenerationContext,
} from './itineraryRefinement.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: string[],
    public warnings: string[],
    public itinerary?: StructuredItinerary
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Day-based structured itinerary generation with validation pipeline + retry mechanism
 */
export async function generateItineraryDayBased(
  input: TripInput,
  options: { maxRetries?: number } = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const maxRetries = options.maxRetries ?? 2;
  const nights = calculateNights(input);

  console.log('📋 [Day-Based] Generating itinerary for:', input.arrival.location);

  // STEP 1: Validate input
  const validationErrors = validateTripInput(input);
  if (validationErrors.length > 0) {
    console.error('❌ Input validation failed:', validationErrors);
    throw new Error(
      `Input validation failed: ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
    );
  }

  const firstName = input.userFirstName || undefined;
  console.log('✅ Input validated. Planning for:', firstName || 'traveler');

  let lastValidationContext: GenerationContext = {
    nightsAvailable: nights,
    validationErrors: [],
    validationWarnings: [],
    attemptNumber: 0,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // STEP 2: Request structured JSON output
      let prompt = buildDayBasedPlanningPrompt(input, firstName);

      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt} with refinements...`);
        prompt = buildRefinementPrompt(prompt, {
          ...lastValidationContext,
          attemptNumber: attempt,
        });
      }

      console.log('🤖 Calling OpenAI with day-based prompt...');
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_PLANNING_MODEL || 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert trip planner. Return ONLY valid JSON wrapped in triple backticks. Activities must have explicit locations. Travel is an activity.',
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

      // STEP 3: Extract JSON from response
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

      // STEP 4: Validate structure against constraints
      const validationResult = validateDayBasedItinerary(
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

        // If we have retries left, don't throw yet
        if (attempt < maxRetries) {
          console.log(
            `⚠️ Validation failed but retrying (attempt ${attempt + 1}/${maxRetries})...`
          );
          continue;
        }

        // No retries left, throw error
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

      // STEP 5: Render to markdown
      const markdown = renderDayBasedItinerary(structuredItinerary, firstName);
      console.log('✅ Itinerary generated successfully (day-based)');

      return markdown;
    } catch (error) {
      // Only proceed to fallback on final attempt
      if (attempt === maxRetries) {
        console.error(
          '⚠️ Day-based generation failed after retries:',
          error instanceof Error ? error.message : error
        );

        throw error;
      }
    }
  }

  throw new Error('Itinerary generation failed');
}
