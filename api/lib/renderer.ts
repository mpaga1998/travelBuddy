/**
 * Itinerary rendering module
 * Converts validated ItineraryPlan into engaging markdown itinerary
 * This is the second stage of two-stage generation (plan → render)
 */

import { ItineraryPlan } from '../types/plan.js';
import { NormalizedTripInput } from './validation.js';
import { TripContext } from './tripContext.js';
import { buildRenderingSystemPrompt, buildRenderingUserPrompt } from './renderingPrompts.js';
import { getOpenAIService } from './openaiService.js';
import { debugLogRenderingMetadata, debugLogRenderingResponse } from './debug.js';

export interface RenderingResult {
  success: boolean;
  markdown?: string;
  error?: string;
}

/**
 * Render a validated plan into final markdown itinerary
 * @param plan Validated ItineraryPlan from planner
 * @param input Normalized trip input
 * @param context Pre-computed trip context
 * @param firstName Optional traveler first name
 * @returns RenderingResult with markdown or error
 */
export async function renderItinerary(
  plan: ItineraryPlan,
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string
): Promise<RenderingResult> {
  console.log('[Renderer] Starting itinerary rendering');
  console.log('[Renderer] Plan details:', {
    stops: plan.route.length,
    nights: plan.totalNights,
    feasible: plan.isFeasible,
    confidence: plan.confidence,
  });

  try {
    const systemPrompt = buildRenderingSystemPrompt();
    const userPrompt = buildRenderingUserPrompt(plan, input, context, firstName);

    // Debug: log rendering metadata
    debugLogRenderingMetadata(
      JSON.stringify(plan).length,
      JSON.stringify(input).length,
      3000
    );

    console.log('[Renderer] Calling OpenAI to render markdown...');

    const service = getOpenAIService();
    const response = await service.callRendering({
      systemPrompt,
      userPrompt,
    });
    const markdown = response.content;

    // Debug: log rendering response
    debugLogRenderingResponse(markdown, true);

    if (!markdown) {
      console.error('[Renderer] Empty response from OpenAI');
      debugLogRenderingResponse('', false);
      return {
        success: false,
        error: 'Rendering returned empty response',
      };
    }

    console.log('[Renderer] Markdown rendered successfully', {
      length: markdown.length,
      stops: plan.route.length,
    });

    return {
      success: true,
      markdown,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error';
    console.error('[Renderer] Rendering failed:', errorMsg);

    debugLogRenderingResponse('', false);

    return {
      success: false,
      error: `Rendering failed: ${errorMsg}`,
    };
  }
}

/**
 * Format rendering result for logging
 */
export function formatRenderingResult(result: RenderingResult): string {
  if (result.success && result.markdown) {
    return `[Renderer] Success: generated ${result.markdown.length} characters of markdown`;
  } else {
    return `[Renderer] Failed: ${result.error}`;
  }
}
