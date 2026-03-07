import type { ItineraryInput, ItineraryResponse } from './types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export async function generateItinerary(input: ItineraryInput): Promise<string> {
  const response = await fetch(`${API_BASE}/itinerary/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `Failed to generate itinerary: ${response.statusText}`);
  }

  const data: ItineraryResponse = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Unknown error');
  }

  return data.itinerary;
}
