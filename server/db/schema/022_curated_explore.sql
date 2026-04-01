-- Migration 022: Curated Explore — trip clusters + individual experiences
-- Stores AI-curated travel content from influencers/travel bloggers
-- Run: psql $DATABASE_URL -f server/db/schema/022_curated_explore.sql

CREATE TABLE IF NOT EXISTS curated_trips (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  city            TEXT        NOT NULL,
  country         TEXT        NOT NULL,
  region          TEXT,
  title           TEXT        NOT NULL,
  description     TEXT,
  image_url       TEXT,
  days_suggested  INTEGER     NOT NULL DEFAULT 4,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  last_scraped_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT curated_trips_city_unique UNIQUE (city)
);

CREATE INDEX IF NOT EXISTS idx_curated_trips_region ON curated_trips (region);
CREATE INDEX IF NOT EXISTS idx_curated_trips_tags   ON curated_trips USING GIN (tags);

CREATE TABLE IF NOT EXISTS curated_experiences (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID        NOT NULL REFERENCES curated_trips(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  description     TEXT,
  place_name      TEXT,
  category        TEXT        NOT NULL DEFAULT 'culture'
                              CHECK (category IN
                                ('food','culture','nature','nightlife','shopping','adventure','wellness')),
  source_url      TEXT,
  source_name     TEXT,
  influencer_name TEXT,
  quote           TEXT,
  tags            TEXT[]      NOT NULL DEFAULT '{}',
  day_number      INTEGER     NOT NULL DEFAULT 1,
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curated_exp_trip  ON curated_experiences (trip_id);
CREATE INDEX IF NOT EXISTS idx_curated_exp_day   ON curated_experiences (trip_id, day_number, sort_order);
