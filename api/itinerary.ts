import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

interface TripInput {
  arrival: {
    date: string;
    location: string;
  };
  departure: {
    date: string;
    location: string;
  };
  desiredAttractions: string[];
  travelPace?: 'relaxed' | 'moderate' | 'active';
  interests?: string[];
  budget?: 'budget' | 'mid-range' | 'luxury';
  notes?: string;
}

interface ItineraryResponse {
  success: boolean;
  itinerary: string;
  error?: string;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const buildSystemPrompt = () => `You are an expert travel agent and itinerary planner. Your job is to create detailed, personalized travel itineraries based on user preferences.

When creating an itinerary:
1. Plan day-by-day with specific times and activities
2. Consider travel times between locations
3. Include practical information (opening hours, booking recommendations)
4. Suggest restaurants, cafes, and local experiences
5. Balance between must-sees and hidden gems
6. Account for the user's travel pace, interests and budget
7. Include logistics tips and local advice

Format the itinerary as markdown with clear sections using headers, bullet points, and time blocks.
Be specific, actionable, and enthusiastic about the destinations.`;

const buildUserPrompt = (input: TripInput): string => {
  const startDate = new Date(input.arrival.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const endDate = new Date(input.departure.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const tripDuration = Math.ceil(
    (new Date(input.departure.date).getTime() -
      new Date(input.arrival.date).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return `Please create a detailed travel itinerary for the following trip:

**Trip Details:**
- Destination: ${input.arrival.location}
- Duration: ${tripDuration} days (${startDate} to ${endDate})
- Interests: ${input.interests?.join(', ') || 'General tourism'}
- Travel Pace: ${input.travelPace || 'moderate'}
- Budget Level: ${input.budget || 'mid-range'}
- Desired Attractions/Activities: ${input.desiredAttractions.join(', ')}
${input.notes ? `- Additional Notes: ${input.notes}` : ''}

Please create a comprehensive, day-by-day itinerary that incorporates all the desired attractions and activities while considering the travel pace and budget constraints.`;
};

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

    if (!tripInput.desiredAttractions || tripInput.desiredAttractions.length === 0) {
      const response: ItineraryResponse = {
        success: false,
        itinerary: '',
        error: 'At least one attraction or activity is required',
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
