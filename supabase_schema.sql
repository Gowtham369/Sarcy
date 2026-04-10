-- Run this in Supabase SQL editor to set up your database

CREATE TABLE IF NOT EXISTS vibe_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  vibe TEXT NOT NULL DEFAULT 'dry',
  vibe_label TEXT,
  sarcasm_intensity INT DEFAULT 5,
  cues JSONB DEFAULT '[]',
  confidence FLOAT DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vibe_profiles_updated_at
  BEFORE UPDATE ON vibe_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Allow public read/write (fine for a free side project)
ALTER TABLE vibe_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations" ON vibe_profiles
  FOR ALL USING (true) WITH CHECK (true);
