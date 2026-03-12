/**
 * Structured itinerary schema - defines the contract between planning and rendering
 */

export interface ItineraryActivity {
  time: 'morning' | 'afternoon' | 'evening';
  description: string;
  durationEstimate: string; // "2 hours", "30 mins", etc.
}

export interface ItineraryDay {
  dayNumber: number;
  location: string;
  activities: ItineraryActivity[];
  nights: number;
}

export interface TransportDetails {
  mode: string; // "bus", "taxi", "flight", "walking", etc.
  duration: string; // "3 hours", "4.5 hours"
  costEstimate: string; // "$50-100", "~800 som", etc.
}

export interface ItineraryStop {
  location: string;
  totalNights: number;
  transportFromPrevious?: TransportDetails;
  days: ItineraryDay[];
}

export interface ItineraryConstraints {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  nightsAvailable: number;
  nightsAllocated: number;
}

export interface StructuredItinerary {
  feasible: boolean;
  feasibilityNotes?: string; // Explains constraints, warnings, or why infeasible
  stops: ItineraryStop[];
  constraints: ItineraryConstraints;
}
