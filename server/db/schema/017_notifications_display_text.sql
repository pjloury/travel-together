-- Migration 017: Add display_text column to notifications table
-- @implements REQ-NOTIF-001, SCN-NOTIF-001-01

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS display_text TEXT;
