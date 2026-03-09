/**
 * Trip planning types
 */

export interface TripInput {
  userId?: string;
  userFirstName?: string;
  arrival: {
    date: string; // ISO format: YYYY-MM-DD
    location: string;
  };
  departure: {
    date: string; // ISO format: YYYY-MM-DD
    location: string;
  };
  stops?: string[];
  desiredAttractions: string[];
  travelPace?: 'relaxed' | 'moderate' | 'active';
  interests?: string[];
  budget?: 'budget' | 'mid-range' | 'luxury';
  notes?: string;
}

export interface ItineraryResponse {
  success: boolean;
  itinerary: string;
  error?: string;
}

/**
 * Normalized version of TripInput (guaranteed to have valid, clean data)
 */
export interface NormalizedTripInput extends TripInput {
  desiredAttractions: string[]; // Always an array (may be empty)
  stops?: string[]; // Cleaned, no empty strings
  travelPace: 'relaxed' | 'moderate' | 'active'; // Always has a value
  interests?: string[]; // Cleaned array if provided
  notes?: string; // Trimmed if provided
  userId?: string; // Trimmed if provided
  userFirstName?: string; // Trimmed if provided
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Result of validation + normalization
 */
export type ValidationResult = 
  | { valid: true; data: NormalizedTripInput }
  | { valid: false; errors: ValidationError[] };
