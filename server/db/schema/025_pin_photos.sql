-- Migration 025: pin_photos — allow multiple photos per pin.
-- Each pin can have an ordered list of photos uploaded by the user.
-- Run: psql $DATABASE_URL -f server/db/schema/025_pin_photos.sql

CREATE TABLE IF NOT EXISTS pin_photos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id      UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  photo_url   TEXT NOT NULL,
  photo_source VARCHAR(20) DEFAULT 'upload',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pin_photos_pin_id ON pin_photos(pin_id);
