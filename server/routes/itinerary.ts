import express, { Request, Response } from 'express';
import { generateItinerary, TripInput } from '../services/openaiService';

const router = express.Router();

router.post('/generate', async (req: Request, res: Response) => {
  try {
    const tripInput: TripInput = req.body;

    // Basic validation
    if (!tripInput.arrival || !tripInput.departure) {
      res.status(400).json({
        error: 'Missing required fields: arrival and departure dates/locations',
      });
      return;
    }

    if (!tripInput.desiredAttractions || tripInput.desiredAttractions.length === 0) {
      res.status(400).json({
        error: 'At least one desired attraction is required',
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
    res.status(500).json({
      error: 'Failed to generate itinerary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
