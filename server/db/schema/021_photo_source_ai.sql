-- Migration 021: Expand photo_source constraint to include AI-generated images
-- Run: psql $DATABASE_URL -f server/db/schema/021_photo_source_ai.sql

ALTER TABLE pins DROP CONSTRAINT IF EXISTS pins_photo_source_check;
ALTER TABLE pins ADD CONSTRAINT pins_photo_source_check
  CHECK (photo_source IN ('upload', 'extension', 'unsplash', 'gemini_imagen'));
