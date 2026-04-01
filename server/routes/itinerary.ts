import express, { Request, Response } from 'express';
import { generateItinerary, TripInput } from '../services/openaiService';
import { generateSuggestions } from '../lib/itineraryRefinement';
import { initSupabase } from '../lib/supabaseServer.js';

const router = express.Router();

// POST /api/itinerary - generate itinerary
router.post('/', async (req: Request, res: Response) => {
  try {
    // ⏱️ TIMING: Start endpoint timer
    const routeStartTime = Date.now();
    
    const tripInput: TripInput = req.body;

    // Basic validation
    if (!tripInput.arrival || !tripInput.departure) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: arrival and departure dates/locations',
      });
      return;
    }

    console.log('📝 Generating itinerary:', {
      arrival: `${tripInput.arrival.location} on ${tripInput.arrival.date} at ${tripInput.arrival.time || 'unspecified'}`,
      departure: `${tripInput.departure.location} on ${tripInput.departure.date} at ${tripInput.departure.time || 'unspecified'}`,
      stops: tripInput.stops,
      attractions: tripInput.desiredAttractions,
      pace: tripInput.travelPace,
      budget: tripInput.budget,
      interests: tripInput.interests,
      notes: tripInput.notes,
    });
    
    console.log('⏱️ [TIMING] Starting itinerary generation...');
    const itinerary = await generateItinerary(tripInput);
    const routeTime = Date.now() - routeStartTime;
    console.log(`⏱️ [TIMING] SERVER ROUTE TOTAL TIME: ${routeTime}ms (${(routeTime / 1000).toFixed(2)}s)`);
    
    res.json({
      success: true,
      itinerary,
    });
  } catch (error) {
    console.error('❌ Error generating itinerary:', error);
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Failed to generate itinerary';
    let suggestions: string[] = [];
    
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        statusCode = 400;
        errorMessage = error.message;
        
        // Generate helpful suggestions based on error context
        const context = (error as any).context;
        if (context) {
          suggestions = generateSuggestions(tripInput, context);
        }
      } else if (error.message.includes('OPENAI_API_KEY')) {
        statusCode = 500;
        errorMessage = 'OpenAI API not configured';
      } else {
        errorMessage = error.message;
      }
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      ...(suggestions.length > 0 && { suggestions }),
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/itinerary/save - save itinerary to profile
router.post('/save', async (req: Request, res: Response) => {
  try {
    console.log('📌 [SAVE] Route called');
    
    // Initialize Supabase on first use
    let supabaseServer: any;
    try {
      supabaseServer = initSupabase();
    } catch (e) {
      console.error('❌ [SAVE] Supabase initialization failed:', e);
      res.status(500).json({
        success: false,
        error: e instanceof Error ? e.message : 'Supabase not configured',
      });
      return;
    }

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

    // Insert into itineraries table (userId is already sent from client, no need to verify)
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

    const { data, error } = await supabaseServer
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

    res.json({
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
});

export default router;
