-- Trip log support: casual/frequent trip memories separate from highlight grid
-- Run: psql $DATABASE_URL -f server/db/schema/028_trip_logs.sql

ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_trip_log BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS visit_month INTEGER CHECK (visit_month BETWEEN 1 AND 12);

CREATE INDEX IF NOT EXISTS idx_pins_trip_log ON pins(user_id, is_trip_log) WHERE is_trip_log = TRUE;
CREATE INDEX IF NOT EXISTS idx_pins_visit_date ON pins(user_id, visit_year, visit_month);
