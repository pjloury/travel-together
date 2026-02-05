CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1 UUID REFERENCES users(id) ON DELETE CASCADE,
  user_id_2 UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  requested_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  UNIQUE(user_id_1, user_id_2)
);
CREATE INDEX idx_friendships_user1 ON friendships(user_id_1);
CREATE INDEX idx_friendships_user2 ON friendships(user_id_2);

