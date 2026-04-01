-- Create itineraries table for storing saved user itineraries
CREATE TABLE public.itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  arrival_location TEXT,
  departure_location TEXT,
  start_date DATE,
  end_date DATE,
  travel_pace TEXT, -- 'relaxed', 'moderate', 'active'
  budget TEXT, -- 'budget', 'mid-range', 'luxury'
  interests TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX idx_itineraries_user_id ON public.itineraries(user_id);
CREATE INDEX idx_itineraries_created_at ON public.itineraries(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view their own itineraries
CREATE POLICY "Users can view own itineraries" ON public.itineraries
  FOR SELECT USING (auth.uid() = user_id);

-- RLS Policy: Users can insert their own itineraries
CREATE POLICY "Users can insert own itineraries" ON public.itineraries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can delete their own itineraries
CREATE POLICY "Users can delete own itineraries" ON public.itineraries
  FOR DELETE USING (auth.uid() = user_id);
