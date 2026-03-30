-- Migration 016: Create user_preferences table
-- @implements REQ-NAV-004, SCN-NAV-004-01

CREATE TABLE user_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_tab        pin_type NOT NULL DEFAULT 'memory',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
