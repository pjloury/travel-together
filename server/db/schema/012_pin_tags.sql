-- Migration 012: Create custom_tags and pin_tags tables
-- @implements REQ-MEMORY-003, SCN-MEMORY-003-01

CREATE TABLE custom_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_custom_tags_user ON custom_tags(user_id);

CREATE TABLE pin_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  experience_tag_id INTEGER REFERENCES experience_tags(id) ON DELETE CASCADE,
  custom_tag_id   UUID REFERENCES custom_tags(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT chk_tag_type CHECK (
    (experience_tag_id IS NOT NULL AND custom_tag_id IS NULL)
    OR (experience_tag_id IS NULL AND custom_tag_id IS NOT NULL)
  )
);

CREATE INDEX idx_pin_tags_pin ON pin_tags(pin_id);
CREATE INDEX idx_pin_tags_experience ON pin_tags(experience_tag_id);
CREATE INDEX idx_pin_tags_custom ON pin_tags(custom_tag_id);
