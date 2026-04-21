/**
 * OpenAI service for API endpoints
 * Implements the structured itinerary generation pipeline
 */

import OpenAI from 'openai';
import { TripInput } from './types.js';
import { validateTripInput, calculateNights } from './inputValidation.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerationResult {
  markdown: string;
  suggestions: string[];
}

/**
 * Text-based itinerary generation (PRIMARY)
 * Generates natural language itineraries with hardcoded dates/times that cannot be changed.
 *
 * `options.firstName` is used for prompt personalization. It MUST be fetched server-side
 * from the verified user's profile by the caller (see api/itinerary.ts). Do NOT accept a
 * first name from the request body — it would let users impersonate others in the output.
 */
export async function generateItinerary(
  input: TripInput,
  options: { maxRetries?: number; firstName?: string } = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  console.log('📋 [Itinerary] Generating text-based itinerary for:', input.arrival.location);

  // STEP 1: Validate input
  const validationErrors = validateTripInput(input);
  if (validationErrors.length > 0) {
    console.error('❌ Input validation failed:', validationErrors);
    throw new Error(
      `Input validation failed: ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
    );
  }

  const firstName = options.firstName;
  console.log('✅ Input validated. Planning for:', firstName || 'traveler');

  // STEP 2: Generate text-based itinerary
  try {
    const selectedModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-3.5-turbo';
    console.log(`📄 Generating text-based itinerary using model: ${selectedModel}`);
    const response = await openai.chat.completions.create({
      model: selectedModel,
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

    console.log('✅ Itinerary generated successfully');
    return content;
  } catch (error) {
    console.error(
      '❌ Itinerary generation failed:',
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}


