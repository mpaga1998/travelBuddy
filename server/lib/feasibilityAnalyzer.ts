/**
 * Feasibility Analysis - Evaluates each location/stop for logistic complexity
 */

import { TripInput } from '../services/openaiService';
import { calculateNights } from './inputValidation';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LocationFeasibility {
  name: string;
  rating: 'easy' | 'medium' | 'hard';
  timeNeeded: string; // "1 day", "2-3 days", etc.
  reason: string;
  requirements?: string[]; // Permits, visas, tours, etc.
  warnings?: string[];
  tips?: string[];
}

export interface TripFeasibilityAnalysis {
  nightsAvailable: number;
  calendarDays: number;
  arrivalDate: string;
  departureDate: string;
  locations: LocationFeasibility[];
  overallAssessment: 'easy' | 'moderate' | 'ambitious' | 'very-ambitious';
  overallReason: string;
  majorChallenges: string[];
  suggestions: string[];
}

/**
 * Analyze feasibility of all locations in the trip
 */
export async function analyzeTripFeasibility(
  input: TripInput
): Promise<TripFeasibilityAnalysis> {
  const nightsAvailable = calculateNights(input);
  const arrival = new Date(input.arrival.date);
  const departure = new Date(input.departure.date);
  const calendarDays = nightsAvailable + 1;

  // Collect all locations to analyze
  const allLocations = [
    input.arrival.location,
    ...(input.stops || []),
    ...(input.desiredAttractions || []),
    input.departure.location,
  ];

  // Remove duplicates
  const uniqueLocations = Array.from(new Set(allLocations.map(l => l.toLowerCase())))
    .map(lower => allLocations.find(l => l.toLowerCase() === lower)!);

  console.log('📊 Analyzing feasibility for:', uniqueLocations);

  // Build analysis prompt
  const prompt = buildFeasibilityPrompt(input, uniqueLocations, nightsAvailable);

  // Call GPT for analysis
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_PLANNING_MODEL || 'gpt-4-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are an expert travel logistics consultant. Analyze trip feasibility and return JSON.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.6,
    max_tokens: 2000,
  });

  const responseText = response.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No response from feasibility analysis');
  }

  // Parse JSON from response
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : responseText.trim();
  const analysis = JSON.parse(jsonStr);

  console.log('✅ Feasibility analysis complete');

  return {
    nightsAvailable,
    calendarDays,
    arrivalDate: input.arrival.date,
    departureDate: input.departure.date,
    locations: analysis.locations || [],
    overallAssessment: analysis.overallAssessment || 'moderate',
    overallReason: analysis.overallReason || '',
    majorChallenges: analysis.majorChallenges || [],
    suggestions: analysis.suggestions || [],
  };
}

/**
 * Build the feasibility analysis prompt
 */
function buildFeasibilityPrompt(
  input: TripInput,
  locations: string[],
  nightsAvailable: number
): string {
  return `You are analyzing a trip's feasibility.

**TRIP DETAILS:**
- Arrival: ${input.arrival.location} on ${input.arrival.date} at ${input.arrival.time || 'unspecified'}
- Departure: ${input.departure.location} on ${input.departure.date} at ${input.departure.time || 'unspecified'}
- Total available: ${nightsAvailable} nights (${nightsAvailable + 1} calendar days)
- Travel pace: ${input.travelPace || 'moderate'}
- Budget: ${input.budget || 'flexible'}

**LOCATIONS TO ANALYZE:**
${locations.map((loc, i) => `${i + 1}. ${loc}`).join('\n')}

**YOUR TASK:**
For each location, evaluate:
1. How long is realistic to spend? (in days)
2. Logistic difficulty: Easy/Medium/Hard
3. Why? (accessibility, infrastructure, distance, permits, etc.)
4. Any special requirements? (permits, visas, tours, registrations)
5. Warnings or tips?

Also provide:
- Overall trip assessment (easy/moderate/ambitious/very-ambitious)
- Major logistic challenges across the whole trip
- Suggestions to make it work

**RESPONSE FORMAT:**
\`\`\`json
{
  "locations": [
    {
      "name": "Location Name",
      "rating": "easy|medium|hard",
      "timeNeeded": "1 day" or "2-3 days",
      "reason": "Why this rating?",
      "requirements": ["permit", "tour", "registration"],
      "warnings": ["Weather", "Road conditions"],
      "tips": ["Best time to visit", "Avoid..."]
    }
  ],
  "overallAssessment": "easy|moderate|ambitious|very-ambitious",
  "overallReason": "Why this overall rating?",
  "majorChallenges": ["Challenge 1", "Challenge 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}
\`\`\`

Return ONLY the JSON. Be realistic and honest about logistics.`;
}
