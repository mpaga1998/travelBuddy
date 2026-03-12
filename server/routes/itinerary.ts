import express, { Request, Response } from 'express';
import { generateItinerary, TripInput } from '../services/openaiService';

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
    
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        statusCode = 400;
        errorMessage = error.message;
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
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
