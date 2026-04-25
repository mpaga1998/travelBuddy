-- Public-readable SELECT policy for profiles.
--
-- Why this exists
-- ---------------
-- pinApi.ts (and api/lib/communityPins.ts) embed
--   profiles!created_by(username, role, hostel_name, dob)
-- on top of the `pins` table to attribute pins to their authors and to filter
-- by creator role (traveler vs hostel). PostgREST applies RLS to the joined
-- table just like a normal SELECT — so when the only profiles SELECT policy
-- was `profiles_select_own (auth.uid() = id)`, the !inner-style join silently
-- dropped every pin authored by someone else. From the client's perspective:
-- "the map only shows the 1 pin I created myself."
--
-- Profiles only contain non-sensitive display info (username, role, hostel_name)
-- plus dob, which is currently selected so the client can compute creator age
-- for the age-range filter chips. Nothing here is more private than what
-- public traveler profiles in any community app expose.
--
-- Long-term: replace this permissive policy with a `public_profiles` view
-- that exposes only (id, username, role, hostel_name, age) and joins through
-- the view instead of the base table. Until then, this policy is required
-- for the pin map to function for any user other than the pin's own author.
--
-- See memory: project_profiles_rls_inner_join_gotcha.md

create policy "profiles_select_public"
  on public.profiles
  for select
  using (true);
