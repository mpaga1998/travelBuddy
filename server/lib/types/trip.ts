export interface TripInput {
  userId?: string;
  userFirstName?: string;
  arrival: {
    date: string; // ISO 8601: YYYY-MM-DD
    location: string;
  };
  departure: {
    date: string; // ISO 8601: YYYY-MM-DD
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
  businessIssues?: Array<{ rule: string; message: string; severity: 'error' | 'warning' }>;
}
