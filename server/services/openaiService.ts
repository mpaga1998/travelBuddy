import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_ANON_KEY || ''
);

export interface TripInput {
  userId?: string;
  arrival: {
    date: string; // YYYY-MM-DD
    location: string;
  };
  departure: {
    date: string; // YYYY-MM-DD
    location: string;
  };
  desiredAttractions: string[];
  travelPace?: 'relaxed' | 'moderate' | 'active';
  interests?: string[];
  budget?: 'budget' | 'mid-range' | 'luxury';
  notes?: string;
}

const buildSystemPrompt = () => `You are an expert travel planner specializing in backpacking, social travel, and budget-friendly adventures.

Your goal is to create highly personalized travel itineraries based on the user’s preferences.

**CRITICAL: The user's name will be provided at the START of their message. You MUST use their name throughout the entire response:**
- Address them by name in the opening greeting
- Use their name when making personalized recommendations
- Include their name in key sections (Day N recommendations, tips addressed to them)
- Use their name in your closing remarks

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

export async function generateItinerary(input: TripInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  let firstName: string | undefined;
  if (input.userId) {
    firstName = await getUserFirstName(input.userId);
  }

  const completion = await openai.chat.completions.create({
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
    temperature: 0.7,
    max_tokens: 3000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response content from OpenAI');
  }

  return content;
}
