-- Migration 010: Create experience_tags table and seed all 16 tags
-- @implements REQ-MEMORY-003, SCN-MEMORY-003-01

CREATE TABLE experience_tags (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(50) NOT NULL UNIQUE,
  emoji           VARCHAR(10) NOT NULL,
  description     TEXT NOT NULL,
  gradient_start  VARCHAR(7) NOT NULL,
  gradient_end    VARCHAR(7) NOT NULL,
  sort_order      INTEGER NOT NULL UNIQUE
);

INSERT INTO experience_tags (id, name, emoji, description, gradient_start, gradient_end, sort_order) VALUES
(1,  'Nature & Wildlife',       '🏞️', 'National parks, safaris, forests, mountains, natural wonders', '#2D5016', '#4A7C23', 1),
(2,  'Food & Drink',            '🍜', 'Local cuisine, street food, wine regions, cooking classes, restaurants', '#8B4513', '#D2691E', 2),
(3,  'Culture & History',       '🏯', 'Temples, museums, ancient ruins, historical sites, traditions', '#6B2D5B', '#9B4B8A', 3),
(4,  'Beach & Water',           '🌊', 'Coastlines, islands, snorkeling, diving, lakeside relaxation', '#0E4D6E', '#1A8FBF', 4),
(5,  'Outdoor Adventure',       '🧗', 'Hiking, climbing, rafting, canyoning, extreme sports', '#8B4000', '#CC5500', 5),
(6,  'Winter Sports',           '🎿', 'Skiing, snowboarding, ice climbing, winter landscapes', '#1B3A5C', '#3A7BD5', 6),
(7,  'Sports',                  '🏟️', 'Attending events, playing sports, marathons, sport culture', '#1A472A', '#2E8B57', 7),
(8,  'Nightlife & Music',       '🍸', 'Clubs, live music, bars, festivals, concerts', '#2D1B4E', '#6A1B9A', 8),
(9,  'Architecture & Streets',  '🏛️', 'City walks, iconic buildings, urban exploration, neighborhoods', '#4A4A4A', '#7A7A7A', 9),
(10, 'Wellness & Slow Travel',  '🧘', 'Spas, retreats, meditation, hot springs, slow-paced journeys', '#2E4A3E', '#5B8A72', 10),
(11, 'Arts & Creativity',       '🎭', 'Galleries, street art, theater, craft workshops, local art scenes', '#8B2252', '#CD3278', 11),
(12, 'People & Connections',    '🤝', 'Homestays, local encounters, community experiences, friendships', '#654321', '#A0785A', 12),
(13, 'Epic Journeys',           '🚂', 'Road trips, train routes, sailing, multi-day treks, cross-country', '#4A2800', '#8B5000', 13),
(14, 'Shopping & Markets',      '🛍️', 'Bazaars, flea markets, artisan shops, souvenirs, local crafts', '#6B2D5B', '#B8578A', 14),
(15, 'Festivals & Special Events', '🎊', 'Carnivals, cultural festivals, holidays, seasonal celebrations', '#8B0000', '#DC143C', 15),
(16, 'Photography',             '📸', 'Landscapes, portraits, golden hour spots, photogenic locations', '#2C3E50', '#4A6FA5', 16);
