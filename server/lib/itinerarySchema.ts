/**
 * Structured itinerary schema - defines the contract between planning and rendering
 */

export interface ItineraryActivity {
  time: 'morning' | 'afternoon' | 'night';
  description: string;
  durationEstimate: string;
}

export interface ItineraryDay {
  dayNumber: number;
  location: string;
  activities: ItineraryActivity[];
  nights: number;
}

export interface TransportDetails {
  mode: string;
  duration: string;
  costEstimate: string;
}

export interface ItineraryStop {
  location: string;
  totalNights: number;
  transportFromPrevious?: TransportDetails;
  days: ItineraryDay[];
}

export interface ItineraryConstraints {
  startDate: string;
  endDate: string;
  nightsAvailable: number;
  nightsAllocated: number;
}

export interface StructuredItinerary {
  feasible: boolean;
  feasibilityNotes?: string;
  stops: ItineraryStop[];
  constraints: ItineraryConstraints;
}
