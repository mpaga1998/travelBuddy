/**
 * Day-based itinerary generation pipeline
 * Structured planning with explicit location tracking and travel as first-class activities
 */

import OpenAI from 'openai';
import { TripInput } from './types.js';
import { validateTripInput, calculateNights } from './inputValidation.js';
import { buildDayBasedPlanningPrompt } from './dayBasedPrompt.js';
import { extractJSONStructure, ExtractionError } from './jsonExtraction.js';
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
              'You are an expert Italian trip planner. Return ONLY valid JSON wrapped in triple backticks. Every activity MUST have an explicit location. Travel is an activity. No teleportation allowed.',
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
        structuredItinerary = extractJSONStructure<StructuredItinerary>(
          responseText
        );
      } catch (error) {
        if (error instanceof ExtractionError) {
          console.error('❌ JSON extraction failed:', error.message);
          throw error;
        }
        throw error;
      }

      console.log('✅ JSON extracted. Validating structure...');

      // STEP 4: Validate against constraints
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
        console.error('❌ Validation failed:', validationResult.errors);

        if (attempt < maxRetries) {
          console.log(
            `⚠️ Validation failed but retrying (attempt ${attempt + 1}/${maxRetries})...`
          );
          continue;
        }

        const error = new ValidationError(
          'Itinerary validation failed after retries',
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

      console.log('✅ Validation passed. Rendering to markdown...');

      // STEP 5: Render to markdown
      const markdown = renderDayBasedItinerary(structuredItinerary, firstName);
      console.log('✅ Itinerary generated successfully (day-based)');

      return markdown;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(
          '❌ Day-based generation failed after retries:',
          error instanceof Error ? error.message : error
        );
        throw error;
      }

      console.error(
        `⚠️ Attempt ${attempt + 1} failed, retrying:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw new Error('Day-based generation exhausted all retries');
}
