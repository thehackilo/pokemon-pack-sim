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

CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING ( auth.uid() = id );

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING ( auth.uid() = id );

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Users can view own cards" 
  ON cards FOR SELECT 
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert own cards" 
  ON cards FOR INSERT 
  WITH CHECK ( auth.uid() = user_id );

CREATE POLICY "Users can update own cards" 
  ON cards FOR UPDATE 
  USING ( auth.uid() = user_id );

CREATE POLICY "Users can delete own cards" 
  ON cards FOR DELETE 
  USING ( auth.uid() = user_id );
