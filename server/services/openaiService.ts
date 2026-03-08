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
  userFirstName?: string;
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
🏘️ City Name  |  Days 1-2  |  2 nights
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
    console.log('🔍 Fetching profile for userId:', userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, id, username')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ Error fetching profile:', error);
      return undefined;
    }
    
    console.log('✅ Profile data retrieved:', { id: data?.id, username: data?.username, first_name: data?.first_name });
    return data?.first_name || undefined;
  } catch (error) {
    console.error('❌ Exception fetching user profile:', error);
    return undefined;
  }
}

// For backward compatibility, but now we prefer using userFirstName from the request
function getUserFirstNameFromRequest(input: TripInput): string | undefined {
  if (input.userFirstName) {
    console.log('✅ Using firstName from request:', input.userFirstName);
    return input.userFirstName;
  }
  return undefined;
}

export async function generateItinerary(input: TripInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  // Use userFirstName from request directly
  let firstName = getUserFirstNameFromRequest(input);
  console.log('🔍 Itinerary request - userId:', input.userId, 'firstName:', firstName);

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
