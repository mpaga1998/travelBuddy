/**
 * Debug/Observability Module
 * Provides structured, safe logging for troubleshooting the itinerary generation pipeline
 * Controlled by DEBUG environment variable; disabled in production by default
 */

import { NormalizedTripInput } from './validation';
import { TripContext } from './tripContext';
import { ItineraryPlan } from '../types/plan';
import { PlanValidationIssue } from './planValidator';

/**
 * Debug configuration
 */
export interface DebugConfig {
  enabled: boolean;
  verbose: boolean; // if true, logs full prompts; if false, logs only summaries
}

/**
 * Build debug config from environment
 */
export function buildDebugConfig(env: Record<string, string | undefined>): DebugConfig {
  const enabled = env.DEBUG === 'true' || env.DEBUG === '1' || env.DEBUG === 'yes';
  const verbose = env.DEBUG_VERBOSE === 'true' || env.DEBUG_VERBOSE === '1';

  return {
    enabled,
    verbose,
  };
}

// Global debug config (initialized at startup)
let globalDebugConfig: DebugConfig = { enabled: false, verbose: false };

/**
 * Initialize debug config
 */
export function initializeDebugConfig(env: Record<string, string | undefined>): void {
  globalDebugConfig = buildDebugConfig(env);
  if (globalDebugConfig.enabled) {
    console.log('[Debug] Debug logging enabled (verbose:', globalDebugConfig.verbose + ')');
  }
}

/**
 * Get debug config
 */
function getDebugConfig(): DebugConfig {
  return globalDebugConfig;
}

/**
 * Check if debugging is enabled
 */
export function isDebugEnabled(): boolean {
  return globalDebugConfig.enabled;
}

/**
 * Redact sensitive information from input
 */
function redactSensitiveInput(input: NormalizedTripInput): Partial<NormalizedTripInput> {
  return {
    userFirstName: input.userFirstName ? '[REDACTED]' : undefined,
    arrivalLocation: input.arrivalLocation,
    departureLocation: input.departureLocation,
    desiredAttractions: input.desiredAttractions,
    travelPace: input.travelPace,
    stops: input.stops,
    budget: input.budget ? '[REDACTED]' : undefined,
    notes: input.notes ? `[${input.notes.length} chars REDACTED]` : undefined,
  };
}

/**
 * Redact sensitive information from plan
 */
function redactSensitivePlan(plan: ItineraryPlan): Partial<ItineraryPlan> {
  return {
    isFeasible: plan.isFeasible,
    summary: plan.summary,
    totalNights: plan.totalNights,
    totalCalendarDays: plan.totalCalendarDays,
    route: plan.route?.map((s) => ({
      location: s.location,
      startDay: s.startDay,
      endDay: s.endDay,
      nights: s.nights,
    })),
    confidence: plan.confidence,
  };
}

/**
 * Log normalized input
 */
export function debugLogNormalizedInput(input: NormalizedTripInput): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  console.log('[Debug:Input] Normalized input:');
  console.log(JSON.stringify(redactSensitiveInput(input), null, 2));
}

/**
 * Log trip context
 */
export function debugLogTripContext(context: TripContext): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  console.log('[Debug:Context] Computed trip context:');
  console.log(JSON.stringify(context, null, 2));
}

/**
 * Log planning prompt metadata
 */
export function debugLogPlanningPromptMetadata(
  systemPrompt: string,
  userPrompt: string,
  heuristicsCount: number
): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const metadata = {
    systemPromptLength: systemPrompt.length,
    userPromptLength: userPrompt.length,
    combinedLength: systemPrompt.length + userPrompt.length,
    heuristicsIncluded: heuristicsCount,
    sections: {
      systemPrompt: extractSections(systemPrompt),
      userPrompt: extractSections(userPrompt),
    },
  };

  console.log('[Debug:Planning] Prompt metadata:');
  console.log(JSON.stringify(metadata, null, 2));

  if (config.verbose) {
    console.log('[Debug:Planning] Full system prompt:');
    console.log(systemPrompt);
    console.log('[Debug:Planning] Full user prompt:');
    console.log(userPrompt);
  }
}

/**
 * Extract section headers from prompt (useful for debugging structure)
 */
function extractSections(prompt: string): string[] {
  const lines = prompt.split('\n');
  return lines
    .filter((line) => line.match(/^[A-Z].*:$/))
    .slice(0, 10); // first 10 section headers
}

/**
 * Log planner raw response (first/last portions)
 */
export function debugLogPlannerResponse(response: string, isSuccess: boolean): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const length = response.length;
  const preview = {
    length,
    isSuccess,
    firstChars: response.substring(0, 200),
    lastChars: response.substring(Math.max(0, length - 200)),
    hasJsonOpen: response.includes('{'),
    hasJsonClose: response.includes('}'),
  };

  console.log('[Debug:Response] Planner raw response:');
  console.log(JSON.stringify(preview, null, 2));

  if (config.verbose && response.length < 5000) {
    console.log('[Debug:Response] Full response:');
    console.log(response);
  }
}

/**
 * Log parse result
 */
export function debugLogParseResult(result: {
  success: boolean;
  errors?: Array<{ type: string; field?: string; message: string }>;
}): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const summary = {
    success: result.success,
    extractionErrors: result.errors?.filter((e) => e.type === 'extraction').length || 0,
    schemaErrors: result.errors?.filter((e) => e.type === 'schema').length || 0,
    constraintErrors: result.errors?.filter((e) => e.type === 'constraint').length || 0,
    validationErrors: result.errors?.filter((e) => e.type === 'validation').length || 0,
    totalErrors: result.errors?.length || 0,
  };

  console.log('[Debug:Parse] Parse result:');
  console.log(JSON.stringify(summary, null, 2));

  if (config.verbose && result.errors && result.errors.length > 0) {
    console.log('[Debug:Parse] Error details:');
    result.errors.forEach((e, i) => {
      console.log(
        `  ${i + 1}. [${e.type}]${e.field ? ` (${e.field})` : ''}: ${e.message}`
      );
    });
  }
}

/**
 * Log validation issues
 */
export function debugLogValidationIssues(issues: PlanValidationIssue[]): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const summary = {
    totalIssues: issues.length,
    errors: issues.filter((i) => i.severity === 'error').length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    infoMessages: issues.filter((i) => i.severity === 'info').length,
    byRuleType: groupBy(issues, 'rule'),
  };

  console.log('[Debug:Validation] Validation issues:');
  console.log(JSON.stringify(summary, null, 2));

  if (config.verbose && issues.length > 0) {
    console.log('[Debug:Validation] Issue details:');
    issues.forEach((issue, i) => {
      console.log(
        `  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.rule}${issue.location ? ` (${issue.location})` : ''}`
      );
      console.log(`     ${issue.message}`);
    });
  }
}

/**
 * Log plan (with sensitive data redacted)
 */
export function debugLogPlan(plan: ItineraryPlan | null, label: string = 'Plan'): void {
  const config = getDebugConfig();
  if (!config.enabled || !plan) return;

  console.log(`[Debug:Plan] ${label}:`);
  console.log(JSON.stringify(redactSensitivePlan(plan), null, 2));
}

/**
 * Log repair trigger
 */
export function debugLogRepairTriggered(issueCount: number, issueRules: string[]): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  console.log('[Debug:Repair] Repair triggered:');
  console.log(JSON.stringify({ issueCount, issueRules }, null, 2));
}

/**
 * Log repair result
 */
export function debugLogRepairResult(success: boolean, originalErrors: number, newErrors?: number): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const result = {
    success,
    originalErrors,
    newErrors: newErrors !== undefined ? newErrors : 'not revalidated',
    improved: newErrors !== undefined ? originalErrors > newErrors : undefined,
  };

  console.log('[Debug:Repair] Repair result:');
  console.log(JSON.stringify(result, null, 2));
}

/**
 * Log rendering metadata
 */
export function debugLogRenderingMetadata(
  planSize: number,
  contextSize: number,
  maxTokens: number
): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const metadata = {
    planStructureSize: planSize,
    contextSize,
    expectedTokens: Math.ceil((planSize + contextSize) / 4), // rough estimate
    maxTokensAllowed: maxTokens,
  };

  console.log('[Debug:Rendering] Rendering input metadata:');
  console.log(JSON.stringify(metadata, null, 2));
}

/**
 * Log rendering response
 */
export function debugLogRenderingResponse(markdown: string, success: boolean): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  const metadata = {
    success,
    length: markdown.length,
    lineCount: markdown.split('\n').length,
    hasHeadings: (markdown.match(/^#+\s/gm) || []).length,
    hasLists: (markdown.match(/^[-*]\s/gm) || []).length,
    preview: markdown.substring(0, 300),
  };

  console.log('[Debug:Rendering] Response metadata:');
  console.log(JSON.stringify(metadata, null, 2));

  if (config.verbose && markdown.length < 10000) {
    console.log('[Debug:Rendering] Full markdown:');
    console.log(markdown);
  }
}

/**
 * Log full pipeline summary
 */
export function debugLogPipelineSummary(summary: {
  inputValidationSuccess: boolean;
  planningSuccess: boolean;
  planningRepairAttempted: boolean;
  planningRepairSuccess?: boolean;
  validationPassed: boolean;
  renderingSuccess: boolean;
  totalTimeMs?: number;
}): void {
  const config = getDebugConfig();
  if (!config.enabled) return;

  console.log('[Debug:Pipeline] Full pipeline summary:');
  console.log(JSON.stringify(summary, null, 2));
}

/**
 * Helper: group array by property
 */
function groupBy<T extends Record<K, any>, K extends keyof T>(
  arr: T[],
  key: K
): Record<string, number> {
  const result: Record<string, number> = {};
  arr.forEach((item) => {
    const groupKey = String(item[key]);
    result[groupKey] = (result[groupKey] || 0) + 1;
  });
  return result;
}

/**
 * Format a debug timestamp
 */
export function debugTimestamp(): string {
  if (!globalDebugConfig.enabled) return '';
  const now = new Date();
  return `[${now.toISOString()}]`;
}
