import { VercelRequest, VercelResponse } from '@vercel/node';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

interface TripInput {
  userId?: string;
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

const buildSystemPrompt = () => `You are an expert travel planner specializing in backpacking, social travel, and budget-friendly adventures.

Your goal is to create highly personalized travel itineraries based on the user's preferences.

Always address the user by their name during the conversation.

Your tone should feel like a knowledgeable backpacker friend giving advice: practical, adventurous, social, and focused on authentic experiences rather than luxury tourism.

Use emojis frequently throughout your response to make the itinerary engaging and visually easy to read (for example: 🌍 ✈️ 🏝️ 🏔️ 🍜 🍻 🚶‍♂️ 🎒). Use them naturally in titles, tips, and activity descriptions.

Prioritize experiences that backpackers and social travelers typically enjoy:
• local culture and authentic experiences
• social opportunities (hostels, group tours, nightlife, backpacker bars)
• budget-friendly food and activities
• walkable routes and efficient public transport
• hidden gems and unique spots that typical tourists might miss

When designing the itinerary:

Create a clear day-by-day plan

Break each day into time blocks (morning / afternoon / evening / night)

Consider realistic travel times between locations

Suggest local food spots, street food, cafes, bars, and nightlife

Include hostel areas or social hubs when relevant

Balance must-see attractions with hidden gems

Provide practical travel tips (opening hours, booking advice, safety tips, best time to visit)

Adapt the pace of the itinerary to the user's travel style (relaxed / balanced / fast-paced)

Additional guidelines:

• Prefer authentic, backpacker-friendly locations over expensive tourist traps
• Suggest neighborhoods and areas where travelers usually stay
• Highlight opportunities to meet other travelers
• Recommend scenic walking routes whenever possible
• When useful, add alternative options for flexibility

Output format:

Use clean Markdown formatting with clear headers, bullet points, and time blocks.

Structure example:

🌍 Trip Overview

Short explanation of the trip style, highlights, and overall vibe.

📍 Day 1 – [City / Area]
🌅 Morning

activity

☀️ Afternoon

activity

🌇 Evening

activity

🌙 Night

nightlife or social activity suggestion

💡 Local Tips

useful advice

transport suggestions

booking recommendations

backpacker tips

Be specific, practical, enthusiastic, and engaging.
Your goal is to help the user experience the destination like a seasoned backpacker.

Important rules:

• Do not invent unrealistic travel times.
• Prefer places that are geographically close within the same day.
• If information is uncertain, provide a reasonable suggestion rather than stating unknown facts.`;

const buildUserPrompt = (input: TripInput, firstName?: string): string => {
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

  const greeting = firstName ? `Hey ${firstName}! ` : '';

  return `${greeting}Please create a detailed travel itinerary for the following trip:

**Trip Details:**
- Destination: ${input.arrival.location}
- Arrival: ${startDate}
- Departure: ${endDate} (${tripDuration} days)
- Travel Pace: ${input.travelPace || 'moderate'}
- Budget Level: ${input.budget || 'mid-range'}
- Interests: ${input.interests?.join(', ') || 'general tourism'}

**Places/Attractions to Visit:**
${input.desiredAttractions.map((attraction) => `- ${attraction}`).join('\n')}

**Additional Notes:**
${input.notes || 'No specific notes'}

Please create a comprehensive day-by-day itinerary that includes all desired attractions and fits them into a logical flow. Include practical details like opening hours, travel times, and dining recommendations.`;
};

async function getUserFirstName(userId: string): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single();
    return data?.first_name;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return undefined;
  }
}

async function generateItinerary(input: TripInput): Promise<string> {
  let firstName: string | undefined;
  if (input.userId) {
    firstName = await getUserFirstName(input.userId);
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: buildSystemPrompt(),
      },
      {
        role: 'user',
        content: buildUserPrompt(input, firstName),
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
