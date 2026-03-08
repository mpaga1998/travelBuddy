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
  stops?: string[];
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

const buildSystemPrompt = () => `You are an expert backpacker trip planner. Your mission: create realistic, actually-doable itineraries that respect travel time, fatigue, and logistics.

**NON-NEGOTIABLE RULES:**

1. **Use the traveler's name** - Address them by name throughout. Make recommendations feel personal.

2. **Honesty about constraints** - You MUST work backwards from the departure date and location:
   - If they depart from Bishkek on April 15, they need to be back in Bishkek by evening April 14
   - If they depart from Osh, include travel time FROM Osh (not to Osh)
   - Don't suggest a 5-hour journey the day they leave

3. **Realistic night allocation** - NEVER repeat the same night count for every location. Example of WRONG: "Bishkek | 8 nights", "Issyk Kul | 8 nights", "Osh | 8 nights"
   - Instead split it: "Bishkek 3 nights, Issyk Kul 3 nights, Osh 1 night, travel buffer 1 night = 8 nights total"

4. **Calculate real travel times** - Not Google Maps optimistic times. Add buffer.
   - Bishkek to Issyk Kul: ~3-4 hours minimum
   - Issyk Kul to Osh: ~6-8 hours minimum
   - Osh to Bishkek: ~4-5 hours minimum

5. **Be honest about feasibility** - If the trip is too ambitious, say so. Better to eliminate locations than pretend it's doable.

6. **Format for clarity** - Use minimal emojis (only in headers), clear markdown, realistic time estimates. Make it scannable.

7. **Include these for each location:**
   - Exact days (e.g., "Days 1-3")
   - Number of nights ONLY in that location
   - Morning/afternoon/evening breakdown with TIME ESTIMATES
   - How long to stay to actually enjoy it
   - Transport details to next location (time, mode, cost estimate)

**OUTPUT EXAMPLE:**

## Bishkek | Days 1-3 | 3 nights
Day 1 (arrival): Land, settle, explore Ala-Too Square and old town walk
Day 2: Burana Tower day trip (1.5h each way)
Day 3: Explore cafes, meet people, prepare for next leg

Transport to Issyk Kul: Van or shared taxi, 3-4 hours, ~800 som

## Issyk Kul Lake | Days 4-6 | 3 nights
Day 4: Arrive, explore shoreline towns
Day 5: Swimming, hiking, social time
Day 6: Relax or explore further east side

Transport to Osh: Long day - minibus 6-8 hours. **Early start required.**

## Osh | Days 7-8 | 1 night
Day 7: Bazaar, old town, Sulaiman Too
Day 8: Morning exploration, **prepare for 4-5 hour return to Bishkek**

**Schedule Day 8 return by 1 PM MAX to reach Bishkek by evening**

---

Never say the trip is feasible if it isn't. Suggest cuts or alternatives instead.`;

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
    return `${firstName ? `Hey ${firstName}!` : 'Hello!'} Building your ${fullDays}-day trip...

**TRIP CONSTRAINTS:**
- Arrive: ${startDate} in ${input.arrival.location}
- Depart: ${endDate} from ${input.departure.location}
${input.stops && input.stops.length > 0 ? `- Stops: ${input.stops.join(', ')}` : ''}
- Total: ${nights} nights on the ground
- Pace: ${input.travelPace === 'relaxed' ? 'Relaxed pace - time to breathe' : input.travelPace === 'active' ? 'Active pace - pack it in' : 'Balanced'}
- Budget: ${input.budget}

**WANT TO SEE:**
${input.desiredAttractions.length > 0 ? input.desiredAttractions.map((attr) => `- ${attr}`).join('\n') : '(No specific attractions mentioned)'}

${input.notes ? `**NOTES:** ${input.notes}` : ''}

**YOUR MISSION:**
1. Figure out which cities/regions can realistically fit in ${nights} nights. Be honest if it's too ambitious.
2. Allocate nights across locations (e.g., 3-3-1 split across 3 cities, not 7-7-7).
3. Include transport times between every stop. Don't hide the travel.
4. Remember: You must END in ${input.departure.location} on ${endDate}. Plan return logistics.
5. For each location, show real daily breakdown with time estimates.
6. If it's a tight squeeze, say so and suggest alternatives.

Use ${firstName ? firstName + "'s" : 'the user\'s'} name throughout. Be realistic. Quality over coverage.`;
  } else {
    return `${firstName ? `Hey ${firstName}!` : 'Hey there!'} Let's plan your ${fullDays}-day trip...

**TRIP CONSTRAINTS:**
- Arrive: ${startDate} in ${input.arrival.location}
- Depart: ${endDate} from ${input.departure.location}
${input.stops && input.stops.length > 0 ? `- Stops: ${input.stops.join(', ')}` : ''}
- Total: ${nights} nights on the ground
- Pace: ${input.travelPace === 'relaxed' ? 'Relaxed pace - time to breathe' : input.travelPace === 'active' ? 'Active pace - pack it in' : 'Balanced'}
- Budget: ${input.budget}

**WANT TO SEE:**
${input.desiredAttractions.length > 0 ? input.desiredAttractions.map((attraction) => `- ${attraction}`).join('\n') : '(No specific attractions mentioned)'}

${input.notes ? `**NOTES:** ${input.notes}` : ''}

**YOUR MISSION:**
1. Create a realistic DAY-BY-DAY breakdown.
2. For each day show: morning, afternoon, evening, night (with TIME estimates).
3. Include transport time to next location if applicable.
4. Remember: You must END in ${input.departure.location} on ${endDate}. Plan the last day accordingly.
5. If ${fullDays} days is tight, say so. Suggest what to cut or what needs more time.
6. Focus on experiences that actually fit and are socially engaging.

Use ${firstName ? firstName + "'s" : 'the user\'s'} name throughout. Be honest. Make it doable.`;
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
