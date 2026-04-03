-- Supabase Database Startup Script for Pokémon Pack Sim

-- Run all of these commands in the Supabase SQL Editor

-- 1. Create a `profiles` table to track wallet balance and app settings
CREATE TABLE profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  wallet NUMERIC DEFAULT 25.00,
  auto_sell_threshold NUMERIC DEFAULT 0,
  stats JSONB DEFAULT '{"packs":0,"common":0,"uncommon":0,"rare":0,"ultra":0,"legendary":0}'::jsonb
);

-- 2. Create a `cards` table to store collected cards
CREATE TABLE cards (
  uid TEXT NOT NULL PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  card_id TEXT NOT NULL,
  set_id TEXT,
  set_name TEXT,
  api_data JSONB NOT NULL,
  properties JSONB NOT NULL,
  grading_start_time BIGINT,
  psa_grade INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. Set up Row Level Security (RLS) so users can only access their own data
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- 4. NEW: Support for Username and Leaderboard (Required for newest update)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Function to calculate leaderboard data efficiently (V2: Includes PSA Multipliers + user_id)
CREATE OR REPLACE FUNCTION get_leaderboard()
RETURNS TABLE (user_id UUID, username TEXT, total_value NUMERIC) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as user_id,
    COALESCE(p.username, 'Anonymous Trainer') as username,
    SUM(
      (
        COALESCE((c.api_data->'tcgPrices'->'holofoil'->>'market')::numeric, 0) +
        COALESCE((c.api_data->'tcgPrices'->'reverseHolofoil'->>'market')::numeric, 0) +
        COALESCE((c.api_data->'tcgPrices'->'normal'->>'market')::numeric, 0) +
        COALESCE((c.api_data->'tcgPrices'->'unlimitedHolofoil'->>'market')::numeric, 0)
      ) * 
      CASE 
        WHEN c.psa_grade = 10 THEN 8.0
        WHEN c.psa_grade = 9 THEN 3.0
        WHEN c.psa_grade = 8 THEN 1.6
        WHEN c.psa_grade = 7 THEN 1.15
        WHEN c.psa_grade = 6 THEN 0.9
        WHEN c.psa_grade = 5 THEN 0.7
        WHEN c.psa_grade = 4 THEN 0.5
        WHEN c.psa_grade = 3 THEN 0.35
        WHEN c.psa_grade = 2 THEN 0.25
        WHEN c.psa_grade = 1 THEN 0.15
        ELSE 1.0
      END
    ) as total_value
  FROM profiles p
  JOIN cards c ON p.id = c.user_id
  GROUP BY p.id, p.username
  ORDER BY total_value DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- Policies for profiles
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING ( auth.uid() = id );

CREATE POLICY "Enable read access for all for leaderboard"
  ON profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING ( auth.uid() = id );

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK ( auth.uid() = id );

-- Function to fetch a specific user's vault with pagination and value-based sorting
CREATE OR REPLACE FUNCTION get_user_vault(target_user_id UUID, p_limit INT, p_offset INT)
RETURNS SETOF cards AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM cards c
  WHERE c.user_id = target_user_id
  ORDER BY (
      (
        COALESCE((c.api_data->'tcgPrices'->'holofoil'->>'market')::numeric, 0) +
        COALESCE((c.api_data->'tcgPrices'->'reverseHolofoil'->>'market')::numeric, 0) +
        COALESCE((c.api_data->'tcgPrices'->'normal'->>'market')::numeric, 0) +
        COALESCE((c.api_data->'tcgPrices'->'unlimitedHolofoil'->>'market')::numeric, 0)
      ) * 
      CASE 
        WHEN c.psa_grade = 10 THEN 8.0
        WHEN c.psa_grade = 9 THEN 3.0
        WHEN c.psa_grade = 8 THEN 1.6
        WHEN c.psa_grade = 7 THEN 1.15
        WHEN c.psa_grade = 6 THEN 0.9
        WHEN c.psa_grade = 5 THEN 0.7
        WHEN c.psa_grade = 4 THEN 0.5
        WHEN c.psa_grade = 3 THEN 0.35
        WHEN c.psa_grade = 2 THEN 0.25
        WHEN c.psa_grade = 1 THEN 0.15
        ELSE 1.0
      END
  ) DESC, c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
CREATE POLICY "Users can delete own cards" 
  ON cards FOR DELETE 
  USING ( auth.uid() = user_id );
