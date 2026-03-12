import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { TripInput, ItineraryResponse } from './lib/types.js';
import { generateItinerary } from './lib/openai.js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
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
    const response: ItineraryResponse = {
      success: false,
      itinerary: '',
      error: 'Method not allowed',
    };
    res.status(405).json(response);
    return;
  }

  try {
    const tripInput: TripInput = req.body;

    // Validation
    if (!tripInput.arrival?.date || !tripInput.departure?.date) {
      const response: ItineraryResponse = {
        success: false,
        itinerary: '',
        error: 'Arrival and departure dates are required',
      };
      res.status(400).json(response);
      return;
    }

    // Generate itinerary
    const itinerary = await generateItinerary(tripInput);

    const response: ItineraryResponse = {
      success: true,
      itinerary,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error('Itinerary generation error:', error);
    
    let statusCode = 500;
    let errorMessage = 'Failed to generate itinerary';
    
    if (error instanceof Error) {
      if (error.message.includes('validation')) {
        statusCode = 400;
        errorMessage = error.message;
      } else {
        errorMessage = error.message;
      }
    }
    
    const response: ItineraryResponse = {
      success: false,
      itinerary: '',
      error: errorMessage,
    };
    res.status(statusCode).json(response);
  }
}
