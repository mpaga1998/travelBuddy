/**
 * LLM abstraction layer (A4.1)
 *
 * Single entry point for all streaming text generation.
 * Supports OpenAI and Anthropic as interchangeable providers.
 *
 * Env vars:
 *   LLM_PROVIDER            "openai" | "anthropic"  — primary provider (default: openai)
 *   LLM_FALLBACK_PROVIDER   "openai" | "anthropic" | "none"
 *                           — fallback on retriable errors (default: the other provider,
 *                             auto-detected from which API key is present; "none" disables)
 *
 *   OPENAI_API_KEY          required when provider is openai
 *   OPENAI_FALLBACK_MODEL   model name for OpenAI (default: gpt-4o-mini)
 *
 *   ANTHROPIC_API_KEY       required when provider is anthropic
 *   ANTHROPIC_MODEL         model name for Anthropic (default: claude-3-5-haiku-20241022)
 *
 * Switching primary provider: set LLM_PROVIDER=anthropic in Vercel.
 * Disabling fallback:         set LLM_FALLBACK_PROVIDER=none.
 *
 * The abstraction is transparent to callers — streamCompletion() always yields
 * plain string chunks regardless of which provider is active.
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from './log.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamOptions {
  maxTokens: number;
  temperature?: number;
}

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

type Provider = 'openai' | 'anthropic';

function resolvePrimary(): Provider {
  return process.env.LLM_PROVIDER?.toLowerCase() === 'anthropic' ? 'anthropic' : 'openai';
}

function resolveFallback(primary: Provider): Provider | null {
  const val = process.env.LLM_FALLBACK_PROVIDER?.toLowerCase();
  if (val === 'none') return null;
  if (val === 'openai') return 'openai';
  if (val === 'anthropic') return 'anthropic';
  // Auto: use the other provider — but only if its API key is present.
  if (primary === 'openai' && process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (primary === 'anthropic' && process.env.OPENAI_API_KEY) return 'openai';
  return null;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/** True for errors that are safe to retry on a different provider. */
function isRetriable(err: unknown): boolean {
  if (err instanceof OpenAI.APIError) {
    return err.status === 429 || err.status >= 500;
  }
  if (err instanceof Anthropic.APIError) {
    return err.status === 429 || err.status >= 500;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('econnrefused') || msg.includes('timeout') || msg.includes('etimedout');
  }
  return false;
}

// ---------------------------------------------------------------------------
// Provider-specific stream initiators
// ---------------------------------------------------------------------------

/**
 * Eagerly initiates an OpenAI streaming request (HTTP call happens here).
 * Returns an AsyncIterable<string> of text chunks.
 * Throws on auth / rate-limit / server errors before any chunk is yielded.
 */
async function initiateOpenAI(
  messages: LLMMessage[],
  options: StreamOptions,
): Promise<AsyncIterable<string>> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_FALLBACK_MODEL ?? 'gpt-4o-mini';

  logger.info({ provider: 'openai', model, maxTokens: options.maxTokens }, 'LLM: initiating stream');

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    // P1: the final chunk carries token usage when include_usage is set.
    stream_options: { include_usage: true },
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_completion_tokens: options.maxTokens,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
  });

  return (async function* () {
    let usage: OpenAI.CompletionUsage | undefined;
    let finishReason: string | null = null;
    for await (const chunk of stream) {
      if (chunk.usage) usage = chunk.usage;
      if (chunk.choices[0]?.finish_reason) finishReason = chunk.choices[0].finish_reason;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
    // P1: unit-economics source of truth — € per itinerary derives from this line.
    // finishReason 'length' = output truncated at max_tokens: full cost, broken result.
    logger.info(
      {
        provider: 'openai',
        model,
        promptTokens: usage?.prompt_tokens ?? null,
        completionTokens: usage?.completion_tokens ?? null,
        totalTokens: usage?.total_tokens ?? null,
        finishReason,
      },
      'LLM: usage',
    );
  })();
}

/**
 * Eagerly initiates an Anthropic streaming request (HTTP call happens here).
 * Anthropic separates the system prompt from the messages array.
 * Returns an AsyncIterable<string> of text chunks.
 * Throws on auth / rate-limit / server errors before any chunk is yielded.
 */
async function initiateAnthropic(
  messages: LLMMessage[],
  options: StreamOptions,
): Promise<AsyncIterable<string>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-haiku-20241022';

  // Clamp to haiku's output ceiling — callers may budget up to 16k for the
  // OpenAI path, which this API would reject outright.
  const maxTokens = Math.min(options.maxTokens, 8192);

  logger.info({ provider: 'anthropic', model, maxTokens }, 'LLM: initiating stream');

  const systemContent = messages.find((m) => m.role === 'system')?.content;
  const userMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const stream = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(systemContent && { system: systemContent }),
    messages: userMessages,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    stream: true,
  });

  return (async function* () {
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let stopReason: string | null = null;
    for await (const event of stream) {
      if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      }
      if (event.type === 'message_delta') {
        if (event.usage) outputTokens = event.usage.output_tokens; // cumulative — last one wins
        if (event.delta.stop_reason) stopReason = event.delta.stop_reason;
      }
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text;
      }
    }
    // P1: unit-economics source of truth — € per itinerary derives from this line.
    // finishReason 'max_tokens' = output truncated: full cost, broken result.
    logger.info(
      {
        provider: 'anthropic',
        model,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens !== null && outputTokens !== null ? inputTokens + outputTokens : null,
        finishReason: stopReason,
      },
      'LLM: usage',
    );
  })();
}

const INITIATORS: Record<Provider, typeof initiateOpenAI> = {
  openai: initiateOpenAI,
  anthropic: initiateAnthropic,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Unified streaming completion.
 *
 * Yields plain string chunks as they arrive from the active provider.
 * On a retriable error (rate-limit / 5xx / network), automatically falls back
 * to the secondary provider and logs which one was ultimately used.
 * Non-retriable errors (bad request, auth) are re-thrown immediately.
 */
export async function* streamCompletion(
  messages: LLMMessage[],
  options: StreamOptions,
): AsyncGenerator<string> {
  const primary = resolvePrimary();
  const fallback = resolveFallback(primary);

  let source: AsyncIterable<string>;
  let usedProvider = primary;

  try {
    source = await INITIATORS[primary](messages, options);
  } catch (err) {
    if (!fallback || !isRetriable(err)) {
      logger.error(
        { provider: primary, err: err instanceof Error ? err.message : err },
        'LLM: primary failed, no retriable fallback available',
      );
      throw err;
    }
    logger.warn(
      {
        primaryProvider: primary,
        fallbackProvider: fallback,
        err: err instanceof Error ? err.message : err,
      },
      'LLM: primary stream failed — switching to fallback provider',
    );
    source = await INITIATORS[fallback](messages, options);
    usedProvider = fallback;
  }

  logger.info({ provider: usedProvider }, 'LLM: stream started');

  yield* source;

  logger.info({ provider: usedProvider }, 'LLM: stream completed');
}
