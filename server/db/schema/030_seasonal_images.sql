-- Add image_url to seasonal_experiences for cover photos
-- Run: psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/030_seasonal_images.sql

ALTER TABLE seasonal_experiences ADD COLUMN IF NOT EXISTS image_url TEXT;
