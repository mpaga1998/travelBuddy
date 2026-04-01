import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

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
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
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

  try {
    console.log('📌 [SAVE] Route called');

    const {
      userId,
      title,
      markdown,
      arrivalLocation,
      departureLocation,
      startDate,
      endDate,
      travelPace,
      budget,
      interests,
    } = req.body;

    console.log('📌 [SAVE] Received payload:', {
      userId: userId ? '✅ present' : '❌ missing',
      title: title ? `✅ "${title}"` : '❌ missing',
      markdown: markdown ? `✅ (${markdown.length} chars)` : '❌ missing',
      arrivalLocation,
      departureLocation,
      startDate,
      endDate,
    });

    // Validate required fields
    if (!userId || !title || !markdown) {
      console.error('❌ [SAVE] Validation failed - missing required fields');
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, title, markdown',
      });
      return;
    }

    console.log('✅ [SAVE] Validation passed, attempting to insert...');

    // Log what we're inserting
    console.log('📌 [SAVE] Inserting with:', {
      user_id: userId,
      title,
      markdown_content_length: markdown.length,
      arrival_location: arrivalLocation,
      departure_location: departureLocation,
      start_date: startDate,
      end_date: endDate,
      travel_pace: travelPace,
      budget,
      interests: interests?.length || 0,
    });

    // Insert into itineraries table
    const { data, error } = await supabase
      .from('itineraries')
      .insert({
        user_id: userId,
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

    console.log('📌 [SAVE] Insert response:', { dataReceived: !!data, errorReceived: !!error });

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

    console.log('✅ [SAVE] Successfully saved itinerary:', { itineraryId: data.id, title, userId });

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
      details: error instanceof Error ? error.stack : undefined,
    });
  }
}
