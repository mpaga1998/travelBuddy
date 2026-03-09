import express from 'express';
import { generateItinerary } from '../services/openaiService';
const router = express.Router();
// POST /api/itinerary - generate itinerary
router.post('/', async (req, res) => {
    try {
        const tripInput = req.body;
        // Basic validation
        if (!tripInput.arrival || !tripInput.departure) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: arrival and departure dates/locations',
            });
            return;
        }
        if (!tripInput.desiredAttractions || tripInput.desiredAttractions.length === 0) {
            res.status(400).json({
                success: false,
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
    }
    catch (error) {
        console.error('❌ Error generating itinerary:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate itinerary',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
export default router;
