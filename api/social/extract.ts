/**
 * B1.2: POST /api/social/extract
 *
 * Accepts a public social post URL, fetches its caption via oEmbed (Tier 1),
 * runs the LLM place extractor, geocodes each candidate, and returns a ranked
 * list the frontend uses to confirm / edit before saving to the user's map.
 *
 * Guard stack (mirrors api/itinerary.ts):
 *   CORS → OPTIONS short-circuit → requireAuth → validateBodySize →
 *   enforceRateLimit → moderateText → fetchSocialMetadata →
 *   extractAndGeocodeSocialPlaces → respond
 *
 * B0.1 attribution: sourceUrl + author are always included in the response
 * so the frontend can display and store them alongside any saved place.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { applyCors } from '../lib/cors.js';
import { requireAuth } from '../lib/requireAuth.js';
import { validateBodySize } from '../lib/validateBodySize.js';
import {
  enforceRateLimit,
  SOCIAL_EXTRACT_RATE_LIMIT,
} from '../lib/rateLimit.js';
import {
  moderateText,
  MODERATION_REJECTION_MESSAGE,
} from '../lib/moderation.js';
import { captureApiError } from '../lib/sentryServer.js';
import { createLogger } from '../lib/log.js';
import {
  fetchSocialMetadata,
  PlatformUnavailableError,
  UnsupportedPlatformError,
} from '../lib/socialFetch.js';
import {
  extractAndGeocodeSocialPlaces,
  type SocialCandidate,
} from '../lib/extractPlaces.js';

dotenv.config();

interface SocialExtractResponse {
  success: boolean;
  candidates?: SocialCandidate[];
  platform?: string;
  /** Attribution fields — must be shown / stored with any saved place. */
  attribution?: {
    sourceUrl: string;
    author?: string;
    thumbnailUrl?: string;
  };
  error?: string;
  /** True when the platform requires credentials we don't have (Instagram). */
  platformUnavailable?: boolean;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  applyCors(req, res);
  const log = createLogger(req);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' } satisfies SocialExtractResponse);
    return;
  }

  // 🔐 Auth
  const user = await requireAuth(req, res);
  if (!user) return;

  // 📦 Body size guard
  if (!validateBodySize(req, res)) return;

  // 🚦 Rate limit (lower cap than itinerary — 20/hr)
  if (!(await enforceRateLimit(user.id, res, SOCIAL_EXTRACT_RATE_LIMIT))) return;

  // ── Parse + validate body ─────────────────────────────────────────────────
  const { url } = (req.body ?? {}) as { url?: unknown };

  if (!url || typeof url !== 'string') {
    res.status(400).json({
      success: false,
      error: '`url` is required and must be a string.',
    } satisfies SocialExtractResponse);
    return;
  }

  // Basic URL format check before hitting any external service.
  try {
    new URL(url);
  } catch {
    res.status(400).json({
      success: false,
      error: 'Invalid URL — please paste the full link including https://.',
    } satisfies SocialExtractResponse);
    return;
  }

  log.info({ userId: user.id, url }, 'SOCIAL_EXTRACT: Request received');

  try {
    // ── 1. Fetch social metadata (oEmbed) ─────────────────────────────────
    const metadata = await fetchSocialMetadata(url);
    log.info(
      { platform: metadata.platform, captionLen: metadata.caption.length },
      'SOCIAL_EXTRACT: Metadata fetched'
    );

    // ── 2. Moderate caption before spending LLM tokens ────────────────────
    if (metadata.caption.trim()) {
      const moderation = await moderateText(metadata.caption);
      if (moderation.flagged) {
        log.warn(
          { userId: user.id, categories: moderation.categories },
          'SOCIAL_EXTRACT: Caption rejected by moderation'
        );
        res.status(400).json({
          success: false,
          error: MODERATION_REJECTION_MESSAGE,
        } satisfies SocialExtractResponse);
        return;
      }
    }

    // ── 3. Nothing to extract ─────────────────────────────────────────────
    if (!metadata.caption.trim()) {
      log.info('SOCIAL_EXTRACT: Caption empty — returning 0 candidates');
      res.status(200).json({
        success: true,
        candidates: [],
        platform: metadata.platform,
        attribution: {
          sourceUrl: metadata.sourceUrl,
          author: metadata.author,
          thumbnailUrl: metadata.thumbnailUrl,
        },
      } satisfies SocialExtractResponse);
      return;
    }

    // ── 4. Extract + geocode ──────────────────────────────────────────────
    const candidates = await extractAndGeocodeSocialPlaces(metadata.caption);
    log.info(
      { count: candidates.length, platform: metadata.platform },
      'SOCIAL_EXTRACT: Done'
    );

    const response: SocialExtractResponse = {
      success: true,
      candidates,
      platform: metadata.platform,
      attribution: {
        sourceUrl: metadata.sourceUrl,
        author: metadata.author,
        thumbnailUrl: metadata.thumbnailUrl,
      },
    };
    res.status(200).json(response);
  } catch (err) {
    // ── Platform-specific errors ──────────────────────────────────────────
    if (err instanceof PlatformUnavailableError) {
      log.info({ platform: err.platform }, 'SOCIAL_EXTRACT: Platform unavailable');
      res.status(422).json({
        success: false,
        error: err.message,
        platform: err.platform,
        platformUnavailable: true,
      } satisfies SocialExtractResponse);
      return;
    }

    if (err instanceof UnsupportedPlatformError) {
      log.info('SOCIAL_EXTRACT: Unsupported platform');
      res.status(422).json({
        success: false,
        error: err.message,
      } satisfies SocialExtractResponse);
      return;
    }

    // ── Unexpected error ──────────────────────────────────────────────────
    log.error(
      { err: err instanceof Error ? err.message : err },
      'SOCIAL_EXTRACT: Unexpected error'
    );
    captureApiError(err, { userId: user.id });

    res.status(500).json({
      success: false,
      error: 'Failed to extract places from this link. The post may be private or the platform may be temporarily unavailable.',
    } satisfies SocialExtractResponse);
  }
}
