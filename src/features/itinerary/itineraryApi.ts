import type { ItineraryInput, ItineraryResponse } from './types';
import { supabase } from '../../lib/supabaseClient';

// Single deploy target is Vercel - frontend always talks to /api, relative.
// VITE_API_BASE_URL can override for staging/preview setups that point elsewhere.
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Pull the current Supabase JWT for the signed-in user.
 * Throws if the user is not signed in - callers should surface that to the UI.
 */
async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Failed to read Supabase session:', error.message);
    throw new Error('Could not read your session. Please sign in again.');
  }
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('You need to be signed in to do that.');
  }
  return token;
}

export async function generateItinerary(input: ItineraryInput): Promise<string> {
  console.log('Fetching from:', `${API_BASE}/itinerary`);

  try {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE}/itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('API error:', error);
      throw new Error(error.message || error.error || `Failed to generate itinerary: ${response.statusText}`);
    }

    const data: ItineraryResponse = await response.json();

    if (!data.success) {
      console.error('Generation failed:', data.error);
      throw new Error(data.error || 'Unknown error');
    }

    return data.itinerary;
  } catch (err) {
    console.error('Fetch error:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to fetch itinerary');
  }
}

export async function saveItineraryToProfile(
  _userId: string, // deprecated - kept to avoid breaking callers; server uses JWT
  title: string,
  markdown: string,
  params: {
    arrivalLocation: string;
    departureLocation: string;
    startDate: string;
    endDate: string;
    travelPace?: string;
    budget?: string;
    interests?: string[];
  }
): Promise<{ success: boolean; itineraryId: string; message: string }> {
  console.log('Saving itinerary to profile:', { title });

  try {
    const token = await getAccessToken();

    // NB: userId intentionally NOT sent - server uses the verified JWT as the
    // only source of truth for ownership.
    const payload = {
      title,
      markdown,
      arrivalLocation: params.arrivalLocation,
      departureLocation: params.departureLocation,
      startDate: params.startDate,
      endDate: params.endDate,
      travelPace: params.travelPace,
      budget: params.budget,
      interests: params.interests || [],
    };

    console.log('Fetching from:', `${API_BASE}/itinerary/save`);

    const response = await fetch(`${API_BASE}/itinerary/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('Save response status:', response.status);

    const responseData = await response.json();
    console.log('Save response data:', responseData);

    if (!response.ok) {
      console.error('Save API error:', responseData);
      throw new Error(responseData.error || `Failed to save itinerary: ${response.statusText}`);
    }

    if (!responseData.success) {
      console.error('Save failed:', responseData.error);
      throw new Error(responseData.error || 'Unknown error');
    }

    console.log('Itinerary saved:', responseData.itineraryId);
    return responseData;
  } catch (err) {
    console.error('Save fetch error:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to save itinerary');
  }
}
