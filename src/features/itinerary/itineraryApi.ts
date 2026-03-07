import type { ItineraryInput, ItineraryResponse } from './types';

// Use relative path for Vercel, fallback to localhost for local dev
const API_BASE = import.meta.env.VITE_API_BASE_URL || (() => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000/api';
  }
  return '/api';
})();

export async function generateItinerary(input: ItineraryInput): Promise<string> {
  const response = await fetch(`${API_BASE}/itinerary`, {
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
