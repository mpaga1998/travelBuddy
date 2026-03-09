/**
 * Check if a value is a positive integer.
 */
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
/**
 * Check if a value is a non-negative integer (allows 0).
 */
function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
}
/**
 * Check if a value is a non-empty string.
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
/**
 * Check if a value is an array of strings.
 */
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
/**
 * Validate a single Stop object.
 */
function validateStop(stop, index, expectedTotalNights) {
    const errors = [];
    const prefix = `route[${index}]`;
    if (!stop || typeof stop !== 'object') {
        errors.push({ path: prefix, message: 'Stop must be an object' });
        return errors;
    }
    const s = stop;
    // location
    if (!isNonEmptyString(s.location)) {
        errors.push({ path: `${prefix}.location`, message: 'location must be a non-empty string' });
    }
    // startDay
    if (!isPositiveInteger(s.startDay)) {
        errors.push({ path: `${prefix}.startDay`, message: 'startDay must be a positive integer' });
    }
    else if (index === 0 && s.startDay !== 1) {
        errors.push({ path: `${prefix}.startDay`, message: 'First stop startDay must be 1' });
    }
    // endDay
    if (!isPositiveInteger(s.endDay)) {
        errors.push({ path: `${prefix}.endDay`, message: 'endDay must be a positive integer' });
    }
    else if (isPositiveInteger(s.startDay) && s.endDay < s.startDay) {
        errors.push({ path: `${prefix}.endDay`, message: 'endDay must be >= startDay' });
    }
    else if (s.endDay > expectedTotalNights) {
        errors.push({ path: `${prefix}.endDay`, message: `endDay cannot exceed totalNights (${expectedTotalNights})` });
    }
    // nights
    if (!isPositiveInteger(s.nights)) {
        errors.push({ path: `${prefix}.nights`, message: 'nights must be a positive integer' });
    }
    else if (isPositiveInteger(s.startDay) && isPositiveInteger(s.endDay)) {
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
function validateTransportSegment(segment, index) {
    const errors = [];
    const prefix = `transportSegments[${index}]`;
    if (!segment || typeof segment !== 'object') {
        errors.push({ path: prefix, message: 'Transport segment must be an object' });
        return errors;
    }
    const seg = segment;
    // from
    if (!isNonEmptyString(seg.from)) {
        errors.push({ path: `${prefix}.from`, message: 'from must be a non-empty string' });
    }
    // to
    if (!isNonEmptyString(seg.to)) {
        errors.push({ path: `${prefix}.to`, message: 'to must be a non-empty string' });
    }
    // day
    if (!isNonNegativeInteger(seg.day) || seg.day < 1) {
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
export function validatePlan(plan, expectedTotalNights) {
    const errors = [];
    // Type guard
    if (!plan || typeof plan !== 'object') {
        return {
            valid: false,
            errors: [{ path: 'root', message: 'Plan must be an object' }],
        };
    }
    const p = plan;
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
    }
    else if (p.totalNights !== expectedTotalNights) {
        errors.push({
            path: 'totalNights',
            message: `totalNights must equal ${expectedTotalNights}, got ${p.totalNights}`,
        });
    }
    // ============ ROUTE ARRAY ============
    if (!Array.isArray(p.route)) {
        errors.push({ path: 'route', message: 'route must be an array' });
    }
    else {
        if (p.route.length === 0) {
            errors.push({ path: 'route', message: 'route must have at least 1 stop' });
        }
        // Validate each stop
        let routeNightSum = 0;
        const routeLocations = new Set();
        p.route.forEach((stop, index) => {
            const stopErrors = validateStop(stop, index, expectedTotalNights);
            errors.push(...stopErrors);
            // Check for duplicates and sum nights
            if (stop && typeof stop === 'object') {
                const s = stop;
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
    }
    else {
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
        plan: plan,
        errors: [],
    };
}
// ============================================================================
// BUSINESS LOGIC VALIDATION
// ============================================================================
/**
 * Validate that the plan is logically consistent and realistic.
 * This runs AFTER JSON schema validation.
 * Checks business rules like: is the route coherent? Is return logic sound?
 */
export function validatePlanLogic(plan, context) {
    const issues = [];
    // ============ RULE 1: Route must have at least one stop ============
    if (!plan.route || plan.route.length === 0) {
        issues.push({
            rule: 'route-not-empty',
            severity: 'error',
            message: 'Route must contain at least one stop',
        });
        // Stop further validation if route is empty
        return { valid: false, issues };
    }
    // ============ RULE 2: No stop with 0 or negative nights ============
    plan.route.forEach((stop, idx) => {
        if (stop.nights <= 0) {
            issues.push({
                rule: 'stop-nights-positive',
                severity: 'error',
                message: `Stop ${idx + 1} (${stop.location}) has ${stop.nights} nights. All stops must have at least 1 night.`,
            });
        }
    });
    // ============ RULE 3: Total route nights must equal backend totalNights ============
    const totalPlanNights = plan.route.reduce((sum, stop) => sum + stop.nights, 0);
    if (totalPlanNights !== plan.totalNights) {
        issues.push({
            rule: 'night-sum-match',
            severity: 'error',
            message: `Total nights in route (${totalPlanNights}) does not match plan totalNights (${plan.totalNights})`,
        });
    }
    // ============ RULE 4: First stop must start on Day 1 ============
    if (plan.route[0] && plan.route[0].startDay !== 1) {
        issues.push({
            rule: 'first-stop-day-1',
            severity: 'error',
            message: `First stop must start on day 1, got day ${plan.route[0].startDay}`,
        });
    }
    // ============ RULE 5: Last stop must end on totalNights day ============
    const lastStop = plan.route[plan.route.length - 1];
    if (lastStop && lastStop.endDay !== plan.totalNights) {
        issues.push({
            rule: 'last-stop-end-day',
            severity: 'error',
            message: `Last stop must end on day ${plan.totalNights}, got day ${lastStop.endDay}. Remember: day ${plan.totalNights} is when traveler departs.`,
        });
    }
    // ============ RULE 6: Departure location logic ============
    // If departure location differs from final stop location, plan should address return
    const finalStopLocation = lastStop?.location;
    const departureLocation = context.departureLocation;
    const locationsMatch = finalStopLocation && departureLocation && finalStopLocation.toLowerCase() === departureLocation.toLowerCase();
    if (!locationsMatch && finalStopLocation) {
        // Plan must explain how traveler returns to departure location
        const hasReturnTransport = plan.transportSegments.some((seg) => seg.from && seg.from.toLowerCase() === finalStopLocation.toLowerCase() && seg.to && seg.to.toLowerCase() === departureLocation.toLowerCase());
        const hasReturnWarning = plan.warnings.some((w) => w.toLowerCase().includes('return') || w.toLowerCase().includes('depart'));
        if (!hasReturnTransport && !hasReturnWarning) {
            issues.push({
                rule: 'departure-logic',
                severity: 'warning',
                message: `Plan ends in ${finalStopLocation} but departure is from ${departureLocation}. No return transport or warning detected. Plan should explain how traveler reaches departure location.`,
            });
        }
    }
    // ============ RULE 7: Transport segments coherence ============
    // Should have roughly (num_stops - 1) transport segments, or more if there are multiple transfers per stop
    if (plan.route.length > 1 && plan.transportSegments.length === 0) {
        issues.push({
            rule: 'transport-coherence',
            severity: 'warning',
            message: `Route has ${plan.route.length} stops but no transport segments defined. Multi-stop trips should have transport segments between locations.`,
        });
    }
    // Check that transport segments connect stops in order (basic coherence check)
    const uniqueTransportFroms = new Set(plan.transportSegments.map((s) => s.from?.toLowerCase()));
    const routeLocations = new Set(plan.route.map((s) => s.location.toLowerCase()));
    plan.transportSegments.forEach((seg, idx) => {
        const fromLower = seg.from?.toLowerCase();
        const toLower = seg.to?.toLowerCase();
        if (fromLower && !routeLocations.has(fromLower)) {
            issues.push({
                rule: 'transport-coherence',
                severity: 'warning',
                message: `Transport segment ${idx + 1} departs from "${seg.from}" which is not in the route. Check consistency.`,
            });
        }
    });
    // ============ RULE 8: Infeasibility must justify cuts/alternatives ============
    if (!plan.isFeasible && plan.cutsOrAlternatives.length === 0) {
        issues.push({
            rule: 'infeasibility-cuts',
            severity: 'error',
            message: 'Plan is marked infeasible but provides no cutsOrAlternatives. If a trip is not feasible, suggest ways to make it work.',
        });
    }
    // ============ RULE 9: Feasible plans should not have zero nights allocated ============
    if (plan.isFeasible && plan.route.length > 0) {
        const hasZeroNightStop = plan.route.some((stop) => stop.nights === 0);
        if (hasZeroNightStop) {
            issues.push({
                rule: 'feasible-positive-nights',
                severity: 'warning',
                message: 'Plan is marked feasible but includes stops with 0 nights. For a feasible plan, allocate at least 1 night per stop.',
            });
        }
    }
    // ============ RESULT ============
    const hasErrors = issues.some((issue) => issue.severity === 'error');
    return {
        valid: !hasErrors,
        issues,
    };
}
