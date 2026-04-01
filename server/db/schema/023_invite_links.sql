-- Invite links: each user gets a persistent shareable invite code
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invite_links_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
