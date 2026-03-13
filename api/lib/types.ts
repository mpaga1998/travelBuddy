export interface TripInput {
  userId?: string;
  userFirstName?: string;
  arrival: {
    date: string; // YYYY-MM-DD
    location: string;
    time?: 'morning' | 'afternoon' | 'night'; // Time of arrival
  };
  departure: {
    date: string; // YYYY-MM-DD
    location: string;
    time?: 'morning' | 'afternoon' | 'night'; // Time of departure
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
  warnings?: string[];
  suggestions?: string[];
}
