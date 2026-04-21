import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { initSupabase } from '../lib/supabaseServer.js';
import { requireAuth } from '../lib/requireAuth.js';
import { validateBodySize } from '../lib/validateBodySize.js';

// Load environment variables
dotenv.config();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed',
    });
    return;
  }

  // 🔐 Verify JWT. On failure, requireAuth already wrote the 401.
  const user = await requireAuth(req, res);
  if (!user) return;

  // 📦 Reject oversized payloads (saved itineraries can be long — still cap at 100KB).
  if (!validateBodySize(req, res)) return;

  try {
    console.log('📌 [SAVE] Route called for user', user.id);

    // NB: any `userId` in the body is ignored. The verified user from the JWT is
    // the only source of truth for ownership.
    const {
      title,
      markdown,
      arrivalLocation,
      departureLocation,
      startDate,
      endDate,
      travelPace,
      budget,
      interests,
    } = req.body ?? {};

    console.log('📌 [SAVE] Received payload:', {
      userId: user.id,
      title: title ? `✅ "${title}"` : '❌ missing',
      markdown: markdown ? `✅ (${markdown.length} chars)` : '❌ missing',
      arrivalLocation,
      departureLocation,
      startDate,
      endDate,
    });

    // Validate required fields
    if (!title || !markdown) {
      console.error('❌ [SAVE] Validation failed - missing required fields');
      res.status(400).json({
        success: false,
        error: 'Missing required fields: title, markdown',
      });
      return;
    }

    let supabase;
    try {
      supabase = initSupabase();
    } catch (e) {
      console.error('❌ [SAVE] Supabase initialization failed:', e);
      res.status(500).json({
        success: false,
        error: e instanceof Error ? e.message : 'Supabase not configured',
      });
      return;
    }

    console.log('✅ [SAVE] Validation passed, attempting to insert...');

    // Insert into itineraries table — user_id comes from verified JWT, not the body.
    const { data, error } = await supabase
      .from('itineraries')
      .insert({
        user_id: user.id,
        title,
        markdown_content: markdown,
        arrival_location: arrivalLocation,
        departure_location: departureLocation,
        start_date: startDate,
        end_date: endDate,
        travel_pace: travelPace,
        budget,
        interests: interests || [],
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ [SAVE] Database error:', {
        message: error.message,
        code: (error as any).code,
        details: (error as any).details,
        hint: (error as any).hint,
      });
      res.status(400).json({
        success: false,
        error: `Database error: ${error.message}`,
        details: (error as any).details,
      });
      return;
    }

    if (!data) {
      console.error('❌ [SAVE] No data returned after insert');
      res.status(400).json({
        success: false,
        error: 'Failed to save itinerary - no ID returned',
      });
      return;
    }

    console.log('✅ [SAVE] Successfully saved itinerary:', { itineraryId: data.id, title, userId: user.id });

    res.status(200).json({
      success: true,
      itineraryId: data.id,
      message: 'Itinerary saved successfully',
    });
  } catch (error) {
    console.error('❌ [SAVE] Catch block error:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      type: typeof error,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
