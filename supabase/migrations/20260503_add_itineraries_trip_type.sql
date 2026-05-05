-- Add optional trip_type column to itineraries table.
-- Allowed values mirror the TripType union in src/features/itinerary/types.ts.
-- NULL means the user did not select a trip type (field is optional).

ALTER TABLE itineraries
  ADD COLUMN IF NOT EXISTS trip_type text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'itineraries_trip_type_chk'
  ) THEN
    ALTER TABLE itineraries
      ADD CONSTRAINT itineraries_trip_type_chk
      CHECK (trip_type IS NULL OR trip_type IN (
        'solo_wanderer', 'hostel_hop', 'friends_budget',
        'slow_travel', 'first_abroad', 'work_exchange'
      ));
  END IF;
END $$;
