/**
 * Itinerary planning module with strict JSON parsing and error recovery
 * Generates structured ItineraryPlan before final markdown rendering
 */

import { NormalizedTripInput } from '../types/trip';
import { TripContext } from './tripContext';
import { ItineraryPlan } from '../types/plan';
import { buildPlanningSystemPrompt, buildPlanningUserPrompt } from './planningPrompts';
import { parsePlanResponse, formatParseErrors, ParseResult } from './planParser';
import { validatePlanBusinessRules, formatValidationIssues, PlanValidationResult } from './planValidator';
import { attemptPlanRepair, formatRepairResult, RepairResult } from './planRepair';
import { getOpenAIService } from './openaiService';
import { getTravelHeuristics, formatHeuristicsForPrompt, summarizeHeuristics } from './travelHeuristics';
import {
  debugLogPlanningPromptMetadata,
  debugLogPlannerResponse,
  debugLogParseResult,
  debugLogValidationIssues,
  debugLogRepairTriggered,
  debugLogRepairResult,
  debugLogPlan,
} from './debug';

export interface PlanningResult {
  success: boolean;
  plan?: ItineraryPlan;
  error?: string;
  warnings?: string[];
  validationResult?: PlanValidationResult; // business-rule validation
  repairAttempted?: boolean; // whether repair was triggered
  repairResult?: RepairResult; // repair diagnostic info
  retryable: boolean; // whether retrying might help
}

/**
 * Generate a structured itinerary plan with strict error handling
 * @param input Normalized and validated trip parameters
 * @param context Pre-computed trip context
 * @param firstName Optional user first name
 * @param maxRetries Max attempts to get valid JSON
 * @returns PlanningResult with plan or detailed error
 */
export async function planItinerary(
  input: NormalizedTripInput,
  context: TripContext,
  firstName?: string,
  maxRetries: number = 1
): Promise<PlanningResult> {
  console.log('[Planner] Starting planning with max retries:', maxRetries);

  // Compute travel heuristics for this destination
  const heuristics = getTravelHeuristics(input, context);
  const heuristicsText = formatHeuristicsForPrompt(heuristics);
  console.log('[Planner] Using travel heuristics:', summarizeHeuristics(heuristics));

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Planner] Attempt ${attempt}/${maxRetries}`);

    try {
      const systemPrompt = buildPlanningSystemPrompt();
      const userPrompt = buildPlanningUserPrompt(input, context, firstName, heuristicsText);

      // Debug: log prompt metadata
      debugLogPlanningPromptMetadata(systemPrompt, userPrompt, heuristics.region.length);

      const service = getOpenAIService();
      const response = await service.callPlanning({
        systemPrompt,
        userPrompt,
      });
      const content = response.content;

      // Debug: log raw response
      debugLogPlannerResponse(content, true);
      if (!content) {
        console.error('[Planner] Empty response from OpenAI');
        continue; // retry
      }

      // Parse and validate JSON
      const parseResult = parsePlanResponse(content, context);

      // Debug: log parse result
      debugLogParseResult(parseResult);

      if (parseResult.success && parseResult.plan) {
        console.log('[Planner] Plan generated successfully:', {
          feasible: parseResult.plan.isFeasible,
          stops: parseResult.plan.route.length,
          nights: parseResult.plan.totalNights,
          confidence: parseResult.plan.confidence,
        });

        // Debug: log parsed plan
        debugLogPlan(parseResult.plan, 'Parsed plan');

        // Run business-rule validation
        const validationResult = validatePlanBusinessRules(parseResult.plan, input, context);
        console.log(formatValidationIssues(validationResult));

        // Debug: log validation issues
        debugLogValidationIssues(validationResult.issues);

        // If invalid, attempt repair (once)
        if (!validationResult.valid) {
          console.log('[Planner] Plan failed business rules, attempting repair...');

          // Debug: log repair trigger
          debugLogRepairTriggered(
            validationResult.issues.filter((i) => i.severity === 'error').length,
            validationResult.issues.map((i) => i.rule)
          );

          const repairResult = await attemptPlanRepair(
            parseResult.plan,
            validationResult.issues,
            input,
            context,
            heuristicsText
          );
          console.log(formatRepairResult(repairResult));

          if (repairResult.success && repairResult.repairedPlan) {
            // Validate repaired plan
            const repairedValidation = validatePlanBusinessRules(
              repairResult.repairedPlan,
              input,
              context
            );
            console.log('[Planner] Repaired plan validation:', repairedValidation.summary);

            // Debug: log repair result
            debugLogRepairResult(true, validationResult.issues.length, repairedValidation.issues.length);
            // Debug: log repaired plan
            debugLogPlan(repairResult.repairedPlan, 'Repaired plan');

            return {
              success: true,
              plan: repairResult.repairedPlan,
              validationResult: repairedValidation,
              repairAttempted: true,
              repairResult,
              warnings: [...(parseResult.errors.map((e) => `${e.field}: ${e.message}`) || []), 'Plan required repair'],
              retryable: false,
            };
          } else {
            // Repair failed, return original errors
            console.warn('[Planner] Repair failed, returning original plan failure');

            // Debug: log repair failure
            debugLogRepairResult(false, validationResult.issues.length);

            return {
              success: false,
              repairAttempted: true,
              repairResult,
              error: `Plan validation failed and repair unsuccessful: ${repairResult.repairMessage}`,
              retryable: false,
            };
          }
        }

        // Valid plan, no repair needed
        return {
          success: true,
          plan: parseResult.plan,
          validationResult,
          repairAttempted: false,
          warnings: parseResult.errors.map((e) => `${e.field}: ${e.message}`),
          retryable: false,
        };
      }

      // Parsing failed
      const errorSummary = formatParseErrors(parseResult.errors);
      console.warn(`[Planner] Parse failed on attempt ${attempt}:\n${errorSummary}`);

      // Decide if retryable
      const isRetryable = parseResult.errors.some((e) => e.type === 'extraction');

      if (attempt < maxRetries && isRetryable) {
        console.log('[Planner] Retrying (extraction error is retryable)...');
        continue;
      }

      // No more retries or not retryable
      return {
        success: false,
        error: `Planning returned invalid JSON:\n${errorSummary}`,
        retryable: isRetryable,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'unknown error';
      console.error(`[Planner] Request error on attempt ${attempt}:`, errorMsg);

      // API errors might be retryable
      if (attempt < maxRetries) {
        console.log('[Planner] Retrying after error...');
        // Small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      return {
        success: false,
        error: `Planning request failed: ${errorMsg}`,
        retryable: true,
      };
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: `Planning failed after ${maxRetries} attempt(s)`,
    retryable: true,
  };
}

/**
 * Extract the day-by-day summary from a plan
 * Useful for logging or alternative rendering
 */
export function summarizePlan(plan: ItineraryPlan): string {
  const lines: string[] = [];

  lines.push(`Route: ${plan.summary}`);
  lines.push(`Feasible: ${plan.isFeasible}`);
  lines.push(`Confidence: ${plan.confidence}/10`);

  if (plan.route.length > 0) {
    lines.push('\nStops:');
    for (const stop of plan.route) {
      lines.push(
        `  ${stop.location} (Days ${stop.startDay}-${stop.endDay}, ${stop.nights} nights): ${stop.reason}`
      );
    }
  }

  if (plan.warnings.length > 0) {
    lines.push('\nWarnings:');
    plan.warnings.forEach((w) => lines.push(`  ⚠️ ${w}`));
  }

  if (plan.issues.length > 0) {
    lines.push('\nIssues:');
    plan.issues.forEach((i) => lines.push(`  ❌ ${i}`));
  }

  if (plan.suggestedAlternatives.length > 0) {
    lines.push('\nSuggested Alternatives:');
    plan.suggestedAlternatives.forEach((alt) => lines.push(`  → ${alt}`));
  }

  return lines.join('\n');
}
