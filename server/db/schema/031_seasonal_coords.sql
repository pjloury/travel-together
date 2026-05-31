-- Add lat/lon coordinates to seasonal_experiences for map view
-- Run locally: psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/031_seasonal_coords.sql
-- Run prod:    psql $PROD_DATABASE_URL -f server/db/schema/031_seasonal_coords.sql

ALTER TABLE seasonal_experiences ADD COLUMN IF NOT EXISTS lat FLOAT;
ALTER TABLE seasonal_experiences ADD COLUMN IF NOT EXISTS lon FLOAT;

CREATE INDEX IF NOT EXISTS idx_se_coords ON seasonal_experiences (lat, lon)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;
