import type { ItineraryInput, ItineraryResponse } from './types';
import { supabase } from '../../lib/supabaseClient';

// Single deploy target is Vercel - frontend always talks to /api, relative.
// VITE_API_BASE_URL can override for staging/preview setups that point elsewhere.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Pull the current Supabase JWT for the signed-in user.
 * Throws if the user is not signed in - callers should surface that to the UI.
 */
async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Failed to read Supabase session:', error.message);
    throw new Error('Could not read your session. Please sign in again.');
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('You need to be signed in to do that.');
  }
  return token;
}

/**
 * Generate an itinerary with streaming tokens.
 *
 * When `onToken` is provided, we request the streaming (text/plain) endpoint
 * and fire the callback every time a new chunk arrives from the server. The
 * promise resolves with the full concatenated text once the stream ends.
 *
 * If `onToken` is omitted, we fall back to the legacy JSON-blob response for
 * any caller that just wants a one-shot result.
 *
 * The server signals a mid-stream failure by appending
 *   __ITINERARY_ERROR__:<message>
 * at the end of the body — we detect that and throw instead of resolving.
 */
const STREAM_ERROR_MARKER = '__ITINERARY_ERROR__:';

export async function generateItinerary(
  input: ItineraryInput,
  onToken?: (delta: string, accumulated: string) => void
): Promise<string> {
  console.log('Fetching from:', `${API_BASE}/itinerary`);

  try {
    const token = await getAccessToken();

    // Streaming mode: ask the server for text/plain and read incrementally.
    if (onToken) {
      const response = await fetch(`${API_BASE}/itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/plain',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      console.log('Response status (stream):', response.status);

      if (!response.ok || !response.body) {
        // Server rejected before streaming started — parse JSON error.
        const error = await response.json().catch(() => ({}));
        console.error('API error:', error);
        throw new Error(
          error.message ||
            error.error ||
            `Failed to generate itinerary: ${response.statusText}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        if (!delta) continue;
        accumulated += delta;
        onToken(delta, accumulated);
      }
      // Flush any trailing bytes from the decoder.
      const tail = decoder.decode();
      if (tail) {
        accumulated += tail;
        onToken(tail, accumulated);
      }

      // Server appends __ITINERARY_ERROR__:<msg> if generation failed
      // mid-stream. Strip it and throw so the UI can show the error.
      const errIdx = accumulated.lastIndexOf(STREAM_ERROR_MARKER);
      if (errIdx !== -1) {
        const message =
          accumulated.slice(errIdx + STREAM_ERROR_MARKER.length).trim() ||
          'Itinerary generation failed';
        throw new Error(message);
      }

      return accumulated;
    }

    // Legacy JSON path for non-streaming callers.
    const response = await fetch(`${API_BASE}/itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.e