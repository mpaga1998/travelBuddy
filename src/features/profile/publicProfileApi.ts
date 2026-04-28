import { supabase } from '../../lib/supabaseClient';
import { calculateAge } from './profileApi';

/**
 * 5.1: Reads for public profile pages at /u/:handle.
 *
 * Everything here uses the anon Supabase client and relies on the existing
 * RLS posture:
 *   - profiles: profiles_select_public allows everyone to SELECT (set in
 *     20260425_profiles_public_select.sql)
 *   - pins:     publicly readable, filtered to is_hidden = false
 *   - itineraries: itineraries_select_own_or_public — non-owners only see
 *     is_public = true rows (set in 20260428_add_public_profile_fields.sql)
 *
 * No new server routes needed; this is all read-side.
 */

// ─── Public profile shape ─────────────────────────────────────────────────

export interface PublicProfile {
  id: string;
  handle: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  role: 'traveler' | 'hostel';
  hostelName: string | null;
  countryCode: string | null;
  age: number | null;
  // 5.2: cached follow counts. Maintained by triggers on the follows table —
  // never compute these client-side, just read them.
  followersCount: number;
  followingCount: number;
  /** ISO date the user joined (profile created_at). Null if column missing. */
  createdAt: string | null;
}

interface DbProfileRow {
  id: string;
  handle: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  role: 'traveler' | 'hostel' | null;
  hostel_name: string | null;
  country_code: string | null;
  dob: string | null;
  followers_count: number | null;
  following_count: number | null;
}

function mapProfileRow(row: DbProfileRow): PublicProfile {
  return {
    id: row.id,
    handle: row.handle ?? '',
    username: row.username ?? 'Traveler',
    bio: row.bio,
    avatarUrl: row.avatar_url,
    role: row.role ?? 'traveler',
    hostelName: row.hostel_name,
    countryCode: row.country_code,
    age: row.dob ? calculateAge(row.dob) : null,
    followersCount: row.followers_count ?? 0,
    followingCount: row.following_count ?? 0,
    createdAt: null,
  };
}

/**
 * Fetch a public profile by its @handle. Returns null when no profile
 * matches — the page renders a "Not found" state in that case.
 *
 * Handles are stored lowercase (DB CHECK enforces it), so we lowercase the
 * input here too. URL parsing is forgiving about case.
 */
export async function fetchPublicProfileByHandle(
  handle: string
): Promise<PublicProfile | null> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, handle, username, bio, avatar_url, role, hostel_name, country_code, dob, followers_count, following_count'
    )
    .eq('handle', normalized)
    .maybeSingle();

  if (error) {
    console.warn('[publicProfile] lookup failed:', error.message);
    return null;
  }
  if (!data) return null;

  return mapProfileRow(data as DbProfileRow);
}

// ─── Public pins (already-public — pins are world-readable when not hidden) ─

export interface PublicPin {
  id: string;
  title: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  imageUrls: string[];
  bookmarkCount: number;
  createdAt: string;
}

interface DbPublicPinRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  lat: number;
  lng: number;
  image_urls: string[] | null;
  bookmark_count: number | null;
  created_at: string;
}

export async function fetchPublicPinsByUserId(
  userId: string,
  limit = 50
): Promise<PublicPin[]> {
  const { data, error } = await supabase
    .from('pins')
    .select('id, title, description, category, lat, lng, image_urls, bookmark_count, created_at')
    .eq('created_by', userId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[publicProfile] pins lookup failed:', error.message);
    return [];
  }

  return ((data ?? []) as DbPublicPinRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    category: row.category,
    lat: row.lat,
    lng: row.lng,
    imageUrls: row.image_urls ?? [],
    bookmarkCount: row.bookmark_count ?? 0,
    createdAt: row.created_at,
  }));
}

// ─── Public itineraries (only is_public = true visible to non-owners) ─────

export interface PublicItinerary {
  id: string;
  title: string;
  arrivalLocation: string | null;
  departureLocation: string | null;
  startDate: string | null;
  endDate: string | null;
  travelPace: string | null;
  budget: string | null;
  interests: string[];
  /** Full markdown body. Optional in some surfaces (list pages may not need it). */
  markdownContent?: string;
  createdAt: string;
}

interface DbPublicItineraryRow {
  id: string;
  title: string;
  arrival_location: string | null;
  departure_location: string | null;
  start_date: string | null;
  end_date: string | null;
  travel_pace: string | null;
  budget: string | null;
  interests: string[] | null;
  markdown_content: string | null;
  created_at: string;
}

/**
 * Fetch the user's public itineraries. RLS is the actual gate — when the
 * caller is the owner, all itineraries come back; for everyone else, only
 * is_public = true rows do. We still pass `.eq('is_public', true)` as a
 * defense-in-depth filter so the public profile never accidentally renders
 * the owner's private itineraries when the owner views their own page.
 */
export async function fetchPublicItinerariesByUserId(
  userId: string,
  limit = 30
): Promise<PublicItinerary[]> {
  const { data, error } = await supabase
    .from('itineraries')
    .select(
      'id, title, arrival_location, departure_location, start_date, end_date, travel_pace, budget, interests, markdown_content, created_at'
    )
    .eq('user_id', userId)
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[publicProfile] itineraries lookup failed:', error.message);
    return [];
  }

  return ((data ?? []) as DbPublicItineraryRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    arrivalLocation: row.arrival_location,
    departureLocation: row.departure_location,
    startDate: row.start_date,
    endDate: row.end_date,
    travelPace: row.travel_pace,
    budget: row.budget,
    interests: row.interests ?? [],
    markdownContent: row.markdown_content ?? undefined,
    createdAt: row.created_at,
  }));
}

// ─── Mutations: handle uniqueness check + itinerary public toggle ─────────

/**
 * Check whether a handle is available for the calling user. Returns true if
 * the handle is unused OR already belongs to the calling user (so saving
 * your existing handle isn't reported as "taken").
 *
 * NOTE: this is advisory — the DB unique index is the actual source of
 * truth. Race conditions between this check and the UPDATE are handled by
 * the unique-violation surface in updateMyProfile.
 */
export async function isHandleAvailable(handle: string): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id ?? null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', handle)
    .maybeSingle();

  if (error) {
    console.warn('[publicProfile] handle availability check failed:', error.message);
    return false;
  }
  if (!data) return true;
  return data.id === myUserId;
}

/** Flip an itinerary's public visibility. Owner-only via RLS UPDATE policy. */
export async function setItineraryPublic(
  itineraryId: string,
  isPublic: boolean
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('itineraries')
    .update({ is_public: isPublic, updated_at: new Date().toISOString() })
    .eq('id', itineraryId)
    .eq('user_id', userId);

  if (error) throw error;
}
