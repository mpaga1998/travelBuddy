import { supabase } from '../../lib/supabaseClient';
import type { Pin } from '../pins/pinTypes';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SavedPlaceSource =
  | 'manual'
  | 'tiktok'
  | 'pinterest'
  | 'instagram'
  | 'community_pin'
  | 'itinerary';

export interface SavedPlace {
  id: string;
  userId: string;
  pinId?: string | null;
  title: string;
  note?: string | null;
  category?: string | null;
  lat: number;
  lng: number;
  city?: string | null;
  country?: string | null;
  source: SavedPlaceSource;
  sourceUrl?: string | null;
  sourceAuthor?: string | null;
  visited: boolean;
  createdAt: string;
}

export interface AddSavedPlaceInput {
  title: string;
  lat: number;
  lng: number;
  category?: string;
  note?: string;
  city?: string;
  country?: string;
  source: SavedPlaceSource;
  sourceUrl?: string;
  sourceAuthor?: string;
  pinId?: string;
}

// ── Internal row type ─────────────────────────────────────────────────────────

type DbRow = {
  id: string;
  user_id: string;
  pin_id: string | null;
  title: string;
  note: string | null;
  category: string | null;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  source: string;
  source_url: string | null;
  source_author: string | null;
  visited: boolean;
  created_at: string;
};

function toSavedPlace(row: DbRow): SavedPlace {
  return {
    id: row.id,
    userId: row.user_id,
    pinId: row.pin_id,
    title: row.title,
    note: row.note,
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    city: row.city,
    country: row.country,
    source: row.source as SavedPlaceSource,
    sourceUrl: row.source_url,
    sourceAuthor: row.source_author,
    visited: row.visited,
    createdAt: row.created_at,
  };
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function listSavedPlaces(opts?: { visited?: boolean }): Promise<SavedPlace[]> {
  let query = supabase
    .from('saved_places')
    .select('*')
    .order('created_at', { ascending: false });

  if (opts?.visited !== undefined) {
    query = query.eq('visited', opts.visited);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as DbRow[]).map(toSavedPlace);
}

/**
 * Returns the number of saved places for the current user. Returns 0 for
 * unauthenticated callers and on any failure — defensive, same pattern as
 * notificationsApi.countUnread (we'd rather hide a stale badge than show a
 * wrong count).
 */
export async function countSavedPlaces(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return 0;

  const { count, error } = await supabase
    .from('saved_places')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.warn('[savedPlaces] count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

export async function addSavedPlace(input: AddSavedPlaceInput): Promise<SavedPlace> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('saved_places')
    .insert({
      user_id: user.id,
      pin_id: input.pinId ?? null,
      title: input.title,
      note: input.note ?? null,
      category: input.category ?? null,
      lat: input.lat,
      lng: input.lng,
      city: input.city ?? null,
      country: input.country ?? null,
      source: input.source,
      source_url: input.sourceUrl ?? null,
      source_author: input.sourceAuthor ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return toSavedPlace(data as DbRow);
}

export async function updateSavedPlace(
  id: string,
  patch: { title?: string; note?: string; visited?: boolean; category?: string }
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.note !== undefined) dbPatch.note = patch.note;
  if (patch.visited !== undefined) dbPatch.visited = patch.visited;
  if (patch.category !== undefined) dbPatch.category = patch.category;

  const { error } = await supabase.from('saved_places').update(dbPatch).eq('id', id);
  if (error) throw error;
}

export async function deleteSavedPlace(id: string): Promise<void> {
  const { error } = await supabase.from('saved_places').delete().eq('id', id);
  if (error) throw error;
}

/** Shortcut: save a public community pin to the user's personal map. */
export async function saveCommunityPin(pin: Pin): Promise<SavedPlace> {
  return addSavedPlace({
    title: pin.title,
    lat: pin.lat,
    lng: pin.lng,
    category: pin.category,
    source: 'community_pin',
    pinId: pin.id,
  });
}
