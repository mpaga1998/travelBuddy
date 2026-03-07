import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface TripInput {
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

const buildSystemPrompt = () => `You are an expert travel agent and itinerary planner. Your job is to create detailed, personalized travel itineraries based on user preferences.

When creating an itinerary:
1. Plan day-by-day with specific times and activities
2. Consider travel times between locations
3. Include practical information (opening hours, booking recommendations)
4. Suggest restaurants, cafes, and local experiences
5. Balance between must-sees and hidden gems
6. Account for the user's travel pace and interests
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
    (new Date(input.departure.date).getTime() - new Date(input.arrival.date).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  return `Please create a detailed travel itinerary for the following trip:

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

export async function generateItinerary(input: TripInput): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
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
        content: buildUserPrompt(input),
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
