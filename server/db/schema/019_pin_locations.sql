-- Migration 019: pin_locations — allow a single memory/dream pin to have
-- multiple named stops (e.g. a trip spanning Paris → Amsterdam → Berlin).
--
-- The primary location stays on the pins table (place_name + lat/lng).
-- This table stores additional stops in order.
--
-- Run: psql $DATABASE_URL -f server/db/schema/019_pin_locations.sql

CREATE TABLE IF NOT EXISTS pin_locations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id            UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  place_name        TEXT NOT NULL,
  normalized_city   TEXT,
  normalized_country TEXT,
  normalized_region  TEXT,
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  location_confidence VARCHAR(10) CHECK (location_confidence IN ('high', 'medium', 'low')),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_locations_pin_id ON pin_locations(pin_id);
CREATE INDEX IF NOT EXISTS idx_pin_locations_country ON pin_locations(normalized_country)
  WHERE normalized_country IS NOT NULL;
