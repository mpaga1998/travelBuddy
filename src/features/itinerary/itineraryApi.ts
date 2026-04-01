import type { ItineraryInput, ItineraryResponse } from './types';

// Use relative path for Vercel, fallback to localhost for local dev
const API_BASE = import.meta.env.VITE_API_BASE_URL || (() => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3000/api';
  }
  return '/api';
})();

export async function generateItinerary(input: ItineraryInput): Promise<string> {
  console.log('🔗 Fetching from:', `${API_BASE}/itinerary`);
  
  try {
    const response = await fetch(`${API_BASE}/itinerary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('❌ API error:', error);
      throw new Error(error.message || error.error || `Failed to generate itinerary: ${response.statusText}`);
    }

    const data: ItineraryResponse = await response.json();
    
    if (!data.success) {
      console.error('❌ Generation failed:', data.error);
      throw new Error(data.error || 'Unknown error');
    }

    return data.itinerary;
  } catch (err) {
    console.error('❌ Fetch error:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to fetch itinerary');
  }
}

export async function saveItineraryToProfile(
  userId: string,
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
  console.log('💾 Saving itinerary to profile:', { userId, title });
  console.log('📦 Payload:', {
    userId: userId ? '✅' : '❌',
    title: title ? '✅' : '❌',
    markdown: markdown ? `✅ (${markdown.length} chars)` : '❌',
    params,
  });

  try {
    const payload = {
      userId,
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

    console.log('🔗 Fetching from:', `${API_BASE}/itinerary/save`);
    console.log('📨 Sending payload:', JSON.stringify(payload, null, 2).substring(0, 200) + '...');

    const response = await fetch(`${API_BASE}/itinerary/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('📡 Save response status:', response.status);

    const responseData = await response.json();
    console.log('📦 Save response data:', responseData);

    if (!response.ok) {
      const error = responseData;
      console.error('❌ Save API error:', error);
      throw new Error(error.error || `Failed to save itinerary: ${response.statusText}`);
    }

    if (!responseData.success) {
      console.error('❌ Save failed:', responseData.error);
      throw new Error(responseData.error || 'Unknown error');
    }

    console.log('✅ Itinerary saved:', responseData.itineraryId);
    return responseData;
  } catch (err) {
    console.error('❌ Save fetch error:', err);
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to save itinerary');
  }
}
