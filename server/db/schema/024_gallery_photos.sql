-- Gallery: curated collection of stunning travel photos
CREATE TABLE IF NOT EXISTS gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  thumb_url TEXT,
  photographer_name TEXT,
  photographer_url TEXT,
  unsplash_url TEXT,
  location_name TEXT NOT NULL,
  country TEXT,
  region TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  description TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_photos_region ON gallery_photos(region);
CREATE INDEX IF NOT EXISTS idx_gallery_photos_likes ON gallery_photos(likes DESC);
