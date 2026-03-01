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
};

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