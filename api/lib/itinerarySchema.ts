/**
 * Structured itinerary schema - defines the contract between planning and rendering
 * NEW: Day-based architecture where travel is an activity, not implicit
 */

export interface ItineraryActivity {
  time: 'morning' | 'afternoon' | 'evening';
  location: string; // Explicit location for each activity (required)
  description: string;
  durationEstimate: string; // "2 hours", "30 mins", etc.
  isTravel?: boolean; // Mark travel activities
  travelMode?: string; // "train", "bus", "flight" for travel activities
  costEstimate?: string; // Cost if travel
}

export interface ItinerarySleepInfo {
  location: string;
  night: number; // Which night (1st, 2nd, 3rd sleep)
}

export interface ItineraryDay {
  dayNumber: number;
  activities: ItineraryActivity[];
  sleep?: ItinerarySleepInfo; // Where you sleep after this day (if applicable)
}

export interface ItineraryConstraints {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  arrivalLocation: string;
  departureLocation: string;
  nightsAvailable: number;
  nightsAllocated: number;
}

export interface StructuredItinerary {
  feasible: boolean;
  feasibilityNotes?: string; // Explains constraints, warnings, or why infeasible
  days: ItineraryDay[];
  constraints: ItineraryConstraints;
}
