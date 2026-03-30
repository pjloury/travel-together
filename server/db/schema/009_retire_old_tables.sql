-- Migration 009: Drop legacy tables no longer needed
-- The app is pivoting to a unified pin-based model.
-- Retained tables: users, friendships, password_reset_tokens

DROP TABLE IF EXISTS city_experiences CASCADE;
DROP TABLE IF EXISTS user_travel_profiles CASCADE;
DROP TABLE IF EXISTS trip_proposals CASCADE;
DROP TABLE IF EXISTS country_profiles CASCADE;
DROP TABLE IF EXISTS country_wishlist CASCADE;
DROP TABLE IF EXISTS city_visits CASCADE;
DROP TABLE IF EXISTS country_visits CASCADE;
