-- Migration 018: Add companions field to pins
-- Run: psql $DATABASE_URL -f server/db/schema/018_companions.sql
ALTER TABLE pins ADD COLUMN IF NOT EXISTS companions TEXT[] DEFAULT '{}';
