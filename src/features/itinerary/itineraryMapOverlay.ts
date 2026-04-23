/**
 * Client-side types and helpers for the itinerary map overlay.
 *
 * Types mirror the server-side ExtractedPlace / PlaceType from
 * api/lib/extractPlaces.ts — duplicated here so there is no shared
 * dependency between the /api server bundle and the /src client bundle.
 */

import { supabase } from '../../lib/supabaseClient';
import type { PinCategory } from '../pins/pinTypes';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ---------------------------------------------------------------------------
// Shared types (mirrored from api/lib/extractPlaces.ts)
// ---------------------------------------------------------------------------

export type PlaceType =
  | 'food'
  | 'sight'
  | 'nightlife'
  | 'shop'
  | 'transport'
  | 'accommodation';

export interface ExtractedPlace {
  name: string;
  day: number;
  type: PlaceType;
  context: string;
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Day color palette (up to 5 distinct colours; day 6+ reuse the last)
// ---------------------------------------------------------------------------

const DAY_COLORS: Record<number, string> = {
  1: '#FBBF24', // amber
  2: '#14B8A6', // teal
  3: '#F87171', // coral
  4: '#818CF8', // indigo
  5: '#34D399', // emerald
};

export function dayColor(day: number): string {
  return DAY_COLORS[Math.min(day, 5)] ?? DAY_COLORS[5];
}

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export const PLACE_TYPE_EMOJI: Record<PlaceType, string> = {
  food: '🍽',
  sight: '🏛',
  nightlife: '🍸',
  shop: '🛍',
  transport: '🚉',
  accommodation: '🏨',
};

/** Map server-side PlaceType to the client PinCategory. */
export function placeTypeToCategory(type: PlaceType): PinCategory {
  switch (type) {
    case 'food': return 'food';
    case 'nightlife': return 'nightlife';
    case 'sight': return 'sight';
    case 'shop': return 'shop';
    default: return 'other';
  }
}

// ---------------------------------------------------------------------------
// API call — POST /api/itinerary/extract
// ---------------------------------------------------------------------------

/**
 * Send the itinerary markdown to the server for place extraction + geocoding.
 * Returns an array of geocoded places ready for the map overlay.
 * Throws on network or server error; caller should surface to the UI.
 */
export async function extractItineraryPlaces(
  markdown: string,
  arrivalLocation: string,
  itineraryId?: string,
): Promise<ExtractedPlace[]> {
  console.info('[ITINERARY-MAP] extractItineraryPlaces called', {
    markdownLength: markdown.length,
    markdownPreview: markdown.slice(0, 500),
    arrivalLocation,
    itineraryId: itineraryId ?? null,
  });

  const { data, error: sessionError } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (sessionError || !token) throw new Error('Not signed in');

  const body: Record<string, string> = { markdown, arrivalLocation };
  if (itineraryId) body.itineraryId = itineraryId;

  const response = await fetch(`${API_BASE}/itinerary/extract`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to extract places');
  }

  const json = await response.json() as { places?: ExtractedPlace[] };
  const places = json.places ?? [];

  console.info('[ITINERARY-MAP] server returned places', {
    count: places.length,
    places: places.map((p) => ({
      name: p.name,
      day: p.day,
      type: p.type,
      context: p.context?.slice(0, 100) ?? '',
      serverLat: p.lat,
      serverLng: p.lng,
    })),
  });

  return places;
}
