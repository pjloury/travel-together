-- Country profiles cache (AI-generated)
CREATE TABLE IF NOT EXISTS country_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code VARCHAR(10) UNIQUE NOT NULL,
  country_name VARCHAR(255) NOT NULL,
  best_times JSONB DEFAULT '[]',
  cultural_facts TEXT[] DEFAULT '{}',
  general_tips TEXT[] DEFAULT '{}',
  top_experiences JSONB DEFAULT '[]',
  vibe TEXT,
  ai_generated_at TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User AI travel profiles cache
CREATE TABLE IF NOT EXISTS user_travel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  profile_summary TEXT,
  travel_style VARCHAR(100),
  top_regions TEXT[] DEFAULT '{}',
  insights TEXT[] DEFAULT '{}',
  next_challenge TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip proposals
CREATE TABLE IF NOT EXISTS trip_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(10) NOT NULL,
  country_name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  mood VARCHAR(100),
  tagline TEXT,
  duration VARCHAR(100),
  activities TEXT[] DEFAULT '{}',
  itinerary TEXT,
  best_time_to_go VARCHAR(255),
  group_tip TEXT,
  is_ai_generated BOOLEAN DEFAULT false,
  participant_ids UUID[] DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_proposals_created_by ON trip_proposals(created_by);
CREATE INDEX IF NOT EXISTS idx_trip_proposals_country ON trip_proposals(country_code);

-- Enhanced travel tracking
ALTER TABLE country_visits
  ADD COLUMN IF NOT EXISTS visited_year INTEGER CHECK (visited_year BETWEEN 1900 AND 2100),
  ADD COLUMN IF NOT EXISTS enjoyment_rating INTEGER CHECK (enjoyment_rating BETWEEN 1 AND 5);

ALTER TABLE country_wishlist
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Experiences on cities
CREATE TABLE IF NOT EXISTS city_experiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  city_visit_id UUID REFERENCES city_visits(id) ON DELETE CASCADE,
  experience_name VARCHAR(255) NOT NULL,
  experience_type VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_city_experiences_user ON city_experiences(user_id);
CREATE INDEX IF NOT EXISTS idx_city_experiences_city_visit ON city_experiences(city_visit_id);
