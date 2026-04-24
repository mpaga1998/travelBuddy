import type { Pin, PinCategory } from "./pinTypes";
import { supabase } from "../../lib/supabaseClient";
import { calculateAge } from "../profile/profileApi";

type DbPinRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  lat: number;
  lng: number;
  created_at: string;
  created_by: string; // Add this field
  bookmark_count: number;
  tips?: string[],
  image_urls?: string[],
  profiles: {
    id: string;
    username: string | null;
    role: "traveler" | "hostel";
    hostel_name: string | null;
    dob: string | null;
  } | null;

  // ✅ IMPORTANT: Supabase returns joined relations as arrays
  reaction_counts:
    | {
        likes_count: number | null;
        dislikes_count: number | null;
      }[]
    | null;
};

const ALLOWED_CATEGORIES: PinCategory[] = [
  "food",
  "nightlife",
  "sight",
  "shop",
  "beach",
  "other",
];

function safeCategory(raw: string): PinCategory {
  return ALLOWED_CATEGORIES.includes(raw as PinCategory) ? (raw as PinCategory) : "other";
}

export type PinBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};

export type PinFilters = {
  bounds?: PinBounds;
  /** Filter to a single category. Omit or pass undefined for all categories. */
  category?: PinCategory;
  /**
   * Filter by creator type (traveler | hostel). Omit for both.
   * Implemented via profiles.role with an INNER join so the parent row is
   * excluded when the profile doesn't match — safe because every pin requires
   * an authenticated user who has a profile row.
   */
  creatorType?: "traveler" | "hostel";
  // NOTE: ageRanges is intentionally absent. Age is computed from profiles.dob
  // in the mapping layer — there is no created_by_age column in the database.
  // Age filtering stays in the client-side useMemo inside useMapPins.
};

// Base SELECT for queries without a creatorType filter (LEFT JOIN on profiles
// so pins with no profile are still returned — defensive).
const SELECT_DEFAULT = `
  id, title, description, category, lat, lng, created_at, created_by, bookmark_count,
  tips, image_urls,
  profiles:created_by (id, username, role, hostel_name, dob),
  reaction_counts:pin_reaction_counts (likes_count, dislikes_count)
`;

// When filtering by role we need an INNER JOIN so PostgREST uses the
// profiles.role filter to exclude parent rows, not just the embedded result.
const SELECT_INNER = `
  id, title, description, category, lat, lng, created_at, created_by, bookmark_count,
  tips, image_urls,
  profiles:created_by!inner (id, username, role, hostel_name, dob),
  reaction_counts:pin_reaction_counts (likes_count, dislikes_count)
`;

export async function listPins(opts: PinFilters = {}): Promise<{ pins: Pin[]; limitReached: boolean }> {
  const { bounds, category, creatorType } = opts;

  let query = supabase
    .from("pins")
    .select(creatorType ? SELECT_INNER : SELECT_DEFAULT)
    .order("created_at", { ascending: false })
    .limit(500);

  if (bounds) {
    query = query
      .gte("lat", bounds.south)
      .lte("lat", bounds.north)
      .gte("lng", bounds.west)
      .lte("lng", bounds.east);
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (creatorType) {
    query = query.eq("profiles.role", creatorType);
  }

  const { data, error } = await query;

  if (error) throw error;

  const rows = (data ?? []) as unknown as DbPinRow[];
  const limitReached = rows.length === 500;

  const mapped = rows.map((row) => {
    const counts = row.reaction_counts?.[0] ?? null;

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      category: safeCategory(row.category),
      lat: row.lat,
      lng: row.lng,
      createdAt: row.created_at,
      createdById: row.created_by,
      tips: row.tips ?? [],
      imageUrls: row.image_urls ?? [],
      createdByType: row.profiles?.role ?? "traveler",
      createdByLabel:
        row.profiles?.role === "hostel"
          ? row.profiles?.hostel_name ?? "Hostel"
          : row.profiles?.username ?? "Traveler",
      createdByAge: row.profiles?.dob ? calculateAge(row.profiles.dob) : null,

      // ✅ now works
      likesCount: counts?.likes_count ?? 0,
      dislikesCount: counts?.dislikes_count ?? 0,
      bookmarkCount: row.bookmark_count ?? 0,
    };
  });

  return { pins: mapped, limitReached };
}

export async function uploadPinImage(file: File): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const fileExt = file.name.split(".").pop();
  const filePath = `${user.id}/${Date.now()}.${fileExt}`;

  const { error } = await supabase.storage
    .from("pin-images")
    .upload(filePath, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from("pin-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function createPin(input: {
  title: string;
  description: string;
  category: PinCategory;
  tips?: string[];
  imageUrls?: string[];
  lat: number;
  lng: number;
}): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("pins").insert({
    created_by: user.id,
    title: input.title,
    description: input.description,
    category: input.category,
    tips: input.tips ?? [],
    image_urls: input.imageUrls ?? [],
    lat: input.lat,
    lng: input.lng,
  });

  if (error) {
    console.error("createPin failed:", error);
    throw error;
  }
}

/**
 * ✅ Replaces old toggleLike.
 * Each user can have only 1 reaction per pin (like OR dislike).
 * - click same -> remove
 * - click other -> switch
 */
export async function toggleReaction(pinId: string, kind: "like" | "dislike"): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { data: existing, error: selErr } = await supabase
    .from("pin_reactions")
    .select("kind")
    .eq("pin_id", pinId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  // Same reaction exists => toggle off
  if (existing?.kind === kind) {
    const { error } = await supabase
      .from("pin_reactions")
      .delete()
      .eq("pin_id", pinId)
      .eq("user_id", user.id);
    if (error) throw error;
    return;
  }

  // Otherwise upsert (switch or create)
  const { error } = await supabase.from("pin_reactions").upsert(
    {
      pin_id: pinId,
      user_id: user.id,
      kind,
    },
    { onConflict: "pin_id,user_id" }
  );

  if (error) throw error;
}

export async function deletePin(pinId: string): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("pins")
    .delete()
    .eq("id", pinId)
    .eq("created_by", user.id);

  if (error) throw error;
}

/**
 * Check if current user has bookmarked a pin
 */
export async function isBookmarked(pinId: string): Promise<boolean> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return false;

  const { data, error } = await supabase
    .from("pin_bookmarks")
    .select("id")
    .eq("pin_id", pinId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error checking bookmark:", error);
    return false;
  }

  return !!data;
}

/**
 * Toggle bookmark for current user
 */
export async function toggleBookmark(pinId: string): Promise<boolean> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  // Check if already bookmarked
  const { data: existing, error: checkErr } = await supabase
    .from("pin_bookmarks")
    .select("id")
    .eq("pin_id", pinId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (checkErr) throw checkErr;

  if (existing) {
    // Remove bookmark
    const { error } = await supabase
      .from("pin_bookmarks")
      .delete()
      .eq("pin_id", pinId)
      .eq("user_id", user.id);
    if (error) throw error;
    return false; // Now unbookmarked
  } else {
    // Add bookmark
    const { error } = await supabase
      .from("pin_bookmarks")
      .insert({
        pin_id: pinId,
        user_id: user.id,
      });
    if (error) throw error;
    return true; // Now bookmarked
  }
}