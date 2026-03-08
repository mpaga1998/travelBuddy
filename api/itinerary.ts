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

**CRITICAL: The user's name will be provided at the START of their message. You MUST use their name throughout the entire response:**
- Address them by name in the opening greeting
- Use their name when making personalized recommendations
- Include their name in key sections (Day N recommendations, tips addressed to them)
- Use their name in your closing remarks
- This makes the itinerary feel personally crafted for them.

Your tone should feel like a knowledgeable backpacker friend giving advice: practical, adventurous, social, and focused on authentic experiences rather than luxury tourism.

Use emojis frequently throughout your response to make the itinerary engaging and visually easy to read (for example: 🌍 ✈️ 🏝️ 🏔️ 🍜 🍻 🚶‍♂️ 🎒). Use them naturally in titles, tips, and activity descriptions.

Use proper Markdown formatting - do NOT use random asterisks. Only use (*text*) for italics and (**text**) for bold.

Prioritize experiences that backpackers and social travelers typically enjoy:
• local culture and authentic experiences
• social opportunities (hostels, group tours, nightlife, backpacker bars)
• budget-friendly food and activities
• walkable routes and efficient public transport
• hidden gems and unique spots that typical tourists might miss

When designing the itinerary:

Create a clear day-by-day plan with specific activities and times

Break each day into time blocks using emojis (🌅 Morning / ☀️ Afternoon / 🌇 Evening / 🌙 Night)

Consider realistic travel times between locations

Suggest specific local food spots, street food, cafes, bars, and neighborhoods

Include hostel areas or social hubs when relevant

Balance must-see attractions with hidden gems

Provide practical travel tips with opening hours, booking advice, transport tips, and local insights

Adapt the pace to the user's travel style (relaxed / balanced / fast-paced)

Additional guidelines:

• Prefer authentic, backpacker-friendly locations over expensive tourist traps
• Suggest specific neighborhoods where travelers usually stay
• Highlight opportunities to meet other travelers
• Recommend scenic walking routes whenever possible
• Add alternative options for flexibility

Output format:

Use clean Markdown formatting with headers, bullet lists, and emoji time blocks.

Start with 🌍 Trip Overview (2-3 sentences about the vibe)

Then organize each day as: 📍 Day N – [City/Area]

Use these emoji sections:
🌅 Morning - specific time and activities
☀️ Afternoon - specific time and activities
🌇 Evening - specific time and activities
🌙 Night - social/nightlife suggestions
💡 Local Tips - practical advice

Be specific, practical, enthusiastic, and engaging.

Important rules:

• Do not invent unrealistic travel times
• Keep places geographically close within the same day
• Do NOT use asterisks randomly in text - only for *italics* or **bold**
• Write day-by-day with specific times and detailed activities`;

const buildUserPrompt = (input: TripInput, firstName?: string): string => {
  // Parse dates more reliably by extracting components
  const [arrivalYear, arrivalMonth, arrivalDay] = input.arrival.date.split('-').map(Number);
  const [departureYear, departureMonth, departureDay] = input.departure.date.split('-').map(Number);
  
  const arrivalDate = new Date(arrivalYear, arrivalMonth - 1, arrivalDay);
  const departureDate = new Date(departureYear, departureMonth - 1, departureDay);
  
  const startDate = arrivalDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const endDate = departureDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate trip duration in complete days (without timezone issues)
  const timeDiff = departureDate.getTime() - arrivalDate.getTime();
  const tripDuration = Math.max(1, Math.round(timeDiff / (1000 * 60 * 60 * 24)));

  // IMPORTANT: Put name at the very start if available
  const greeting = firstName && firstName.trim() ? `Hey ${firstName}!` : 'Please';
  
  return `${greeting} Please create a detailed travel itinerary with extensive day-by-day activities for the following trip:

**CRITICAL TRIP DURATION: ${tripDuration} FULL DAYS**

**Trip Details:**
- Destination: ${input.arrival.location}
- Arrival: ${startDate}
- Departure: ${endDate}
- **Duration: Exactly ${tripDuration} days of activities needed**
- Travel Pace: ${input.travelPace || 'moderate'}
- Budget Level: ${input.budget || 'mid-range'}
- Interests: ${input.interests?.join(', ') || 'general tourism'}

**Places/Attractions to Visit:**
${input.desiredAttractions.map((attraction) => `- ${attraction}`).join('\n')}

**Additional Notes:**
${input.notes || 'No specific notes'}

**REQUIREMENTS:**
1. Create a comprehensive day-by-day itinerary for ALL ${tripDuration} days
2. Use the traveler's name (${firstName || 'provided above'}) throughout your response
3. Include all desired attractions in a logical geographical flow
4. Provide practical details like opening hours, travel times, and dining recommendations
5. Use time blocks for each day (morning, afternoon, evening, night)
`;
};

async function getUserFirstName(userId: string): Promise<string | undefined> {
  try {
    console.log('🔍 [Vercel] Fetching profile for userId:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, id, username')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ [Vercel] Error fetching profile:', error);
      return undefined;
    }
    
    console.log('✅ [Vercel] Profile data retrieved:', { id: data?.id, username: data?.username, first_name: data?.first_name });
    return data?.first_name || undefined;
  } catch (error) {
    console.error('❌ [Vercel] Exception fetching user profile:', error);
    return undefined;
  }
}

async function generateItinerary(input: TripInput): Promise<string> {
  let firstName: string | undefined;
  console.log('🔍 [Vercel] Itinerary request - userId:', input.userId);
  if (input.userId) {
    firstName = await getUserFirstName(input.userId);
    console.log('👤 [Vercel] Fetched firstName:', firstName);
  } else {
    console.log('⚠️ [Vercel] No userId provided in request');
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
