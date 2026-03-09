import OpenAI from 'openai';
import { TripContext } from './tripContext';
import { ItineraryPlan, PlanningResult } from './types/plan';
import { buildPlanningPrompt } from './planningPrompt';

/**
 * Attempt to parse a string as an ItineraryPlan JSON object.
 * Returns the parsed plan or null if parsing fails.
 */
function parsePlanJSON(jsonString: string): ItineraryPlan | null {
  try {
    // Extract JSON if the response contains other text
    // Look for the first { and last } in case model adds explanation
    const jsonStart = jsonString.indexOf('{');
    const jsonEnd = jsonString.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonStart > jsonEnd) {
      console.error('❌ [Planning] Could not find JSON boundaries in response');
      return null;
    }

    const jsonContent = jsonString.substring(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonContent);

    // Basic shape validation
    if (
      typeof parsed !== 'object' ||
      typeof parsed.isFeasible !== 'boolean' ||
      typeof parsed.summary !== 'string' ||
      typeof parsed.totalNights !== 'number' ||
      !Array.isArray(parsed.route) ||
      !Array.isArray(parsed.transportSegments)
    ) {
      console.error('❌ [Planning] Parsed JSON does not match ItineraryPlan schema');
      return null;
    }

    return parsed as ItineraryPlan;
  } catch (error) {
    console.error('❌ [Planning] JSON parse error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Call the planner model to generate a structured itinerary plan.
 * Returns either a valid plan or a feasibility=false plan with error details.
 */
export async function planItinerary(context: TripContext, openai: OpenAI): Promise<PlanningResult> {
  try {
    console.log(`🎯 [Planning] Starting plan generation for ${context.tripLengthCategory} trip (${context.totalNights} nights)`);

    const planningPrompt = buildPlanningPrompt(context);

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: planningPrompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error('❌ [Planning] No content received from OpenAI');
      return {
        success: false,
        error: 'No response from planning model',
      };
    }

    console.log('✅ [Planning] Received response, attempting JSON parse...');

    // Try to parse the JSON response
    const plan = parsePlanJSON(content);

    if (!plan) {
      console.error('❌ [Planning] Failed to parse plan JSON');
      return {
        success: false,
        error: 'Could not parse plan from model response',
      };
    }

    // Basic validation: check total nights
    const actualTotalNights = plan.route.reduce((sum, stop) => sum + stop.nights, 0);
    if (actualTotalNights !== context.totalNights) {
      console.warn(
        `⚠️  [Planning] Night sum mismatch: expected ${context.totalNights}, got ${actualTotalNights}`
      );
    }

    console.log(`✅ [Planning] Plan generated successfully. Feasible: ${plan.isFeasible}`);
    if (plan.warnings.length > 0) {
      console.log(`⚠️  [Planning] Warnings: ${plan.warnings.join('; ')}`);
    }

    return {
      success: true,
      plan,
    };
  } catch (error) {
    console.error('❌ [Planning] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during planning',
    };
  }
}
