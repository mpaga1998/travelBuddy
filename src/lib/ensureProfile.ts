import { supabase } from "./supabaseClient";

export async function ensureProfile() {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userData.user;
  if (!user) throw new Error("No user");

  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, role, hostel_name")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing) return existing;

  const username = user.email ? user.email.split("@")[0] : "user";

  const { data: inserted, error: insErr } = await supabase
    .from("profiles")
    .insert({ id: user.id, username, role: "traveler" })
    .select("id, username, role, hostel_name")
    .single();

  if (insErr) throw insErr;
  return inserted;
}