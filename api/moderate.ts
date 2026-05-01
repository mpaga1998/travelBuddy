import type { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { requireAuth } from './lib/requireAuth.js';
import { validateBodySize } from './lib/validateBodySize.js';
import { moderateText } from './lib/moderation.js';

dotenv.config();

/**
 * POST /api/moderate
 *
 * Run user-supplied text through the OpenAI moderation endpoint and return
 * { flagged, categories }. Used by the client-side pin-creation flow because
 * pins are inserted directly via Supabase from the browser — there is no
 * server-side insert hook to plug into, so the client pre-flights the text
 * here before it calls createPin().
 *
 * Itinerary generation runs moderation inline in api/itinerary.ts — no
 * separate round-trip needed for that path.
 *
 * Auth + body-size guards mirror the other handlers. No rate limiter:
 * moderation is the FREE endpoint, abuse risk is low, and the itinerary
 * route already protects the expensive generation path.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS — mirror api/itinerary.ts so the browser can call us cross-origin
  // when running locally against a deployed API.
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  // 🔐 Verify JWT — anonymous requests don't get to spend our moderation
  // budget, modest as it is.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 📦 Body-size cap. Same 100KB ceiling as the itinerary route.
  if (!validateBodySize(req, res)) return;

  const body = (req.body ?? {}) as { text?: unknown };
  const text = typeof body.text === 'string' ? body.text : '';

  // Empty input is allowed by definition — short-circuit, no API call.
  if (!text.trim()) {
    res.status(200).json({ success: true, flagged: false, categories: [] });
    return;
  }

  const { flagged, categories } = await moderateText(text);
  res.status(200).json({ success: true, flagged, categories: categories ?? [] });
}
