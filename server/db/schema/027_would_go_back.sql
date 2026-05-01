-- Migration 027: add would_go_back flag to memory pins
-- Run: psql postgresql://pjloury@localhost:5432/travel_together -f server/db/schema/027_would_go_back.sql
ALTER TABLE pins ADD COLUMN IF NOT EXISTS would_go_back boolean DEFAULT NULL;
