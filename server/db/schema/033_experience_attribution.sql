-- Add attribution JSON column to seasonal_experiences for Unsplash compliance
-- Run: psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/033_experience_attribution.sql

ALTER TABLE seasonal_experiences ADD COLUMN IF NOT EXISTS image_attribution JSONB;
