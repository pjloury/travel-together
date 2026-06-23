-- 034_venues.sql: National parks and ski resorts tracking
-- Run: psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/034_venues.sql

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('national_park', 'ski_resort')),
  country TEXT,
  region TEXT,
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS venues_type_idx ON venues(type);
CREATE INDEX IF NOT EXISTS venues_name_idx ON venues(name);

CREATE TABLE IF NOT EXISTS pin_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  UNIQUE(pin_id, venue_id)
);

CREATE INDEX IF NOT EXISTS pin_venues_pin_idx ON pin_venues(pin_id);
CREATE INDEX IF NOT EXISTS pin_venues_venue_idx ON pin_venues(venue_id);
