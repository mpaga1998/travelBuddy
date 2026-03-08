import { supabase } from "../../lib/supabaseClient";

export type Profile = {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  role: "traveler" | "hostel";
  hostel_name: string | null;
  country_code: string | null;
  avatar_url: string | null;
  dob: string | null; // ISO date string
  age: number | null; // Computed from dob
};

/**
 * Calculates age from a date of birth string (ISO format)
 */
export function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  
  const birthDate = new Date(dob);
  const today = new Date();
  
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age >= 0 ? age : null;
}

export async function getMyProfile(): Promise<Profile> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;

  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  // ✅ Use maybeSingle to avoid the “Cannot coerce…” error
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  // ✅ Self-heal: create profile row if missing
  if (!data) {
    const fallbackUsername =
      (user.user_metadata?.username as string | undefined) ??
      user.email?.split("@")[0] ??
      `user_${user.id.slice(0, 8)}`;

    const { error: insErr } = await supabase.from("profiles").insert({
      id: user.id,
      username: fallbackUsername,
      first_name: (user.user_metadata?.first_name as string | undefined) ?? null,
      last_name: (user.user_metadata?.last_name as string | undefined) ?? null,
      role: "traveler",
    });

    if (insErr) throw insErr;

    // re-fetch
    const { data: data2, error: err2 } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (err2) throw err2;
    return data2 as Profile;
  }

  return data as Profile;
}

export async function updateMyProfile(patch: Partial<Profile>): Promise<void> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) throw error;
}

export async function uploadMyAvatar(file: File): Promise<string> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("Not authenticated");

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${user.id}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadErr) throw uploadErr;

  // Public URL (bucket is public for demo)
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = data.publicUrl;

  // Save in profile
  await updateMyProfile({ avatar_url: publicUrl });

  return publicUrl;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function getMyBookmarkedPins(): Promise<any[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("pin_bookmarks")
    .select(`
      pin_id,
      pins (
        id,
        title,
        description,
        category,
        lat,
        lng,
        created_by_label,
        created_by_type,
        created_by_id,
        created_by_age,
        likes_count,
        bookmark_count,
        image_urls
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Flatten the nested structure and map image_urls to images for UI consistency
  return (data || []).map((item: any) => ({
    ...item.pins,
    id: item.pins.id,
    images: item.pins.image_urls || [],
  }));
}