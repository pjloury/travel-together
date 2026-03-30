-- Migration 015: Create notifications table
-- @implements REQ-NOTIF-001, SCN-NOTIF-001-01

CREATE TYPE notification_type AS ENUM ('interest', 'inspired');

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  pin_id          UUID REFERENCES pins(id) ON DELETE CASCADE,
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
