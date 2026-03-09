import { ItineraryPlan, Stop, TransportSegment } from './types/plan';

/**
 * Validation error with field path and human-readable message.
 */
export interface ValidationError {
  path: string; // e.g., "route[0].startDay"
  message: string;
}

/**
 * Validation result: either valid with plan, or invalid with errors.
 */
export interface ValidatorResult {
  valid: boolean;
  plan?: ItineraryPlan;
  errors: ValidationError[];
}

/**
 * Check if a value is a positive integer.
 */
function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

/**
 * Check if a value is a non-negative integer (allows 0).
 */
function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/**
 * Check if a value is a non-empty string.
 */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if a value is an array of strings.
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Validate a single Stop object.
 */
function validateStop(stop: unknown, index: number, expectedTotalNights: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `route[${index}]`;

  if (!stop || typeof stop !== 'object') {
    errors.push({ path: prefix, message: 'Stop must be an object' });
    return errors;
  }

  const s = stop as Record<string, unknown>;

  // location
  if (!isNonEmptyString(s.location)) {
    errors.push({ path: `${prefix}.location`, message: 'location must be a non-empty string' });
  }

  // startDay
  if (!isPositiveInteger(s.startDay)) {
    errors.push({ path: `${prefix}.startDay`, message: 'startDay must be a positive integer' });
  } else if (index === 0 && s.startDay !== 1) {
    errors.push({ path: `${prefix}.startDay`, message: 'First stop startDay must be 1' });
  }

  // endDay
  if (!isPositiveInteger(s.endDay)) {
    errors.push({ path: `${prefix}.endDay`, message: 'endDay must be a positive integer' });
  } else if (isPositiveInteger(s.startDay) && s.endDay < s.startDay) {
    errors.push({ path: `${prefix}.endDay`, message: 'endDay must be >= startDay' });
  } else if (s.endDay > expectedTotalNights) {
    errors.push({ path: `${prefix}.endDay`, message: `endDay cannot exceed totalNights (${expectedTotalNights})` });
  }

  // nights
  if (!isPositiveInteger(s.nights)) {
    errors.push({ path: `${prefix}.nights`, message: 'nights must be a positive integer' });
  } else if (isPositiveInteger(s.startDay) && isPositiveInteger(s.endDay)) {
    const computed = s.endDay - s.startDay + 1;
    if (s.nights !== computed) {
      errors.push({
        path: `${prefix}.nights`,
        message: `nights must equal (endDay - startDay + 1). Expected ${computed}, got ${s.nights}`,
      });
    }
  }

  // reason
  if (!isNonEmptyString(s.reason)) {
    errors.push({ path: `${prefix}.reason`, message: 'reason must be a non-empty string' });
  }

  return errors;
}

/**
 * Validate a single TransportSegment object.
 */
function validateTransportSegment(segment: unknown, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  const prefix = `transportSegments[${index}]`;

  if (!segment || typeof segment !== 'object') {
    errors.push({ path: prefix, message: 'Transport segment must be an object' });
    return errors;
  }

  const seg = segment as Record<string, unknown>;

  // from
  if (!isNonEmptyString(seg.from)) {
    errors.push({ path: `${prefix}.from`, message: 'from must be a non-empty string' });
  }

  // to
  if (!isNonEmptyString(seg.to)) {
    errors.push({ path: `${prefix}.to`, message: 'to must be a non-empty string' });
  }

  // day
  if (!isNonNegativeInteger(seg.day) || (seg.day as number) < 1) {
    errors.push({ path: `${prefix}.day`, message: 'day must be a positive integer' });
  }

  // mode
  if (!isNonEmptyString(seg.mode)) {
    errors.push({ path: `${prefix}.mode`, message: 'mode must be a non-empty string' });
  }

  // estimatedDuration
  if (!isNonEmptyString(seg.estimatedDuration)) {
    errors.push({ path: `${prefix}.estimatedDuration`, message: 'estimatedDuration must be a non-empty string' });
  }

  // cost
  if (!isNonEmptyString(seg.cost)) {
    errors.push({ path: `${prefix}.cost`, message: 'cost must be a non-empty string' });
  }

  return errors;
}

/**
 * Strictly validate a parsed ItineraryPlan.
 * Returns ValidatorResult with detailed errors if invalid.
 */
export function validatePlan(plan: unknown, expectedTotalNights: number): ValidatorResult {
  const errors: ValidationError[] = [];

  // Type guard
  if (!plan || typeof plan !== 'object') {
    return {
      valid: false,
      errors: [{ path: 'root', message: 'Plan must be an object' }],
    };
  }

  const p = plan as Record<string, unknown>;

  // ============ TOP-LEVEL FIELDS ============

  // isFeasible
  if (typeof p.isFeasible !== 'boolean') {
    errors.push({ path: 'isFeasible', message: 'isFeasible must be a boolean (true or false)' });
  }

  // summary
  if (!isNonEmptyString(p.summary)) {
    errors.push({ path: 'summary', message: 'summary must be a non-empty string' });
  }

  // totalNights
  if (!isPositiveInteger(p.totalNights)) {
    errors.push({ path: 'totalNights', message: 'totalNights must be a positive integer' });
  } else if (p.totalNights !== expectedTotalNights) {
    errors.push({
      path: 'totalNights',
      message: `totalNights must equal ${expectedTotalNights}, got ${p.totalNights}`,
    });
  }

  // ============ ROUTE ARRAY ============

  if (!Array.isArray(p.route)) {
    errors.push({ path: 'route', message: 'route must be an array' });
  } else {
    if (p.route.length === 0) {
      errors.push({ path: 'route', message: 'route must have at least 1 stop' });
    }

    // Validate each stop
    let routeNightSum = 0;
    const routeLocations = new Set<string>();

    p.route.forEach((stop, index) => {
      const stopErrors = validateStop(stop, index, expectedTotalNights);
      errors.push(...stopErrors);

      // Check for duplicates and sum nights
      if (stop && typeof stop === 'object') {
        const s = stop as Record<string, unknown>;
        if (isNonEmptyString(s.location)) {
          const loc = s.location.toLowerCase();
          if (routeLocations.has(loc)) {
            errors.push({ path: `route[${index}].location`, message: `Duplicate location: ${s.location}` });
          }
          routeLocations.add(loc);
        }
        if (isPositiveInteger(s.nights)) {
          routeNightSum += s.nights;
        }
      }
    });

    // Check night sum if no errors yet
    if (errors.filter((e) => e.path.startsWith('route')).length === 0 && isPositiveInteger(p.totalNights)) {
      if (routeNightSum !== p.totalNights) {
        errors.push({
          path: 'route',
          message: `Sum of stop nights (${routeNightSum}) must equal totalNights (${p.totalNights})`,
        });
      }
    }
  }

  // ============ TRANSPORT SEGMENTS ARRAY ============

  if (!Array.isArray(p.transportSegments)) {
    errors.push({ path: 'transportSegments', message: 'transportSegments must be an array' });
  } else {
    p.transportSegments.forEach((segment, index) => {
      const segErrors = validateTransportSegment(segment, index);
      errors.push(...segErrors);
    });
  }

  // ============ WARNINGS ARRAY ============

  if (!isStringArray(p.warnings)) {
    errors.push({ path: 'warnings', message: 'warnings must be an array of strings' });
  }

  // ============ CUTS OR ALTERNATIVES ARRAY ============

  if (!isStringArray(p.cutsOrAlternatives)) {
    errors.push({ path: 'cutsOrAlternatives', message: 'cutsOrAlternatives must be an array of strings' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    plan: plan as ItineraryPlan,
    errors: [],
  };
}
