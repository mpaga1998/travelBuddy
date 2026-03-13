/**
 * Structured itinerary schema - supports both day-based and stop-based architectures
 */

// ============== DAY-BASED ARCHITECTURE (Primary) ==============
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

// ============== STOP-BASED ARCHITECTURE (Legacy Fallback) ==============
export interface TransportDetails {
  mode: string; // "train", "bus", "flight", "car"
  duration: string; // "2 hours", "1.5 hours"
  costEstimate: string; // "$50-100", "€30-50"
}

export interface LegacyDay {
  dayNumber: number;
  location: string;
  nights: number; // Nights spent after this day
  activities: Array<{
    time: 'morning' | 'afternoon' | 'evening';
    description: string;
    durationEstimate?: string;
  }>;
}

export interface ItineraryStop {
  location: string;
  totalNights: number;
  days: LegacyDay[];
  transportFromPrevious?: TransportDetails;
}

export interface StopBasedItinerary {
  feasible: boolean;
  feasibilityNotes?: string;
  stops: ItineraryStop[];
  constraints: ItineraryConstraints;
}
