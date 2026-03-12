import OpenAI from 'openai';
import { TripInput } from './types';
import { buildSystemPrompt, buildUserPrompt } from './prompts';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get first name from request input
 * For backward compatibility - prefers userFirstName from request
 */
function getUserFirstNameFromRequest(input: TripInput): string | undefined {
  if (input.userFirstName) {
    console.log(
      '✅ [Vercel] Using firstName from request:',
      input.userFirstName
    );
    return input.userFirstName;
  }
  return undefined;
}

/**
 * Generate an itinerary using OpenAI GPT-3.5-turbo
 * Uses fixed model parameters: gpt-3.5-turbo, temp 0.7, max_tokens 3000
 */
export async function generateItinerary(input: TripInput): Promise<string> {
  let firstName = getUserFirstNameFromRequest(input);
  console.log(
    '🔍 [Vercel] Itinerary request - userId:',
    input.userId,
    'firstName:',
    firstName
  );

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
