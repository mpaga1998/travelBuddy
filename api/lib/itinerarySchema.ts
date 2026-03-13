/**
 * Day-based itinerary schema - activities have explicit locations
 * Travel is a first-class activity, not implicit between stops
 */

export interface ItineraryActivity {
  time: 'morning' | 'afternoon' | 'night';
  location: string; // REQUIRED: explicit location for each activity
  venueName?: string; // Specific venue/attraction name (e.g., "Duomo di Milano")
  coordinates?: [number, number]; // [latitude, longitude] for precise Maps links
  description: string;
  durationEstimate: string; // "2 hours", "30 mins", etc.
  isTravel?: boolean; // Mark travel activities
  travelMode?: string; // "train", "bus", "flight" for travel activities
  costEstimate?: string; // Cost for travel
}

export interface ItineraryConstraints {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  arrivalLocation: string;
  departureLocation: string;
  nightsAvailable: number;
  nightsAllocated: number;
}

export interface ItineraryDay {
  dayNumber: number;
  activities: ItineraryActivity[];
  sleep?: {
    location: string; // Where you sleep after this day
  };
}

export interface StructuredItinerary {
  feasible: boolean;
  feasibilityNotes?: string; // Explains constraints, warnings, or why infeasible
  days: ItineraryDay[];
  constraints: ItineraryConstraints;
}

// ============== Legacy stop-based schema (for fallback) ==============
export interface TransportDetails {
  mode: string; // "train", "bus", "flight", "walking", etc.
  duration: string; // "3 hours", "4.5 hours"
  costEstimate: string; // "$50-100", "~800 som", etc.
}

export interface LegacyItineraryActivity {
  time: 'morning' | 'afternoon' | 'night';
  description: string;
  durationEstimate: string; // "2 hours", "30 mins", etc.
}

export interface LegacyDay {
  dayNumber: number;
  location: string;
  activities: LegacyItineraryActivity[];
  nights: number;
}

export interface ItineraryStop {
  location: string;
  totalNights: number;
  transportFromPrevious?: TransportDetails;
  days: LegacyDay[];
}

export interface StopBasedItinerary {
  feasible: boolean;
  feasibilityNotes?: string;
  stops: ItineraryStop[];
  constraints: ItineraryConstraints;
}
