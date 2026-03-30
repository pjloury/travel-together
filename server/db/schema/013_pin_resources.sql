-- Migration 013: Create pin_resources table
-- @implements REQ-DREAM-001, SCN-DREAM-001-01

CREATE TABLE pin_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  domain_name     VARCHAR(255) NOT NULL,
  photo_url       TEXT,
  excerpt         VARCHAR(280),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pin_resources_pin ON pin_resources(pin_id);
