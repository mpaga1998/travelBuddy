import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import {
  generateItinerary as generateItineraryFromOpenAI,
} from '../server/services/openaiService';
import { TripInput } from '../src/features/itinerary/types';

// Load environment variables
dotenv.config();

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Enable CORS for development and production
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tripInput: TripInput = req.body;

    // Validation
    if (!tripInput.arrivalDate || !tripInput.departureDate) {
      return res
        .status(400)
        .json({ error: 'Arrival and departure dates are required' });
    }

    if (!tripInput.attractions || tripInput.attractions.length === 0) {
      return res
        .status(400)
        .json({ error: 'At least one attraction or activity is required' });
    }

    // Generate itinerary
    const itinerary = await generateItineraryFromOpenAI(tripInput);

    return res.status(200).json(itinerary);
  } catch (error) {
    console.error('Itinerary generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate itinerary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
