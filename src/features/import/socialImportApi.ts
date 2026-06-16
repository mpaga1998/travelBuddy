/**
 * B2.1: Client-side wrapper for POST /api/social/extract.
 *
 * Mirrors the pattern used by itineraryApi.ts — attaches the Supabase JWT
 * and deserialises the response into typed objects.
 */

import { supabase } from '../../lib/supabaseClient';

// ── Types (mirrors api/lib/extractPlaces.ts — kept separate to avoid
//    importing server-side code into the browser bundle) ──────────────────────

export type SocialPlaceType =
  | 'food'
  | 'sight'
  | 'nightlife'
  | 'shop'
  | 'transport'
  | 'accommodation'
  | 'other';

export type SocialConfidence = 'high' | 'medium' | 'low';

export interface SocialCandidate {
  name: string;
  lat: number;
  lng: number;
  type: SocialPlaceType;
  context: string;
  confidence: SocialConfidence;
  city?: string;
}

export interface SocialAttribution {
  sourceUrl: string;
  author?: string;
  thumbnailUrl?: string;
}

export interface SocialExtractResult {
  candidates: SocialCandidate[];
  platform: string;
  attribution: SocialAttribution;
}

// ── Error class ───────────────────────────────────────────────────────────────

export class PlatformUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformUnavailableError';
  }
}

// ── API call ──────────────────────────────────────────────────────────────────

/**
 * Extract places from a public social URL.
 *
 * Throws `PlatformUnavailableError` for platforms that require auth the app
 * doesn't have (currently Instagram). Throws a plain `Error` for other
 * failures (network, rate limit, moderation rejection, etc.).
 */
export async function extractFromUrl(url: string): Promise<SocialExtractResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You need to be signed in to import links.');

  const res = await fetch('/api/social/extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url }),
  });

  const data = (await res.json()) as {
    success: boolean;
    candidates?: SocialCandidate[];
    platform?: string;
    attribution?: SocialAttribution;
    error?: string;
    platformUnavailable?: boolean;
  };

  if (!res.ok || !data.success) {
    const msg = data.error ?? 'Failed to extract places from this link.';
    if (data.platformUnavailable) throw new PlatformUnavailableError(msg);
    throw new Error(msg);
  }

  return {
    candidates: data.candidates ?? [],
    platform: data.platform ?? 'unknown',
    attribution: data.attribution ?? { sourceUrl: url },
  };
}
