-- Phase 3.2: indexes to support server-side category and role filters.
--
-- pins.category is now pushed into the SQL WHERE clause, so a btree index
-- significantly cuts scan cost when filtered results are a small fraction
-- of the total rows.
--
-- profiles.role is filtered via an INNER JOIN when creatorType is selected;
-- an index on the role column avoids a full profiles table scan.

CREATE INDEX IF NOT EXISTS pins_category_idx ON pins (category);
CREATE INDEX IF NOT EXISTS profiles_role_idx  ON profiles (role);
