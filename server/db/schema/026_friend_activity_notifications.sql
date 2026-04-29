-- Migration 026: Friend-activity notifications
--
-- Adds three new notification_type enum values so we can fan out to all
-- friends when a user creates a memory, creates a dream, or converts a
-- dream into a memory.
--
-- Run locally with:
--   psql postgresql://pjloury@localhost:5432/travel_together \
--     -f server/db/schema/026_friend_activity_notifications.sql
--
-- Render picks up enum additions at runtime since the inserter route
-- uses the new values directly — but `ALTER TYPE ... ADD VALUE` cannot
-- run inside a transaction, so the statements below are issued one at a
-- time. `IF NOT EXISTS` lets re-runs no-op safely.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_memory';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_dream';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'friend_converted';

-- Index to speed up "fan out to all of user X's friends" lookups —
-- the notification creation path issues one SELECT against friendships
-- per pin creation, then bulk-inserts notification rows. Existing
-- idx_friendships_user1 covers user_id_1 lookups; add the symmetric one.
CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user_id_2);
