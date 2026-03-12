import express, { Request, Response } from 'express';
import { generateItinerary, TripInput } from '../services/openaiService';
import { generateSuggestions } from '../lib/itineraryRefinement';

const router = express.Router();

// POST /api/itinerary - generate itinerary
router.post('/', async (req: Request, res: Response) => {
  try {
    const tripInput: TripInput = req.body;

    // Basic validation
    if (!tripInput.arrival || !tripInput.departure) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: arrival and departure dates/locations',
      });
      return;
    }

    console.log('📝 Generating itinerary for:', tripInput.arrival.location);
    const itinerary = await generateItinerary(tripInput);
    
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

export default router;
