-- D5: itinerary_places table
-- Stores geocoded places extracted from generated itineraries by the
-- extractAndPersistPlaces() server function (api/lib/extractPlaces.ts).
-- One row per named venue per itinerary.

CREATE TABLE public.itinerary_places (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id  UUID NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  day           INTEGER NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('food', 'sight', 'nightlife', 'shop', 'transport', 'accommodation')),
  context       TEXT,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_itinerary_places_itinerary_id ON public.itinerary_places (itinerary_id);

-- RLS: owner of the itinerary can read their places; inserts are service-role only.
ALTER TABLE public.itinerary_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own itinerary places"
  ON public.itinerary_places
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.itineraries
      WHERE itineraries.id = itinerary_places.itinerary_id
        AND itineraries.user_id = auth.uid()
    )
  );
