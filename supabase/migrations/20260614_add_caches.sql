-- ============================================================
-- A4.2: Geocoding cache + itinerary cache
-- ============================================================

-- Geocoding cache — cross-user, 90-day TTL for cleanup.
-- Coords for a given place name are stable; no need to re-fetch.
CREATE TABLE geocode_cache (
  place_key   TEXT        PRIMARY KEY,        -- lower(trim(location string))
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX geocode_cache_created_at_idx ON geocode_cache (created_at);

ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;
-- Only the service-role key (server-side API) can read/write this table.
CREATE POLICY "service_role_only" ON geocode_cache USING (false);


-- Itinerary cache — per-user, 24-hour TTL.
-- Protects against browser refresh and accidental double-submit.
CREATE TABLE itinerary_cache (
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_key    TEXT        NOT NULL,           -- SHA-256 of normalised TripInput
  markdown    TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, trip_key)
);

CREATE INDEX itinerary_cache_created_at_idx ON itinerary_cache (created_at);

ALTER TABLE itinerary_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_only" ON itinerary_cache
  USING (auth.uid() = user_id);
