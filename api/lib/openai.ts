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
 *
 * Measured reality (P1 usage logs, 2026-07-14): the nook prompt style writes
 * ~2,000–3,000 tokens per day — per-meal restaurant options, cost lines,
 * venue links, and tips add up fast. The old 1,100/day estimate truncated a
 * multi-day Mumbai itinerary at Day 2 morning. Budget generously: the cost
 * delta is ~1 cent at gpt-4o-mini output pricing, and undersizing burns the
 * FULL cost anyway while delivering a broken result.
 *
 * Cap at 16000 (gpt-4o-mini's output ceiling is 16,384). Note the Anthropic
 * fallback clamps to its own 8,192 limit inside llm.ts — fallback runs may
 * still truncate very long trips, which the finishReason log makes visible.
 */
function computeMaxTokens(input: TripInput): number {
  const nights = calculateNights(input);
  const days = Math.max(1, nights + 1);
  const estimated = 1500 + days * 2500;
  return Math.min(16000, Math.max(4000, estimated));
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



