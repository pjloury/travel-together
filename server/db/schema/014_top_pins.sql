-- Migration 014: Create top_pins table
-- @implements REQ-PROFILE-001, SCN-PROFILE-001-01

CREATE TABLE top_pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  tab             pin_type NOT NULL,
  sort_order      INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pin_id),
  UNIQUE(user_id, tab, sort_order)
);

CREATE INDEX idx_top_pins_user_tab ON top_pins(user_id, tab);
