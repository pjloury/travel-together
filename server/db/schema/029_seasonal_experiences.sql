-- Seasonal experiences — editorial seed data from seed_v1.json
-- Run: psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/029_seasonal_experiences.sql

CREATE TABLE IF NOT EXISTS seasonal_experiences (
  id              TEXT PRIMARY KEY,                      -- e.g. "exp_001"
  name            TEXT NOT NULL,
  city            TEXT NOT NULL,
  country         TEXT NOT NULL,
  months          INTEGER[] NOT NULL DEFAULT '{}',       -- 1-12; empty = any time / unknown
  when_text       TEXT,                                  -- free-text "when" from older entries
  categories      TEXT[] NOT NULL DEFAULT '{}',
  vibe_tags       TEXT[] NOT NULL DEFAULT '{}',
  description     TEXT,
  why_special     TEXT,                                  -- "why_special" or "tips" field
  best_for        TEXT[] NOT NULL DEFAULT '{}',
  source_dataset  TEXT,
  source_url      TEXT,
  accessibility   INTEGER,                               -- 1-4 scale
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_se_months    ON seasonal_experiences USING GIN (months);
CREATE INDEX IF NOT EXISTS idx_se_categories ON seasonal_experiences USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_se_country   ON seasonal_experiences (country);
