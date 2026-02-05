CREATE TABLE country_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, country_code)
);
CREATE INDEX idx_country_visits_user ON country_visits(user_id);

