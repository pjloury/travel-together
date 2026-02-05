CREATE TABLE country_wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  country_code CHAR(2) NOT NULL,
  country_name VARCHAR(100) NOT NULL,
  interest_level INTEGER NOT NULL CHECK (interest_level >= 1 AND interest_level <= 5),
  specific_cities TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, country_code)
);
CREATE INDEX idx_wishlist_user ON country_wishlist(user_id);

