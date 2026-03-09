/**
 * Plan repair module
 * Attempts to fix invalid planner outputs based on validation feedback
 */

import { ItineraryPlan } from '../types/plan';
import { NormalizedTripInput } from './validation';
import { TripContext } from './tripContext';
import { PlanValidationIssue } from './planValidator';
import { buildRepairSystemPrompt, buildRepairUserPrompt } from './planningPrompts';
import { parsePlanResponse } from './planParser';
import { getOpenAIService } from './openaiService';

export interface RepairResult {
  success: boolean;
  repairedPlan?: ItineraryPlan;
  originalPlan: ItineraryPlan;
  originalErrors: PlanValidationIssue[];
  repairedErrors?: PlanValidationIssue[]; // if repair also failed
  repairAttempted: boolean;
  repairMessage: string; // why repair was needed or why it failed
}

/**
 * Attempt to repair an invalid plan by calling the model with specific feedback
 * @param invalidPlan The plan that failed validation
 * @param validationIssues The validation errors found
 * @param input Normalized trip input
 * @param context Trip context
 * @param travelHeuristics Optional formatted travel heuristics
 * @returns RepairResult with success/failure and diagnostic info
 */
export async function attemptPlanRepair(
  invalidPlan: ItineraryPlan,
  validationIssues: PlanValidationIssue[],
  input: NormalizedTripInput,
  context: TripContext,
  travelHeuristics?: string
): Promise<RepairResult> {
  const errors = validationIssues.filter((i) => i.severity === 'error');

  console.log('[Repair] Starting repair attempt for plan with', errors.length, 'critical error(s)');
  errors.forEach((e) => {
    console.log(`[Repair]   - ${e.rule}: ${e.message}`);
  });

  try {
    const systemPrompt = buildRepairSystemPrompt();
    const userPrompt = buildRepairUserPrompt(invalidPlan, validationIssues, context, input, travelHeuristics);

    console.log('[Repair] Calling OpenAI to repair plan...');

    const service = getOpenAIService();
    const response = await service.callRepair({
      systemPrompt,
      userPrompt,
    });
    const content = response.content;
    if (!content) {
      console.error('[Repair] Empty response from OpenAI');
      return {
        success: false,
        originalPlan: invalidPlan,
        originalErrors: errors,
        repairAttempted: true,
        repairMessage: 'Repair model returned empty response',
      };
    }

    // Parse the repaired JSON
    console.log('[Repair] Parsing repaired JSON...');
    const parseResult = parsePlanResponse(content, context);

    if (!parseResult.success || !parseResult.plan) {
      const errorSummary = parseResult.errors
        .map((e) => `${e.type}${e.field ? ` (${e.field})` : ''}: ${e.message}`)
        .join('; ');

      console.error('[Repair] Failed to parse repaired JSON:', errorSummary);

      return {
        success: false,
        originalPlan: invalidPlan,
        originalErrors: errors,
        repairAttempted: true,
        repairMessage: `Repair returned invalid JSON: ${errorSummary}`,
      };
    }

    console.log('[Repair] Repaired plan parsed successfully');
    console.log('[Repair] Repaired plan:', {
      feasible: parseResult.plan.isFeasible,
      stops: parseResult.plan.route.length,
      nights: parseResult.plan.totalNights,
      confidence: parseResult.plan.confidence,
    });

    return {
      success: true,
      repairedPlan: parseResult.plan,
      originalPlan: invalidPlan,
      originalErrors: errors,
      repairAttempted: true,
      repairMessage: `Plan repaired successfully (was: ${errors.length} critical errors)`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'unknown error';
    console.error('[Repair] Repair request failed:', errorMsg);

    return {
      success: false,
      originalPlan: invalidPlan,
      originalErrors: errors,
      repairAttempted: true,
      repairMessage: `Repair failed: ${errorMsg}`,
    };
  }
}

/**
 * Format repair result for logging
 */
export function formatRepairResult(result: RepairResult): string {
  if (result.success && result.repairedPlan) {
    return (
      `[Repair Result] SUCCESS\n` +
      `  Original errors: ${result.originalErrors.length}\n` +
      `  Repaired plan: ${result.repairedPlan.route.length} stops, ` +
      `${result.repairedPlan.totalNights} nights, ` +
      `feasible=${result.repairedPlan.isFeasible}`
    );
  } else {
    return (
      `[Repair Result] FAILED\n` +
      `  Reason: ${result.repairMessage}\n` +
      `  Original errors: ${result.originalErrors.length}`
    );
  }
}
