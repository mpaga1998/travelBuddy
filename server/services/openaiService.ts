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
  stops?: string[];
  desiredAttractions: string[];
  travelPace?: 'relaxed' | 'moderate' | 'active';
  interests?: string[];
  budget?: 'budget' | 'mid-range' | 'luxury';
  notes?: string;
}

export interface GenerationResult {
  markdown: string;
  suggestions: string[];
}

// Import structured itinerary modules
import {
  validateTripInput,
  calculateNights,
} from '../lib/inputValidation';
import { buildStructuredPlanningPrompt } from '../lib/structuredPrompts';
import {
  extractJSON,
  ExtractionError,
  ValidationError,
  validateStructuredItinerary,
} from '../lib/jsonExtraction';
import { renderToMarkdown } from '../lib/itineraryRendering';
import {
  generateSuggestions,
  buildRefinementPrompt,
  GenerationContext,
} from '../lib/itineraryRefinement';

// Keep legacy functions for fallback
const buildSystemPrompt = () => `You are an expert backpacker trip planner. Your mission: create realistic, actually-doable itineraries that respect travel time, fatigue, and logistics.

**NON-NEGOTIABLE RULES:**

1. **Use the traveler's name** - Address them by name throughout. Make recommendations feel personal.

2. **Honesty about constraints** - You MUST work backwards from the departure date and location:
   - If ${' '}they depart from Bishkek on April 15, they need to be back in Bishkek by evening April 14
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
- Total: ${nights} nights on the ground
- Pace: ${input.travelPace === 'relaxed' ? 'Relaxed pace - time to breathe' : input.travelPace === 'active' ? 'Active pace - pack it in' : 'Balanced'}
- Budget: ${input.budget}

**WANT TO SEE:**
${input.desiredAttractions.map((attr) => `- ${attr}`).join('\n')}

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
- Total: ${nights} nights on the ground
- Pace: ${input.travelPace === 'relaxed' ? 'Relaxed pace - time to breathe' : input.travelPace === 'active' ? 'Active pace - pack it in' : 'Balanced'}
- Budget: ${input.budget}

**WANT TO SEE:**
${input.desiredAttractions.map((attraction) => `- ${attraction}`).join('\n')}

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

/**
 * Legacy text-based itinerary generation (fallback)
 */
async function generateItineraryFallback(input: TripInput): Promise<string> {
  console.warn('⚠️ Using fallback text-based generation');

  let firstName = getUserFirstNameFromRequest(input);

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

/**
 * New structured itinerary generation with validation pipeline
 * Validates input → Requests structured JSON → Extracts & validates → Renders → Falls back if needed
 */
export async function generateItinerary(
  input: TripInput,
  options: { maxRetries?: number } = {}
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const maxRetries = options.maxRetries ?? 1;
  const nights = calculateNights(input);

  console.log('📋 [Structured] Generating itinerary for:', input.arrival.location);

  // STEP 1: Validate input
  const validationErrors = validateTripInput(input);
  if (validationErrors.length > 0) {
    console.error('❌ Input validation failed:', validationErrors);
    throw new Error(
      `Input validation failed: ${validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ')}`
    );
  }

  const firstName = getUserFirstNameFromRequest(input);
  console.log('✅ Input validated. Planning for:', firstName || input.userFirstName || 'traveler');

  let lastValidationContext: GenerationContext = {
    nightsAvailable: nights,
    validationErrors: [],
    validationWarnings: [],
    attemptNumber: 0,
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // STEP 2: Request structured JSON output
      let prompt = buildStructuredPlanningPrompt(input, firstName);

      if (attempt > 0) {
        console.log(`🔄 Retry attempt ${attempt} with refinements...`);
        prompt = buildRefinementPrompt(prompt, {
          ...lastValidationContext,
          attemptNumber: attempt,
        });
      }

      console.log('🤖 Calling OpenAI with structured prompt...');
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert trip planner. Return ONLY valid JSON wrapped in triple backticks. No other text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      });

      const responseText = response.choices[0]?.message?.content;
      if (!responseText) {
        throw new ExtractionError('No response from OpenAI', '');
      }

      console.log('📦 Received response, extracting JSON...');

      // STEP 3: Extract JSON from response
      let structuredItinerary;
      try {
        structuredItinerary = extractJSON(responseText);
      } catch (error) {
        if (error instanceof ExtractionError) {
          console.error('❌ JSON extraction failed:', error.message);
          throw error;
        }
        throw error;
      }

      console.log('✅ JSON extracted. Validating structure...');

      // STEP 4: Validate structure against constraints
      const validationResult = validateStructuredItinerary(
        structuredItinerary,
        input
      );

      lastValidationContext = {
        nightsAvailable: nights,
        nightsAllocated: structuredItinerary.constraints.nightsAllocated,
        validationErrors: validationResult.errors,
        validationWarnings: validationResult.warnings,
        attemptNumber: attempt,
      };

      if (!validationResult.valid) {
        console.error('❌ Structure validation failed:', validationResult.errors);

        // If we have retries left, don't throw yet
        if (attempt < maxRetries) {
          console.log(
            `⚠️ Validation failed but retrying (attempt ${attempt + 1}/${maxRetries})...`
          );
          continue;
        }

        // No retries left, throw error
        const error = new ValidationError(
          'Itinerary structure validation failed after retries',
          validationResult.errors,
          validationResult.warnings,
          structuredItinerary
        );
        (error as any).context = lastValidationContext;
        throw error;
      }

      if (validationResult.warnings.length > 0) {
        console.warn('⚠️ Validation warnings:', validationResult.warnings);
      }

      console.log('✅ Structure validated. Rendering to markdown...');

      // STEP 5: Render to markdown
      const markdown = renderToMarkdown(structuredItinerary, firstName);
      console.log('✅ Itinerary generated successfully (structured)');

      return markdown;
    } catch (error) {
      // Only proceed to fallback on final attempt
      if (attempt === maxRetries) {
        console.error(
          '⚠️ Structured generation failed after retries, falling back:',
          error instanceof Error ? error.message : error
        );

        if (error instanceof ValidationError) {
          try {
            console.log('📝 Attempting fallback text generation...');
            return await generateItineraryFallback(input);
          } catch (fallbackError) {
            console.error(
              '❌ Fallback generation also failed:',
              fallbackError
            );
            throw new Error(
              `Failed to generate itinerary: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
        throw error;
      }
    }
  }

  throw new Error('Itinerary generation failed');
}
