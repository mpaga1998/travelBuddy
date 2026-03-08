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
  userFirstName?: string;
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
- If the trip duration exceed 5 days, group days based on activities, and suggests multiple-day trips for example to nearby cities or points of interest further but still reachable easily for a 2/3 day trip.

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

// Helper to format dates as "Month Day(th), Year"
function formatDate(date: Date): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `${monthNames[date.getMonth()]} ${day}${suffix}, ${date.getFullYear()}`;
}

const buildUserPrompt = (input: TripInput, firstName?: string): string => {
  // Parse dates more reliably by extracting components
  const [arrivalYear, arrivalMonth, arrivalDay] = input.arrival.date.split('-').map(Number);
  const [departureYear, departureMonth, departureDay] = input.departure.date.split('-').map(Number);
  
  const arrivalDate = new Date(arrivalYear, arrivalMonth - 1, arrivalDay);
  const departureDate = new Date(departureYear, departureMonth - 1, departureDay);
  
  // Format dates as simple, clear strings
  const startDate = formatDate(arrivalDate);
  const endDate = formatDate(departureDate);
  
  // Calculate days and nights correctly
  // If arriving April 7 and departing April 9: 2 nights (7-8 and 8-9)
  const nights = Math.max(1, Math.round((departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)));
  const fullDays = nights; // Same number of full travel days

  // For short trips (<=5 days), use detailed day-by-day format
  // For longer trips (>5 days), use regional grouping format
  const isLongTrip = fullDays > 5;
  
  if (isLongTrip) {
    return `${firstName ? `Hey ${firstName}!` : 'Hello!'} Let's plan your ${fullDays}-day adventure in ${input.arrival.location}!

🗓️ **YOUR TRIP**
${startDate} → ${endDate} (${nights} nights, ${fullDays} days on the ground)

🏘️ **WHAT YOU WANT TO SEE**
${input.desiredAttractions.map((attr) => `• ${attr}`).join('\n')}

✈️ **TRAVEL STYLE**
${input.travelPace === 'relaxed' ? 'Relaxed pace - time to breathe' : input.travelPace === 'active' ? 'Active pace - pack it in' : 'Balanced - see stuff, also rest'} | Budget: ${input.budget} | Interests: ${input.interests?.join(', ') || 'mixed'}

${input.notes ? `📝 **NOTES FROM YOU**\n${input.notes}\n` : ''}
**YOUR MISSION:**
Build a realistic itinerary that respects travel times, fatigue, and logistics. For a ${fullDays}-day trip:

✅ **BE HONEST ABOUT:**
• Real travel times between cities (not Google Maps optimistic times)
• How much you can see in one day without exhaustion
• If the attractions fit geographically or if transfers eat the day
• Whether ${fullDays} days is enough, tight, or super rushed
• Suggest alternatives if something doesn't work timeline-wise

✅ **STRUCTURE BY REGION/CITY** (not hour-by-hour)
Example format:
🏘️ City Name  |  Days 1-2  |  ${nights} nights
- What to see
- Realistic timing (e.g., "3-4 hours walking" or "full day for this")
- Local tips
- Transport to next location (time required)

✅ **CRITICAL: MENTION IF IT'S TIGHT**
If the itinerary is rushed or logistically challenging, say so clearly. Suggest what to skip or what needs more time.

✅ **USE ${firstName ? firstName + "'S" : "THE TRAVELER'S"} NAME** throughout - make it personal.

Be realistic, be friendly, and prioritize **actually enjoying the trip** over checking boxes.`;
  } else {
    return `${firstName ? `Hey ${firstName}!` : 'Hey there!'} Let's plan an awesome ${fullDays}-day trip to ${input.arrival.location}!

🗓️ **YOUR TRIP**
${startDate} → ${endDate} (${nights} nights, ${fullDays} days)

🎯 **WHAT YOU WANT TO SEE**
${input.desiredAttractions.map((attraction) => `• ${attraction}`).join('\n')}

🎒 **YOUR STYLE**
${input.travelPace === 'relaxed' ? 'Relaxed vibes' : input.travelPace === 'active' ? 'Go go go!' : 'Balanced pace'} | ${input.interests?.join(', ') || 'all interests'} | Budget: ${input.budget}

${input.notes ? `📝 **SPECIAL NOTES**\n${input.notes}\n` : ''}
**BUILD ME AN ITINERARY:**
Create a DAY-BY-DAY plan for all ${fullDays} days:

✅ **FOR EACH DAY, INCLUDE:**
🌅 Morning - specific place & time
☀️ Afternoon - what to do, realistic times
🌇 Evening - restaurants/experiences
🌙 Night - social/nightlife suggestions
💡 Logistics - transport times, bookings, hours

✅ **REALISTIC PLANNING:**
• Include actual travel times between places
• Don't pack 8 hours of activities if travel takes time
• Account for fatigue and rest
• Mention if anything is a tight fit
• Suggest alternatives if needed

✅ **MAKE IT PERSONAL:** Use ${firstName ? firstName + "'s" : 'the'} name and make recommendations feel tailored.

Prioritize experiences that actually fit in ${fullDays} days - quality over quantity!`;
  }
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

// For backward compatibility, but now we prefer using userFirstName from the request
function getUserFirstNameFromRequest(input: TripInput): string | undefined {
  if (input.userFirstName) {
    console.log('✅ [Vercel] Using firstName from request:', input.userFirstName);
    return input.userFirstName;
  }
  return undefined;
}

async function generateItinerary(input: TripInput): Promise<string> {
  let firstName = getUserFirstNameFromRequest(input);
  console.log('🔍 [Vercel] Itinerary request - userId:', input.userId, 'firstName:', firstName);

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
