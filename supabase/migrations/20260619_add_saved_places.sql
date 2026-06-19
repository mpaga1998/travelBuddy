-- C1: Personal "want-to-visit" map
-- Owner-private table. Separate from pin_bookmarks (which tracks the public
-- community save-count). This table also holds private/external places
-- (social imports, manual drops) that aren't in the public pins table.

create table if not exists public.saved_places (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  pin_id        uuid null references public.pins(id) on delete set null,
  title         text not null,
  note          text null,
  category      text null,
  lat           double precision not null,
  lng           double precision not null,
  city          text null,
  country       text null,
  source        text not null check (
                  source in ('manual','tiktok','pinterest','instagram','community_pin','itinerary')
                ),
  source_url    text null,
  source_author text null,
  visited       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Indexes
create index if not exists saved_places_user_created_idx
  on public.saved_places (user_id, created_at desc);

create index if not exists saved_places_user_visited_idx
  on public.saved_places (user_id, visited);

create index if not exists saved_places_lat_lng_idx
  on public.saved_places (lat, lng);

-- RLS: owner-only for all operations
alter table public.saved_places enable row level security;

create policy "Users manage their own saved places"
  on public.saved_places
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
