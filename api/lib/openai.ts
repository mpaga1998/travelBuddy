/**
 * OpenAI service for API endpoints
 * Implements the structured itinerary generation pipeline
 */

import OpenAI from 'openai';
import { TripInput } from './types';
import { validateTripInput } from './inputValidation';
import { buildStructuredPlanningPrompt } from './structuredPrompts';
import {
  extractJSON,
  ExtractionError,
  ValidationError,
  validateStructuredItinerary,
} from './jsonExtraction';
import { renderToMarkdown } from './itineraryRendering';
import { buildSystemPrompt, buildUserPrompt } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    model: 'gpt-3.5-turbo',
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
 * Structured itinerary generation with validation pipeline
 * Validates input → Requests structured JSON → Extracts & validates → Renders → Falls back if needed
 */
export async function generateItinerary(input: TripInput): Promise<string> {
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

  try {
    // STEP 2: Request structured JSON output
    const prompt = buildStructuredPlanningPrompt(input, firstName);

    console.log('🤖 Calling OpenAI with structured prompt...');
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
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
    const validationResult = validateStructuredItinerary(
      structuredItinerary,
      input
    );

    if (!validationResult.valid) {
      console.error('❌ Structure validation failed:', validationResult.errors);
      throw new ValidationError(
        'Itinerary structure validation failed',
        validationResult.errors,
        validationResult.warnings,
        structuredItinerary
      );
    }

    if (validationResult.warnings.length > 0) {
      console.warn('⚠️ Validation warnings:', validationResult.warnings);
    }

    console.log('✅ Structure validated. Rendering to markdown...');

    // STEP 5: Render to markdown
    const markdown = renderToMarkdown(structuredItinerary, firstName);
    console.log('✅ Itinerary generated successfully (structured)');

    return markdown;
  } catch (error) {
    // FALLBACK: If anything fails, try legacy text-based approach
    console.error(
      '⚠️ Structured generation failed, falling back:',
      error instanceof Error ? error.message : error
    );

    if (error instanceof ExtractionError) {
      console.error('❌ Could not extract JSON from response');
    } else if (error instanceof ValidationError) {
      console.error('❌ Generated itinerary failed validation');
    }

    try {
      console.log('📝 Attempting fallback text generation...');
      return await generateItineraryFallback(input, firstName);
    } catch (fallbackError) {
      console.error('❌ Fallback generation also failed:', fallbackError);
      throw new Error(
        `Failed to generate itinerary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
