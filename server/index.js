const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const googleAuthRoutes = require('./routes/google-auth');
const countriesRoutes = require('./routes/countries');
const citiesRoutes = require('./routes/cities');
const wishlistRoutes = require('./routes/wishlist');
const friendsRoutes = require('./routes/friends');
const usersRoutes = require('./routes/users');
const alignmentRoutes = require('./routes/alignment');
const pinsRoutes = require('./routes/pins');
const tagsRoutes = require('./routes/tags');
const preferencesRoutes = require('./routes/preferences');
const voiceRoutes = require('./routes/voice');
const locationRoutes = require('./routes/location');
const socialRoutes = require('./routes/social');
const notificationsRoutes = require('./routes/notifications');
const searchRoutes = require('./routes/search');
const invitesRoutes = require('./routes/invites');
const placesRoutes = require('./routes/places');
const exploreRoutes = require('./routes/explore');
const galleryRoutes = require('./routes/gallery');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://travel-together-tau.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Allow any Chrome extension
    if (origin && origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }

    // Allow any vercel.app subdomain
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Allow any pjloury.com subdomain
    if (origin.endsWith('.pjloury.com')) {
      return callback(null, true);
    }
    
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/auth/google', googleAuthRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/alignment', alignmentRoutes);
app.use('/api/pins', pinsRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/users/preferences', preferencesRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/invites', invitesRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/explore', exploreRoutes);
app.use('/api/gallery', galleryRoutes);

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test database connection
  try {
    await db.query('SELECT NOW()');
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
  }

  // Auto-create pin_photos table if it doesn't exist (migration 025)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS pin_photos (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pin_id      UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        photo_url   TEXT NOT NULL,
        photo_source VARCHAR(20) DEFAULT 'upload',
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pin_photos_pin_id ON pin_photos(pin_id);
    `);
    // Migrate old pin_photos schema (image_url/caption → photo_url/photo_source)
    // If table was created before commit 092c799 it has the old column names
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pin_photos' AND column_name='image_url')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pin_photos' AND column_name='photo_url')
        THEN
          ALTER TABLE pin_photos RENAME COLUMN image_url TO photo_url;
        END IF;
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pin_photos' AND column_name='caption')
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pin_photos' AND column_name='photo_source')
        THEN
          ALTER TABLE pin_photos RENAME COLUMN caption TO photo_source;
          ALTER TABLE pin_photos ALTER COLUMN photo_source SET DEFAULT 'upload';
        END IF;
        -- Ensure photo_source column exists even if table was created without it
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pin_photos' AND column_name='photo_source')
        THEN
          ALTER TABLE pin_photos ADD COLUMN photo_source VARCHAR(20) DEFAULT 'upload';
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('pin_photos table creation failed:', err.message);
  }
});

