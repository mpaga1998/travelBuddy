/**
 * OpenAI client and itinerary generation
 */

import OpenAI from 'openai';
import { NormalizedTripInput } from '../types/trip.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import { computeTripContext } from './tripContext.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an itinerary using OpenAI GPT
 * @param input Normalized and validated trip planning parameters
 * @param firstName Optional user first name for personalization
 * @returns Generated itinerary text
 * @throws Error if generation fails
 */
export async function generateItinerary(
  input: NormalizedTripInput,
  firstName?: string
): Promise<string> {
  // Compute comprehensive trip context (all date math, location analysis, categorization)
  const context = computeTripContext(input);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(input, context, firstName);

  console.log('[OpenAI] Generating itinerary for trip:', {
    arrival: input.arrival.date,
    departure: input.departure.date,
    totalNights: context.totalNights,
    category: context.tripLengthCategory,
    firstName,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    max_tokens: 3000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  console.log('[OpenAI] Itinerary generated successfully');
  return content;
}
