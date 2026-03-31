-- Migration 020: Add explicit countries array to pins
-- Stores countries the user explicitly associates with a memory/dream,
-- separate from place_name / normalized_country auto-derivation.
-- Run: psql $DATABASE_URL -f server/db/schema/020_pin_countries.sql

ALTER TABLE pins ADD COLUMN IF NOT EXISTS countries TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_pins_countries ON pins USING GIN (countries);
