-- Index to accelerate viewport bbox queries on the pins table.
--
-- listPins() filters with:
--   .gte('lat', south).lte('lat', north).gte('lng', west).lte('lng', east)
--
-- A composite btree on (lat, lng) lets Postgres satisfy the lat range with
-- an index scan and then filter lng without a full-table scan.
-- If the earthdistance extension is available, replace with:
--   CREATE INDEX IF NOT EXISTS pins_lat_lng_idx
--     ON pins USING gist (ll_to_earth(lat, lng));

CREATE INDEX IF NOT EXISTS pins_lat_lng_idx
  ON pins (lat, lng);
