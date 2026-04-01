import express, { Request, Response } from 'express';
import { generateItinerary, TripInput } from '../services/openaiService';
import { generateSuggestions } from '../lib/itineraryRefinement';
import { supabase } from '../../src/lib/supabaseClient.js';

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

    // Validate required fields
    if (!userId || !title || !markdown) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, title, markdown',
      });
      return;
    }

    // Validate user is authenticated and saving their own itinerary
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - must be authenticated user',
      });
      return;
    }

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

    if (error) {
      console.error('❌ Error saving itinerary:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to save itinerary',
      });
      return;
    }

    console.log('✅ Itinerary saved:', { itineraryId: data.id, title, userId });

    res.json({
      success: true,
      itineraryId: data.id,
      message: 'Itinerary saved successfully',
    });
  } catch (error) {
    console.error('❌ Error in save route:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
