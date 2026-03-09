import { ItineraryPlan, PlanStop, TransportSegment } from '../types/plan';
import { NormalizedTripInput } from './validation';
import { TripContext } from './tripContext';

/**
 * Severity levels for validation issues
 */
export type ValidationSeverity = 'error' | 'warning' | 'info';

/**
 * A single validation issue found during business-rule validation
 */
export interface PlanValidationIssue {
  rule: string;
  severity: ValidationSeverity;
  message: string;
  location?: string; // e.g., "stop_3" or "segment_2"
  suggestion?: string;
}

/**
 * Result of business-rule validation on a plan
 */
export interface PlanValidationResult {
  valid: boolean; // true if no critical errors
  issues: PlanValidationIssue[];
  warnings: PlanValidationIssue[];
  score: number; // 0-100, 100 = perfect
  summary: string;
}

/**
 * Main validator: runs all business-rule checks on a plan
 */
export function validatePlanBusinessRules(
  plan: ItineraryPlan,
  input: NormalizedTripInput,
  context: TripContext
): PlanValidationResult {
  const issues: PlanValidationIssue[] = [];

  // Rule 1: Total nights must match backend-computed value
  validateTotalNights(plan, context, issues);

  // Rule 2: Route must have at least one stop
  validateMinimumStops(plan, issues);

  // Rule 3: No stop can have zero or negative nights
  validateNonNegativeNights(plan, issues);

  // Rule 4: Final stop compatibility with departure location
  validateFinalStopLocation(plan, input, issues);

  // Rule 5: Return logic for different departure/arrival
  validateReturnLogic(plan, input, issues);

  // Rule 6: Transport segments coherent with route stops
  validateTransportCoherence(plan, issues);

  // Rule 7: If infeasible, must have issues/alternatives
  validateInfeasibilityExplanation(plan, issues);

  // Additional check: Day ordering and continuity
  validateDayOrdering(plan, issues);

  // Separate into critical errors and warnings
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  // Calculate validity and score
  const valid = errors.length === 0;
  const score = calculateScore(plan, errors, warnings);
  const summary = generateSummary(valid, errors, warnings);

  return {
    valid,
    issues,
    warnings,
    score,
    summary,
  };
}

/**
 * Rule 1: Total nights in route must equal backend-computed totalNights
 */
function validateTotalNights(
  plan: ItineraryPlan,
  context: TripContext,
  issues: PlanValidationIssue[]
): void {
  const totalNightsInPlan = plan.route.reduce((sum, stop) => sum + stop.nights, 0);

  if (totalNightsInPlan !== context.totalNights) {
    issues.push({
      rule: 'TOTAL_NIGHTS_MATCH',
      severity: 'error',
      message: `Route nights (${totalNightsInPlan}) do not match expected total (${context.totalNights})`,
      suggestion: `Check that all stops are properly allocated and nights sum to ${context.totalNights}`,
    });
  }
}

/**
 * Rule 2: Route must contain at least one stop
 */
function validateMinimumStops(plan: ItineraryPlan, issues: PlanValidationIssue[]): void {
  if (!plan.route || plan.route.length === 0) {
    issues.push({
      rule: 'MINIMUM_STOPS',
      severity: 'error',
      message: 'Route must contain at least one stop',
      suggestion: 'Planner should create at least one destination stop',
    });
  }
}

/**
 * Rule 3: No stop can have zero or negative nights (unless transit-only, which we don't support yet)
 */
function validateNonNegativeNights(plan: ItineraryPlan, issues: PlanValidationIssue[]): void {
  plan.route.forEach((stop, index) => {
    if (stop.nights <= 0) {
      issues.push({
        rule: 'NON_NEGATIVE_NIGHTS',
        severity: 'error',
        message: `Stop ${index + 1} (${stop.location}) has ${stop.nights} nights, must be > 0`,
        location: `stop_${index}`,
        suggestion: 'Each stop must have at least 1 night stay',
      });
    }
  });
}

/**
 * Rule 4: Final stop must be compatible with departure location
 * The last destination in the route should match or relate to the departure location
 * (i.e., where the traveler ends their journey should be near where they leave)
 */
function validateFinalStopLocation(
  plan: ItineraryPlan,
  input: NormalizedTripInput,
  issues: PlanValidationIssue[]
): void {
  if (plan.route.length === 0) return;

  const finalStop = plan.route[plan.route.length - 1];
  const departureLocation = input.departureLocation.toLowerCase().trim();
  const finalLocation = finalStop.location.toLowerCase().trim();

  // Check if final location matches or is very similar to departure
  // Allow for variations like "London" vs "London, UK"
  const isMatch =
    finalLocation === departureLocation ||
    finalLocation.includes(departureLocation) ||
    departureLocation.includes(finalLocation.split(',')[0]); // Account for "City, Country" format

  if (!isMatch) {
    issues.push({
      rule: 'FINAL_STOP_LOCATION',
      severity: 'warning',
      message: `Final stop (${finalStop.location}) does not match departure location (${input.departureLocation})`,
      location: `stop_${plan.route.length - 1}`,
      suggestion: 'Plan should end where traveler departs from',
    });
  }
}

/**
 * Rule 5: If departure location differs from final destination, must have return logic or warning
 */
function validateReturnLogic(
  plan: ItineraryPlan,
  input: NormalizedTripInput,
  issues: PlanValidationIssue[]
): void {
  if (plan.route.length === 0) return;

  const departureLocation = input.departureLocation.toLowerCase().trim();
  const finalLocation = plan.route[plan.route.length - 1].location.toLowerCase().trim();

  const isMatch =
    finalLocation === departureLocation ||
    finalLocation.includes(departureLocation) ||
    departureLocation.includes(finalLocation.split(',')[0]);

  // If they don't match, check for return indicators
  if (!isMatch) {
    const hasReturnWarning =
      plan.warnings && plan.warnings.some((w) => w.toLowerCase().includes('return'));
    const hasReturnTransport =
      plan.transportSegments &&
      plan.transportSegments.some((seg) => seg.to === input.departureLocation);

    if (!hasReturnWarning && !hasReturnTransport) {
      issues.push({
        rule: 'RETURN_LOGIC',
        severity: 'warning',
        message: `Trip ends in ${finalLocation} but departs from ${input.departureLocation}, but no return journey documented`,
        suggestion: 'Add warning or transport segment showing return to departure location',
      });
    }
  }
}

/**
 * Rule 6: Transport segments should be coherent with route stops
 * - Segments should connect stops in order
 * - ~= route.length - 1 segments (one between each pair)
 */
function validateTransportCoherence(plan: ItineraryPlan, issues: PlanValidationIssue[]): void {
  if (!plan.transportSegments) return;
  if (plan.route.length === 0) return;

  // Basic check: number of segments should be approximately route.length - 1
  // (allows some flexibility for multi-leg days or skipped segments)
  const expectedSegmentCount = Math.max(1, plan.route.length - 1);
  const minExpected = Math.max(0, expectedSegmentCount - 1);
  const maxExpected = expectedSegmentCount + 1;

  if (
    plan.transportSegments.length < minExpected ||
    plan.transportSegments.length > maxExpected
  ) {
    issues.push({
      rule: 'TRANSPORT_COHERENCE_COUNT',
      severity: 'warning',
      message: `Expected ~${expectedSegmentCount} transport segments for ${plan.route.length} stops, found ${plan.transportSegments.length}`,
      suggestion: 'Check that segments connect all route stops',
    });
  }

  // Check segment-to-stop connectivity (sample first and last)
  if (plan.transportSegments.length > 0) {
    const firstSegment = plan.transportSegments[0];
    const firstStop = plan.route[0];

    // First segment should start from first stop location
    if (firstSegment.from && firstSegment.from !== firstStop.location) {
      issues.push({
        rule: 'TRANSPORT_COHERENCE_START',
        severity: 'warning',
        message: `First transport segment starts from ${firstSegment.from} but first stop is ${firstStop.location}`,
        location: 'segment_0',
        suggestion: 'First segment should originate from first stop location',
      });
    }

    const lastSegment = plan.transportSegments[plan.transportSegments.length - 1];
    const lastStop = plan.route[plan.route.length - 1];

    // Last segment should end at last stop location
    if (lastSegment.to && lastSegment.to !== lastStop.location) {
      issues.push({
        rule: 'TRANSPORT_COHERENCE_END',
        severity: 'warning',
        message: `Last transport segment ends at ${lastSegment.to} but final stop is ${lastStop.location}`,
        location: `segment_${plan.transportSegments.length - 1}`,
        suggestion: 'Last segment should terminate at final stop location',
      });
    }
  }
}

/**
 * Rule 7: If plan is marked infeasible, must have issues/warnings explaining why
 */
function validateInfeasibilityExplanation(
  plan: ItineraryPlan,
  issues: PlanValidationIssue[]
): void {
  if (!plan.isFeasible) {
    const hasIssues = plan.issues && plan.issues.length > 0;
    const hasWarnings = plan.warnings && plan.warnings.length > 0;

    if (!hasIssues && !hasWarnings) {
      issues.push({
        rule: 'INFEASIBILITY_EXPLANATION',
        severity: 'error',
        message: 'Plan marked as infeasible but no issues or warnings provided',
        suggestion: 'Add explanatory issues or warnings when marking plan as infeasible',
      });
    }
  }
}

/**
 * Additional check: Day ordering and continuity
 * - First stop should start on day 1
 * - Each stop's endDay should be < next stop's startDay (or endDay = startDay for arrival/departure day)
 * - Last stop's endDay should be near trip end
 */
function validateDayOrdering(plan: ItineraryPlan, issues: PlanValidationIssue[]): void {
  if (plan.route.length === 0) return;

  const firstStop = plan.route[0];
  if (firstStop.startDay !== 1) {
    issues.push({
      rule: 'DAY_ORDERING_START',
      severity: 'warning',
      message: `First stop should start on day 1, but starts on day ${firstStop.startDay}`,
      location: 'stop_0',
      suggestion: 'Adjust day numbering so trip starts on day 1',
    });
  }

  // Check continuity between stops
  for (let i = 0; i < plan.route.length - 1; i++) {
    const current = plan.route[i];
    const next = plan.route[i + 1];

    // Current end should be before or at next start
    if (current.endDay >= next.startDay) {
      issues.push({
        rule: 'DAY_ORDERING_CONTINUITY',
        severity: 'error',
        message: `Stop ${i + 1} ends on day ${current.endDay} but stop ${i + 2} starts on day ${next.startDay} - overlap detected`,
        location: `stop_${i}_${i + 1}`,
        suggestion: 'Days should not overlap between consecutive stops',
      });
    }
  }
}

/**
 * Calculate a validity score (0-100)
 * - 100 = no issues, all rules passed
 * - Lower with each issue/warning
 */
function calculateScore(
  plan: ItineraryPlan,
  errors: PlanValidationIssue[],
  warnings: PlanValidationIssue[]
): number {
  let score = 100;

  // Deduct for critical errors (more severe)
  score -= errors.length * 20;

  // Deduct for warnings (less severe)
  score -= warnings.length * 5;

  // Boost if plan explicitly marked as feasible
  if (plan.isFeasible) {
    score += 10;
  }

  // Consider confidence level if available
  if (plan.confidence !== undefined && plan.confidence < 0.5) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate human-readable validation summary
 */
function generateSummary(
  valid: boolean,
  errors: PlanValidationIssue[],
  warnings: PlanValidationIssue[]
): string {
  if (valid && warnings.length === 0) {
    return 'Plan is valid and passes all business rules';
  }

  if (valid && warnings.length > 0) {
    return `Plan is valid but has ${warnings.length} warning(s) that should be reviewed`;
  }

  if (!valid) {
    return `Plan is INVALID: ${errors.length} critical error(s) found. ${warnings.length} warning(s) also present.`;
  }

  return 'Validation completed with issues';
}

/**
 * Format validation issues for logging
 */
export function formatValidationIssues(result: PlanValidationResult): string {
  const lines: string[] = [];

  lines.push(`[Validation] ${result.summary}`);
  lines.push(`[Validation] Score: ${result.score}/100`);

  if (result.issues.length > 0) {
    lines.push('[Validation] Issues:');
    result.issues.forEach((issue, i) => {
      const location = issue.location ? ` (${issue.location})` : '';
      lines.push(`  ${i + 1}. [${issue.severity.toUpperCase()}] ${issue.rule}${location}`);
      lines.push(`     ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`     → ${issue.suggestion}`);
      }
    });
  }

  return lines.join('\n');
}
