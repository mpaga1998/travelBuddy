import { VercelRequest, VercelResponse } from '@vercel/node';
import { TripInput, ItineraryResponse } from '../server/lib/types/trip';
import { validateTripInput, normalizeTripInput } from '../server/lib/validation';
import { buildTripContext, TripContext } from '../server/lib/tripContext';
import { initializeOpenAI } from '../server/lib/openai';
import { planItinerary } from '../server/lib/planner';
import { renderItineraryMarkdown } from '../server/lib/renderer';

const openai = initializeOpenAI();

/**
 * Generate an itinerary through two phases:
 * 1. Planning: Call planner to get a structured ItineraryPlan
 * 2. Rendering: Convert plan to markdown
 */
async function generateItinerary(context: TripContext): Promise<string> {
  // Phase 1: Planning
  const planningResult = await planItinerary(context, openai);

  if (!planningResult.success || !planningResult.plan) {
    // Fallback: if planning fails, throw error (will be caught by handler)
    throw new Error(planningResult.error || 'Failed to generate plan');
  }

  const plan = planningResult.plan;

  // Phase 2: Rendering
  const markdownItinerary = renderItineraryMarkdown(plan);

  return markdownItinerary;
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
    const tripInput = req.body as TripInput;

    // Validate input
    const validation = validateTripInput(tripInput);
    if (!validation.valid) {
      // Format error messages: "field1: message1; field2: message2"
      const errorMessage = validation.errors
        .map((err) => `${err.field}: ${err.message}`)
        .join('; ');

      const response: ItineraryResponse = {
        success: false,
        itinerary: '',
        error: errorMessage,
      };
      res.status(400).json(response);
      return;
    }

    // Normalize input: trim strings, remove empty arrays, apply defaults
    const normalizedInput = normalizeTripInput(tripInput);

    // Build trip context: pre-compute all dates, durations, and categorization
    const tripContext = buildTripContext(normalizedInput);

    // Generate itinerary using the computed trip context
    const itinerary = await generateItinerary(tripContext);

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
