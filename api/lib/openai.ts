/**
 * OpenAI service for API endpoints
 * Implements the structured itinerary generation pipeline
 */

import { logger } from './log.js';
import { TripInput } from './types.js';
import { streamCompletion } from './llm.js';
import { validateTripInput, calculateNights } from './inputValidation.js';
import { buildSystemPrompt, buildUserPrompt } from './prompts.js';
import type { TravelContext } from './travelContext.js';
import type { PlacesContext } from './placesContext.js';
import type { CommunityPinsContext } from './communityPins.js';
import type { WeatherContext } from './weatherContext.js';
import type { PracticalContext } from './practicalContext.js';
import type { BudgetContext } from './budgetContext.js';

export interface GenerationResult {
  markdown: string;
  suggestions: string[];
}

/**
 * Pick a max_tokens budget sized to the trip length.
 * Each day needs ~700 tokens to cover: activity blocks, 2-3 restaurant
 * suggestions per meal, a cost table, and smart tips. Add 800 tokens of
 * fixed overhead for the intro, outro, and before-you-go section.
 * Floor at 1500 (covers the fixed overhead for any 1-day trip).
 * Cap at 8000 — well inside gpt-4o-mini's 16k output limit while keeping
 * the worst-case cost reasonable.
 */
function computeMaxTokens(input: TripInput): number {
  const nights = calculateNights(input);
  const days = Math.max(1, nights + 1);
  const estimated = 1200 + days * 1100;
  return Math.min(8000, Math.max(3000, estimated));
}

/**
 * Text-based itinerary generation (PRIMARY) — streaming.
 * Generates natural language itineraries with hardcoded dates/times that cannot be changed.
 *
 * Streams tokens to the provided `onToken` callback as they arrive from OpenAI,
 * and also returns the full concatenated text when the stream completes. This lets
 * the HTTP handler pipe chunks to the client for a responsive UX while still being
 * able to log/verify the full result on the server.
 *
 * `options.firstName` is used for prompt personalization. It MUST be fetched server-side
 * from the verified user's profile by the caller (see api/itinerary.ts). Do NOT accept a
 * first name from the request body — it would let users impersonate others in the output.
 */
export async function generateItinerary(
  input: TripInput,
  options: {
    maxRetries?: number;
    firstName?: string;
    onToken?: (delta: string) => void;
    travelContext?: TravelContext;
    placesContext?: PlacesContext;
    communityPinsContext?: CommunityPinsContext;
    weatherContext?: WeatherContext;
    practicalContext?: PracticalContext;
    budgetContext?: BudgetContext;
  } = {}
): Promise<string> {
  logger.info({ location: input.arrival.location }, 'OPENAI: Generating itinerary');

  // STEP 1: Validate input
  const validationErrors = validateTripInput(input);
  if (validationErrors.length > 0) {
    logger.error({ validationErrors }, 'OPENAI: Input validation failed');
    throw new Error(
      `Input validation failed: ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
    );
  }

  const firstName = options.firstName;
  logger.info({ firstName: firstName || 'traveler' }, 'OPENAI: Input validated');

  // STEP 2: Stream itinerary via the LLM abstraction layer (llm.ts).
  // Provider is controlled by LLM_PROVIDER env var (default: openai).
  // Automatic cross-provider fallback on rate-limit / 5xx.
  try {
    const maxTokens = computeMaxTokens(input);
    logger.info({ maxTokens }, 'OPENAI: Streaming itinerary');

    const messages = [
      { role: 'system' as const, content: buildSystemPrompt() },
      {
        role: 'user' as const,
        content: buildUserPrompt(
          input,
          firstName,
          options.travelContext,
          options.placesContext,
          options.communityPinsContext,
          options.weatherContext,
          options.practicalContext,
          options.budgetContext,
        ),
      },
    ];

    let full = '';
    for await (const delta of streamCompletion(messages, { maxTokens, temperature: 0.7 })) {
      full += delta;
      options.onToken?.(delta);
    }

    if (!full) {
      throw new Error('No content received from LLM');
    }

    logger.info('OPENAI: Itinerary streamed successfully');
    return full;
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : error }, 'OPENAI: Itinerary generation failed');
    throw error;
  }
}



