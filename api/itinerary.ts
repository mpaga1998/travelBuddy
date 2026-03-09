import { VercelRequest, VercelResponse } from '@vercel/node';
import { TripInput, ItineraryResponse } from '../server/lib/types/trip';
import { validateTripInput } from '../server/lib/validation';
import { buildSystemPrompt, buildUserPrompt } from '../server/lib/prompts';
import { initializeOpenAI } from '../server/lib/openai';

const openai = initializeOpenAI();

/**
 * Generate an itinerary based on trip input.
 * Calls OpenAI with system and user prompts.
 */
async function generateItinerary(input: TripInput): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(),
      },
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
    max_tokens: 3000,
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content received from OpenAI');
  }

  return content;
}


/**
 * Main Vercel handler for POST requests to generate itineraries.
 * Request body: TripInput
 * Response: ItineraryResponse
 */
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

  // Only POST allowed
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

    // Validate input
    const validation = validateTripInput(tripInput);
    if (!validation.valid) {
      const response: ItineraryResponse = {
        success: false,
        itinerary: '',
        error: validation.error,
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
    const response: ItineraryResponse = {
      success: false,
      itinerary: '',
      error:
        error instanceof Error ? error.message : 'Failed to generate itinerary',
    };
    res.status(500).json(response);
  }
}
