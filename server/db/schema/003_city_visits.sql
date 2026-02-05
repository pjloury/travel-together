CREATE TABLE city_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  country_visit_id UUID REFERENCES country_visits(id) ON DELETE CASCADE,
  city_name VARCHAR(200) NOT NULL,
  place_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_city_visits_country ON city_visits(country_visit_id);

