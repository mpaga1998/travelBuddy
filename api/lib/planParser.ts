/**
 * Strict parser and validator for planning JSON responses
 * Ensures GPT output is machine-readable before consuming it
 */

import { ItineraryPlan, PlanStop, TransportSegment } from '../types/plan';
import { TripContext } from './tripContext';

export interface PlanParseError {
  type: 'extraction' | 'schema' | 'validation' | 'constraint';
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ParseResult {
  success: boolean;
  plan?: ItineraryPlan;
  errors: PlanParseError[];
  rawResponse?: string;
}

/**
 * Parse and validate JSON response from planning step
 * @param content Raw response content from GPT
 * @param context Trip context for constraint validation
 * @returns ParseResult with plan or detailed errors
 */
export function parsePlanResponse(content: string, context: TripContext): ParseResult {
  const errors: PlanParseError[] = [];

  // Step 1: Extract JSON from response
  let jsonObj: any;
  const extractResult = extractJsonFromResponse(content);
  if (!extractResult.success) {
    errors.push({
      type: 'extraction',
      message: extractResult.error!,
      severity: 'error',
    });
    return { success: false, errors, rawResponse: content };
  }
  jsonObj = extractResult.data;

  // Step 2: Validate schema (required fields, types)
  const schemaErrors = validatePlanSchema(jsonObj);
  errors.push(...schemaErrors);
  
  if (schemaErrors.some((e) => e.severity === 'error')) {
    return { success: false, errors, rawResponse: content };
  }

  // Step 3: Validate constraints against trip context
  const constraintErrors = validatePlanConstraints(jsonObj, context);
  errors.push(...constraintErrors);

  if (constraintErrors.some((e) => e.severity === 'error')) {
    return { success: false, errors, rawResponse: content };
  }

  // All validations passed
  return {
    success: true,
    plan: jsonObj as ItineraryPlan,
    errors: errors.filter((e) => e.severity === 'warning'), // only warnings remain
  };
}

/**
 * Extract JSON object from response that may contain text before/after
 */
function extractJsonFromResponse(content: string): { success: boolean; data?: any; error?: string } {
  // Try direct parse first
  try {
    const parsed = JSON.parse(content.trim());
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { success: true, data: parsed };
    }
  } catch (e) {
    // Expected, try extraction
  }

  // Try to find JSON object in content (handles markdown code blocks, wrapping text, etc.)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      success: false,
      error: `No JSON object found in response. Content: ${content.substring(0, 100)}...`,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { success: true, data: parsed };
    }
  } catch (err) {
    return {
      success: false,
      error: `JSON parsing failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }

  return {
    success: false,
    error: 'Extracted text is not a valid JSON object',
  };
}

/**
 * Validate plan schema (required fields, correct types)
 */
function validatePlanSchema(obj: any): PlanParseError[] {
  const errors: PlanParseError[] = [];

  // Required fields + type checks
  const fieldValidations = [
    { field: 'isFeasible', type: 'boolean', required: true },
    { field: 'summary', type: 'string', required: true },
    { field: 'totalNights', type: 'number', required: true },
    { field: 'totalCalendarDays', type: 'number', required: true },
    { field: 'route', type: 'array', required: true },
    { field: 'transportSegments', type: 'array', required: true },
    { field: 'issues', type: 'array', required: true },
    { field: 'warnings', type: 'array', required: true },
    { field: 'suggestedAlternatives', type: 'array', required: true },
    { field: 'confidence', type: 'number', required: true },
  ];

  for (const validation of fieldValidations) {
    const value = obj[validation.field];

    if (value === undefined || value === null) {
      if (validation.required) {
        errors.push({
          type: 'schema',
          field: validation.field,
          message: `Required field "${validation.field}" is missing`,
          severity: 'error',
        });
      }
      continue;
    }

    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== validation.type) {
      errors.push({
        type: 'schema',
        field: validation.field,
        message: `Field "${validation.field}" must be ${validation.type}, got ${actualType}`,
        severity: 'error',
      });
    }
  }

  // Type-specific validations
  if (typeof obj.totalNights === 'number' && obj.totalNights <= 0) {
    errors.push({
      type: 'schema',
      field: 'totalNights',
      message: 'totalNights must be positive',
      severity: 'error',
    });
  }

  if (typeof obj.totalCalendarDays === 'number' && obj.totalCalendarDays <= 0) {
    errors.push({
      type: 'schema',
      field: 'totalCalendarDays',
      message: 'totalCalendarDays must be positive',
      severity: 'error',
    });
  }

  if (typeof obj.confidence === 'number' && (obj.confidence < 0 || obj.confidence > 10)) {
    errors.push({
      type: 'schema',
      field: 'confidence',
      message: 'confidence must be 0-10',
      severity: 'error',
    });
  }

  // Validate route array elements
  if (Array.isArray(obj.route)) {
    for (let i = 0; i < obj.route.length; i++) {
      const stop = obj.route[i];
      const stopErrors = validateStopSchema(stop, i);
      errors.push(...stopErrors);
    }
  }

  // Validate transportSegments array elements
  if (Array.isArray(obj.transportSegments)) {
    for (let i = 0; i < obj.transportSegments.length; i++) {
      const segment = obj.transportSegments[i];
      const segmentErrors = validateTransportSchema(segment, i);
      errors.push(...segmentErrors);
    }
  }

  // Validate array contents
  if (Array.isArray(obj.issues)) {
    if (!obj.issues.every((item: any) => typeof item === 'string')) {
      errors.push({
        type: 'schema',
        field: 'issues',
        message: 'issues array must contain only strings',
        severity: 'error',
      });
    }
  }

  if (Array.isArray(obj.warnings)) {
    if (!obj.warnings.every((item: any) => typeof item === 'string')) {
      errors.push({
        type: 'schema',
        field: 'warnings',
        message: 'warnings array must contain only strings',
        severity: 'error',
      });
    }
  }

  if (Array.isArray(obj.suggestedAlternatives)) {
    if (!obj.suggestedAlternatives.every((item: any) => typeof item === 'string')) {
      errors.push({
        type: 'schema',
        field: 'suggestedAlternatives',
        message: 'suggestedAlternatives array must contain only strings',
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validate a single stop in the route
 */
function validateStopSchema(stop: any, index: number): PlanParseError[] {
  const errors: PlanParseError[] = [];

  const requiredFields = ['location', 'startDay', 'endDay', 'nights', 'reason', 'highlights'];
  for (const field of requiredFields) {
    if (stop[field] === undefined || stop[field] === null) {
      errors.push({
        type: 'schema',
        field: `route[${index}].${field}`,
        message: `Stop ${index} missing required field "${field}"`,
        severity: 'error',
      });
    }
  }

  if (typeof stop.location !== 'string') {
    errors.push({
      type: 'schema',
      field: `route[${index}].location`,
      message: `Stop ${index} location must be string`,
      severity: 'error',
    });
  }

  if (typeof stop.startDay !== 'number' || stop.startDay < 1) {
    errors.push({
      type: 'schema',
      field: `route[${index}].startDay`,
      message: `Stop ${index} startDay must be positive integer`,
      severity: 'error',
    });
  }

  if (typeof stop.endDay !== 'number' || stop.endDay < 1) {
    errors.push({
      type: 'schema',
      field: `route[${index}].endDay`,
      message: `Stop ${index} endDay must be positive integer`,
      severity: 'error',
    });
  }

  if (typeof stop.nights !== 'number' || stop.nights < 0) {
    errors.push({
      type: 'schema',
      field: `route[${index}].nights`,
      message: `Stop ${index} nights must be non-negative integer`,
      severity: 'error',
    });
  }

  if (typeof stop.reason !== 'string') {
    errors.push({
      type: 'schema',
      field: `route[${index}].reason`,
      message: `Stop ${index} reason must be string`,
      severity: 'error',
    });
  }

  if (!Array.isArray(stop.highlights)) {
    errors.push({
      type: 'schema',
      field: `route[${index}].highlights`,
      message: `Stop ${index} highlights must be array`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate a single transport segment
 */
function validateTransportSchema(segment: any, index: number): PlanParseError[] {
  const errors: PlanParseError[] = [];

  const requiredFields = ['from', 'to', 'departDay', 'duration', 'mode', 'costEstimate', 'earlyStart'];
  for (const field of requiredFields) {
    if (segment[field] === undefined || segment[field] === null) {
      errors.push({
        type: 'schema',
        field: `transportSegments[${index}].${field}`,
        message: `Segment ${index} missing required field "${field}"`,
        severity: 'error',
      });
    }
  }

  if (typeof segment.from !== 'string') {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].from`,
      message: `Segment ${index} from must be string`,
      severity: 'error',
    });
  }

  if (typeof segment.to !== 'string') {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].to`,
      message: `Segment ${index} to must be string`,
      severity: 'error',
    });
  }

  if (typeof segment.departDay !== 'number' || segment.departDay < 1) {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].departDay`,
      message: `Segment ${index} departDay must be positive integer`,
      severity: 'error',
    });
  }

  if (typeof segment.duration !== 'string') {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].duration`,
      message: `Segment ${index} duration must be string`,
      severity: 'error',
    });
  }

  if (typeof segment.mode !== 'string') {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].mode`,
      message: `Segment ${index} mode must be string`,
      severity: 'error',
    });
  }

  if (typeof segment.costEstimate !== 'string') {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].costEstimate`,
      message: `Segment ${index} costEstimate must be string`,
      severity: 'error',
    });
  }

  if (typeof segment.earlyStart !== 'boolean') {
    errors.push({
      type: 'schema',
      field: `transportSegments[${index}].earlyStart`,
      message: `Segment ${index} earlyStart must be boolean`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Validate plan against trip context constraints
 */
function validatePlanConstraints(plan: any, context: TripContext): PlanParseError[] {
  const errors: PlanParseError[] = [];

  // totalNights must match
  if (plan.totalNights !== context.totalNights) {
    errors.push({
      type: 'constraint',
      field: 'totalNights',
      message: `totalNights (${plan.totalNights}) must match context (${context.totalNights})`,
      severity: 'error',
    });
  }

  // totalCalendarDays must match
  if (plan.totalCalendarDays !== context.totalCalendarDays) {
    errors.push({
      type: 'constraint',
      field: 'totalCalendarDays',
      message: `totalCalendarDays (${plan.totalCalendarDays}) must match context (${context.totalCalendarDays})`,
      severity: 'error',
    });
  }

  // Route validations
  if (Array.isArray(plan.route) && plan.route.length > 0) {
    const firstStop = plan.route[0];

    // First stop starts on day 1
    if (firstStop.startDay !== 1) {
      errors.push({
        type: 'constraint',
        field: 'route[0].startDay',
        message: `First stop must start on day 1, got day ${firstStop.startDay}`,
        severity: 'error',
      });
    }

    // First stop is arrival location
    if (firstStop.location.toLowerCase() !== context.arrivalLocation.toLowerCase()) {
      errors.push({
        type: 'constraint',
        field: 'route[0].location',
        message: `First stop (${firstStop.location}) must match arrival location (${context.arrivalLocation})`,
        severity: 'error',
      });
    }

    // Last stop is departure location
    const lastStop = plan.route[plan.route.length - 1];
    if (lastStop.location.toLowerCase() !== context.departureLocation.toLowerCase()) {
      errors.push({
        type: 'constraint',
        field: `route[${plan.route.length - 1}].location`,
        message: `Last stop (${lastStop.location}) must match departure location (${context.departureLocation})`,
        severity: 'error',
      });
    }

    // Last stop ends on the last night (totalCalendarDays - 1)
    if (lastStop.endDay !== plan.totalCalendarDays - 1) {
      errors.push({
        type: 'constraint',
        field: `route[${plan.route.length - 1}].endDay`,
        message: `Last stop must end on day ${plan.totalCalendarDays - 1} (last night), got day ${lastStop.endDay}`,
        severity: 'error',
      });
    }

    // Night math: sum of stops must equal totalNights
    const sumNights = plan.route.reduce((sum: number, stop: any) => sum + (stop.nights || 0), 0);
    if (sumNights !== plan.totalNights) {
      errors.push({
        type: 'constraint',
        field: 'route',
        message: `Sum of nights (${sumNights}) must equal totalNights (${plan.totalNights})`,
        severity: 'error',
      });
    }

    // Individual stop night math: nights = endDay - startDay
    for (let i = 0; i < plan.route.length; i++) {
      const stop = plan.route[i];
      if (typeof stop.nights === 'number' && typeof stop.startDay === 'number' && typeof stop.endDay === 'number') {
        const calculatedNights = stop.endDay - stop.startDay;
        if (stop.nights !== calculatedNights) {
          errors.push({
            type: 'constraint',
            field: `route[${i}].nights`,
            message: `Stop ${i} nights (${stop.nights}) should be ${calculatedNights} (endDay - startDay)`,
            severity: 'warning', // warning, not error - we can fix this
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Generate human-readable error summary
 */
export function formatParseErrors(errors: PlanParseError[]): string {
  if (errors.length === 0) return 'No errors';

  const errorsByType = {
    extraction: errors.filter((e) => e.type === 'extraction'),
    schema: errors.filter((e) => e.type === 'schema'),
    validation: errors.filter((e) => e.type === 'validation'),
    constraint: errors.filter((e) => e.type === 'constraint'),
  };

  const lines: string[] = [];

  if (errorsByType.extraction.length > 0) {
    lines.push('JSON Extraction Errors:');
    errorsByType.extraction.forEach((e) => lines.push(`  ❌ ${e.message}`));
  }

  if (errorsByType.schema.length > 0) {
    lines.push('Schema Errors:');
    errorsByType.schema.forEach((e) => lines.push(`  ❌ ${e.field}: ${e.message}`));
  }

  if (errorsByType.constraint.length > 0) {
    lines.push('Constraint Violations:');
    errorsByType.constraint.forEach((e) => {
      const severity = e.severity === 'error' ? '❌' : '⚠️';
      lines.push(`  ${severity} ${e.field}: ${e.message}`);
    });
  }

  return lines.join('\n');
}
