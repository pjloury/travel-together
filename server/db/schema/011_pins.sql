-- Migration 011: Create pins table (unified memory + dream model)
-- @implements REQ-MEMORY-001, SCN-MEMORY-001-01, REQ-DREAM-001, SCN-DREAM-001-01

CREATE TYPE pin_type AS ENUM ('memory', 'dream');

CREATE TABLE pins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_type              pin_type NOT NULL,

  -- Location (free-form + normalized)
  place_name            TEXT NOT NULL,
  normalized_city       TEXT,
  normalized_country    TEXT,
  normalized_region     TEXT,
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  location_confidence   VARCHAR(10) CHECK (location_confidence IN ('high', 'medium', 'low')),
  location_verified     BOOLEAN NOT NULL DEFAULT false,

  -- Content
  ai_summary            TEXT,
  note                  TEXT,
  transcript            TEXT,
  correction_transcript TEXT,

  -- Media
  photo_url             TEXT,
  photo_source          VARCHAR(20) CHECK (photo_source IN ('upload', 'extension', 'unsplash')),
  unsplash_image_url    TEXT,
  unsplash_attribution  TEXT,

  -- Memory-specific fields
  visit_year            INTEGER CHECK (visit_year BETWEEN 1900 AND 2100),
  rating                INTEGER CHECK (rating BETWEEN 1 AND 5),

  -- Dream-specific fields
  dream_note            TEXT,
  archived              BOOLEAN NOT NULL DEFAULT false,

  -- Social / inspired-by fields (intentionally NOT foreign keys per spec)
  inspired_by_pin_id    UUID,
  inspired_by_user_id   UUID,
  inspired_by_display_name TEXT,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes per spec Section 2
CREATE INDEX idx_pins_user_id ON pins(user_id);
CREATE INDEX idx_pins_user_type ON pins(user_id, pin_type);
CREATE INDEX idx_pins_normalized_region ON pins(normalized_region) WHERE normalized_region IS NOT NULL;
CREATE INDEX idx_pins_location_verified ON pins(location_verified);
CREATE INDEX idx_pins_created_at ON pins(created_at DESC);
