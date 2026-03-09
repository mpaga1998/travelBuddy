/**
 * Validate that a string is in ISO 8601 date format (YYYY-MM-DD) and is a valid date.
 */
export function isValidISODate(dateString) {
    if (typeof dateString !== 'string')
        return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString))
        return false;
    // Actually construct the date to ensure it's valid (e.g., reject 2026-02-30)
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}
/**
 * Check if date1 is strictly before date2.
 */
export function isDateBefore(date1, date2) {
    return new Date(date1) < new Date(date2);
}
/**
 * Comprehensive validation of TripInput.
 * Checks all required fields, formats, and constraints.
 */
export function validateTripInput(input) {
    const errors = [];
    // Type guard: ensure input is an object
    if (!input || typeof input !== 'object') {
        return {
            valid: false,
            errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
        };
    }
    const data = input;
    // ============ ARRIVAL.DATE ============
    if (!data.arrival || typeof data.arrival !== 'object') {
        errors.push({ field: 'arrival', message: 'arrival is required and must be an object' });
    }
    else {
        const arrival = data.arrival;
        if (arrival.date === undefined || arrival.date === null) {
            errors.push({ field: 'arrival.date', message: 'arrival.date is required' });
        }
        else if (!isValidISODate(arrival.date)) {
            errors.push({
                field: 'arrival.date',
                message: 'arrival.date must be in YYYY-MM-DD format (e.g., 2026-04-15)',
            });
        }
        // ============ ARRIVAL.LOCATION ============
        if (!arrival.location || typeof arrival.location !== 'string' || arrival.location.trim() === '') {
            errors.push({
                field: 'arrival.location',
                message: 'arrival.location is required and must be a non-empty string',
            });
        }
    }
    // ============ DEPARTURE.DATE ============
    if (!data.departure || typeof data.departure !== 'object') {
        errors.push({ field: 'departure', message: 'departure is required and must be an object' });
    }
    else {
        const departure = data.departure;
        if (departure.date === undefined || departure.date === null) {
            errors.push({ field: 'departure.date', message: 'departure.date is required' });
        }
        else if (!isValidISODate(departure.date)) {
            errors.push({
                field: 'departure.date',
                message: 'departure.date must be in YYYY-MM-DD format (e.g., 2026-04-20)',
            });
        }
        // ============ DEPARTURE.LOCATION ============
        if (!departure.location || typeof departure.location !== 'string' || departure.location.trim() === '') {
            errors.push({
                field: 'departure.location',
                message: 'departure.location is required and must be a non-empty string',
            });
        }
    }
    // ============ DATE ORDERING (only if both dates are valid) ============
    if (data.arrival &&
        typeof data.arrival === 'object' &&
        isValidISODate(data.arrival.date) &&
        data.departure &&
        typeof data.departure === 'object' &&
        isValidISODate(data.departure.date)) {
        const arrivalDate = data.arrival.date;
        const departureDate = data.departure.date;
        if (!isDateBefore(arrivalDate, departureDate)) {
            errors.push({
                field: 'dates',
                message: 'departure.date must be after arrival.date',
            });
        }
    }
    // ============ DESIRED ATTRACTIONS ============
    if (data.desiredAttractions === undefined || data.desiredAttractions === null) {
        errors.push({
            field: 'desiredAttractions',
            message: 'desiredAttractions is required and must be an array',
        });
    }
    else if (!Array.isArray(data.desiredAttractions)) {
        errors.push({
            field: 'desiredAttractions',
            message: 'desiredAttractions must be an array',
        });
    }
    else if (!data.desiredAttractions.every((item) => typeof item === 'string')) {
        errors.push({
            field: 'desiredAttractions',
            message: 'all items in desiredAttractions must be strings',
        });
    }
    // ============ OPTIONAL: STOPS ============
    if (data.stops !== undefined && data.stops !== null && !Array.isArray(data.stops)) {
        errors.push({
            field: 'stops',
            message: 'stops must be an array if provided',
        });
    }
    else if (Array.isArray(data.stops) && !data.stops.every((item) => typeof item === 'string')) {
        errors.push({
            field: 'stops',
            message: 'all items in stops must be strings',
        });
    }
    // ============ OPTIONAL: TRAVEL PACE ============
    if (data.travelPace !== undefined && data.travelPace !== null) {
        const validPaces = ['relaxed', 'moderate', 'active'];
        if (typeof data.travelPace !== 'string' || !validPaces.includes(data.travelPace)) {
            errors.push({
                field: 'travelPace',
                message: `travelPace must be one of: ${validPaces.join(', ')}`,
            });
        }
    }
    // ============ OPTIONAL: INTERESTS ============
    if (data.interests !== undefined && data.interests !== null && !Array.isArray(data.interests)) {
        errors.push({
            field: 'interests',
            message: 'interests must be an array if provided',
        });
    }
    else if (Array.isArray(data.interests) && !data.interests.every((item) => typeof item === 'string')) {
        errors.push({
            field: 'interests',
            message: 'all items in interests must be strings',
        });
    }
    // ============ OPTIONAL: BUDGET ============
    if (data.budget !== undefined && data.budget !== null) {
        const validBudgets = ['budget', 'mid-range', 'luxury'];
        if (typeof data.budget !== 'string' || !validBudgets.includes(data.budget)) {
            errors.push({
                field: 'budget',
                message: `budget must be one of: ${validBudgets.join(', ')}`,
            });
        }
    }
    // ============ OPTIONAL: NOTES ============
    if (data.notes !== undefined && data.notes !== null && typeof data.notes !== 'string') {
        errors.push({
            field: 'notes',
            message: 'notes must be a string if provided',
        });
    }
    // ============ OPTIONAL: USER FIRST NAME ============
    if (data.userFirstName !== undefined && data.userFirstName !== null && typeof data.userFirstName !== 'string') {
        errors.push({
            field: 'userFirstName',
            message: 'userFirstName must be a string if provided',
        });
    }
    // ============ OPTIONAL: USER ID ============
    if (data.userId !== undefined && data.userId !== null && typeof data.userId !== 'string') {
        errors.push({
            field: 'userId',
            message: 'userId must be a string if provided',
        });
    }
    if (errors.length > 0) {
        return { valid: false, errors };
    }
    return { valid: true, errors: [] };
}
/**
 * Normalize a validated TripInput:
 * - Trim all string fields
 * - Remove empty strings from arrays
 * - Apply sensible defaults
 * - Ensure arrays are non-empty (or undefined)
 */
export function normalizeTripInput(input) {
    // Helper: trim and filter arrays, return undefined if empty
    const cleanArray = (arr) => {
        if (!arr || arr.length === 0)
            return undefined;
        const trimmed = arr.map((item) => item.trim()).filter(Boolean);
        return trimmed.length > 0 ? trimmed : undefined;
    };
    // Helper: trim string or return undefined if empty
    const cleanString = (str) => {
        if (!str)
            return undefined;
        const trimmed = str.trim();
        return trimmed !== '' ? trimmed : undefined;
    };
    return {
        userId: cleanString(input.userId),
        userFirstName: cleanString(input.userFirstName),
        arrival: {
            date: input.arrival.date.trim(),
            location: input.arrival.location.trim(),
        },
        departure: {
            date: input.departure.date.trim(),
            location: input.departure.location.trim(),
        },
        stops: cleanArray(input.stops),
        desiredAttractions: input.desiredAttractions
            .map((a) => a.trim())
            .filter(Boolean),
        travelPace: input.travelPace || 'moderate',
        interests: cleanArray(input.interests),
        budget: input.budget || undefined,
        notes: cleanString(input.notes),
    };
}
