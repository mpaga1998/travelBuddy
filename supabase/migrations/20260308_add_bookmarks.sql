-- Create pin_bookmarks table to track which users bookmarked which pins
CREATE TABLE pin_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(pin_id, user_id)
);

-- Add bookmark_count column to pins table
ALTER TABLE pins ADD COLUMN bookmark_count INTEGER DEFAULT 0;

-- Create index for efficient queries
CREATE INDEX idx_pin_bookmarks_pin_id ON pin_bookmarks(pin_id);
CREATE INDEX idx_pin_bookmarks_user_id ON pin_bookmarks(user_id);

-- Create a trigger to maintain bookmark_count
CREATE OR REPLACE FUNCTION update_pin_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pins SET bookmark_count = bookmark_count + 1 WHERE id = NEW.pin_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pins SET bookmark_count = bookmark_count - 1 WHERE id = OLD.pin_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pin_bookmarks_trigger
AFTER INSERT OR DELETE ON pin_bookmarks
FOR EACH ROW EXECUTE FUNCTION update_pin_bookmark_count();

-- Set RLS policies
ALTER TABLE pin_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all bookmarks" ON pin_bookmarks
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own bookmarks" ON pin_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON pin_bookmarks
  FOR DELETE USING (auth.uid() = user_id);
