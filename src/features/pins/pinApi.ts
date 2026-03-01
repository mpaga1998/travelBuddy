import type { Pin, PinCategory } from "./pinTypes";
import { supabase } from "../../lib/supabaseClient";

type DbPinRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  lat: number;
  lng: number;
  created_at: string;
  tips?: string[],
  image_urls?: string[],
  profiles: {
    id: string;
    username: string | null;
    role: "traveler" | "hostel";
    hostel_name: string | null;
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

export async function listPins(): Promise<Pin[]> {
  const { data, error } = await supabase
    .from("pins")
    .select(
      `
      id, title, description, category, lat, lng, created_at,
      tips, image_urls,
      profiles:created_by (id, username, role, hostel_name),
      reaction_counts:pin_reaction_counts (likes_count, dislikes_count)
    `
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as DbPinRow[];

  return rows.map((row) => {
    const counts = row.reaction_counts?.[0] ?? null;

    return {
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      category: safeCategory(row.category),
      lat: row.lat,
      lng: row.lng,
      createdAt: row.created_at,
      tips: row.tips ?? [],
      imageUrls: row.image_urls ?? [],
      createdByType: row.profiles?.role ?? "traveler",
      createdByLabel:
        row.profiles?.role === "hostel"
          ? row.profiles?.hostel_name ?? "Hostel"
          : row.profiles?.username ?? "Traveler",

      // ✅ now works
      likesCount: counts?.likes_count ?? 0,
      dislikesCount: counts?.dislikes_count ?? 0,
    };
  });
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