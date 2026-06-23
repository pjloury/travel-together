const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Required-secret guard. Fail fast at boot rather than silently signing
// JWTs with a hardcoded fallback if JWT_SECRET is ever missing in a
// production deploy (rotation accident, deploy-script bug, etc.).
// Allow a dev-only fallback when NODE_ENV is explicitly 'development'
// or 'test' so local + CI runs don't need .env wiring.
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: JWT_SECRET env var is required in production');
  }
  console.warn('[boot] JWT_SECRET unset — using dev fallback. DO NOT USE IN PROD.');
  process.env.JWT_SECRET = 'dev-secret-key';
}

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
const tripLogsRoutes = require('./routes/tripLogs');
const seasonalRoutes = require('./routes/seasonal');
const venuesRoutes = require('./routes/venues');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
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

// Trust X-Forwarded-For from Render's proxy so rate-limit and other
// IP-aware middleware see the real client IP, not the load balancer.
app.set('trust proxy', 1);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Rate limiting on auth endpoints. 20 req/min per IP is comfortably
// above any legitimate user pattern (login retries, fat-fingered
// passwords) but throttles brute-force / credential-stuffing
// campaigns. Limit applies to login, register, /google, and the
// password-reset endpoints — not /me, /update which are protected by
// the JWT middleware already.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Skip preflight OPTIONS so CORS still works smoothly.
  skip: (req) => req.method === 'OPTIONS',
  message: { success: false, error: 'Too many auth requests, slow down.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

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
app.use('/api/trip-logs', tripLogsRoutes);
app.use('/api/seasonal', seasonalRoutes);
app.use('/api/venues', venuesRoutes);

// ── /m/:token — OpenGraph link-preview endpoint ──────────────────────
//
// When a user texts the invite URL (https://tt.pjloury.com/m/<token>),
// iMessage / WhatsApp / Slack / etc. fetch the URL and look for
// og: meta tags to render a rich preview card. Vercel rewrites that
// path here when no `?join` query param is present so we can return
// HTML with og: tags interpolated from the pin (image = cover photo,
// title = place name, description = owner-invited-you copy).
//
// Real human visitors fall through to a meta-refresh + JS redirect
// that bounces them to /m/<token>?join=1 — Vercel sees the `?join`
// param and serves the SPA index.html instead, which mounts the
// MemoryInvite page that POSTs the claim.
app.get('/m/:token', async (req, res) => {
  const db = require('./db');
  const escapeHtml = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  let title = 'A memory on Travel Together';
  let desc = 'You were tagged in a memory. Tap to join.';
  let image = 'https://tt.pjloury.com/hero-bg.jpg';
  try {
    const result = await db.query(
      `SELECT p.place_name,
              p.note,
              p.photo_url,
              p.unsplash_image_url,
              u.display_name AS owner_name
       FROM pending_tags pt
       JOIN pins  p ON p.id = pt.pin_id
       JOIN users u ON u.id = pt.sender_user_id
       WHERE pt.invite_token = $1
       LIMIT 1`,
      [req.params.token]
    );
    if (result.rows.length > 0) {
      const r = result.rows[0];
      const place = r.place_name || 'a memory';
      const owner = r.owner_name || 'A friend';
      title = `${owner} tagged you in ${place}`;
      desc = r.note
        ? r.note.slice(0, 180)
        : `${owner} added you to a memory on Travel Together. Tap to join.`;
      const cover = r.photo_url || r.unsplash_image_url;
      if (cover) image = cover;
    }
  } catch { /* fall back to defaults */ }

  const redirectUrl = `https://tt.pjloury.com/m/${encodeURIComponent(req.params.token)}?join=1`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}" />

<meta property="og:type" content="website" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(desc)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:url" content="https://tt.pjloury.com/m/${escapeHtml(req.params.token)}" />
<meta property="og:site_name" content="Travel Together" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(desc)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />

<meta http-equiv="refresh" content="0; url=${escapeHtml(redirectUrl)}" />
<link rel="canonical" href="https://tt.pjloury.com/m/${escapeHtml(req.params.token)}" />
</head>
<body style="font-family: system-ui, sans-serif; padding: 32px; color: #444;">
<p>Opening Travel Together…</p>
<p><a href="${escapeHtml(redirectUrl)}">Tap here if you aren't redirected.</a></p>
<script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
</body>
</html>`);
});

// Run DB migrations before accepting traffic, then start server
async function runMigrations() {
  
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

  // Auto-add would_go_back column on pins (migration 027).
  try {
    await db.query(`
      ALTER TABLE pins ADD COLUMN IF NOT EXISTS would_go_back boolean DEFAULT NULL;
    `);
  } catch (err) {
    console.error('pins.would_go_back migration failed:', err.message);
  }

  // Trip log columns (migration 028).
  try {
    await db.query(`
      ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_trip_log BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE pins ADD COLUMN IF NOT EXISTS visit_month INTEGER CHECK (visit_month BETWEEN 1 AND 12);
      CREATE INDEX IF NOT EXISTS idx_pins_trip_log ON pins(user_id, is_trip_log) WHERE is_trip_log = TRUE;
      CREATE INDEX IF NOT EXISTS idx_pins_visit_date ON pins(user_id, visit_year, visit_month);
    `);
  } catch (err) {
    console.error('pins.trip_log migration failed:', err.message);
  }

  // Auto-add the country_only column on pins if missing.
  // Set on quick-add via the countries modal when the user does NOT opt
  // into creating a memory — these pins are excluded from the memory
  // grid but still contribute to the country bar / map.
  try {
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='pins' AND column_name='country_only'
        ) THEN
          ALTER TABLE pins ADD COLUMN country_only BOOLEAN NOT NULL DEFAULT false;
          CREATE INDEX IF NOT EXISTS idx_pins_country_only
            ON pins(user_id) WHERE country_only = true;
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('pins.country_only migration failed:', err.message);
  }

  // country_visits / city_visits / country_wishlist (migrations 002–004).
  // These never landed on the prod DB until now — every wishlist call
  // 500'd with `relation "country_wishlist" does not exist` and the
  // visited-country / insights routes fail-quietly the same way. Auto-
  // create them on boot so they're guaranteed to exist before any route
  // tries to read them.
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS country_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        country_code CHAR(2) NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, country_code)
      );
      CREATE INDEX IF NOT EXISTS idx_country_visits_user ON country_visits(user_id);

      CREATE TABLE IF NOT EXISTS city_visits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        country_visit_id UUID REFERENCES country_visits(id) ON DELETE CASCADE,
        city_name VARCHAR(200) NOT NULL,
        place_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_city_visits_country ON city_visits(country_visit_id);

      CREATE TABLE IF NOT EXISTS country_wishlist (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        country_code CHAR(2) NOT NULL,
        country_name VARCHAR(100) NOT NULL,
        interest_level INTEGER NOT NULL CHECK (interest_level >= 1 AND interest_level <= 5),
        specific_cities TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, country_code)
      );
      CREATE INDEX IF NOT EXISTS idx_wishlist_user ON country_wishlist(user_id);
    `);
  } catch (err) {
    console.error('country_visits / wishlist migration failed:', err.message);
  }

  // pending_tags: tracks people you've tried to tag in a memory who
  // either don't have a Travel Together account yet (invited by email)
  // or who haven't accepted yet (invited via shareable URL token).
  // When the invitee signs up with the matching email OR opens the URL
  // and claims, the row's claimed_by_user_id is set and the matching
  // memory pin's companions array is updated.
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS pending_tags (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        sender_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invite_email    TEXT,        -- nullable when the invite is URL-only
        invite_token    TEXT UNIQUE, -- nullable when the invite is email-only
        invite_label    TEXT,        -- the display name we showed in the chip
        last_sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        send_count      INTEGER NOT NULL DEFAULT 1,
        claimed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        claimed_at      TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_pending_tags_pin
        ON pending_tags(pin_id);
      CREATE INDEX IF NOT EXISTS idx_pending_tags_sender
        ON pending_tags(sender_user_id);
      CREATE INDEX IF NOT EXISTS idx_pending_tags_email_unclaimed
        ON pending_tags(invite_email)
        WHERE claimed_by_user_id IS NULL AND invite_email IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_pending_tags_token
        ON pending_tags(invite_token)
        WHERE invite_token IS NOT NULL;
    `);
  } catch (err) {
    console.error('pending_tags migration failed:', err.message);
  }

  // click_count on seasonal_experiences for popularity sorting (migration 032)
  try {
    await db.query(`
      ALTER TABLE seasonal_experiences ADD COLUMN IF NOT EXISTS click_count INTEGER NOT NULL DEFAULT 0;
    `);
    // Seed popularity scores only where click_count is still 0 (first run)
    await db.query(`
      UPDATE seasonal_experiences SET click_count = 95 WHERE click_count = 0 AND (
        name ILIKE '%Angkor Wat%' OR name ILIKE '%Northern Lights%' OR name ILIKE '%Aurora%'
        OR name ILIKE '%Oktoberfest%' OR name ILIKE '%Cherry Blossom%' OR name ILIKE '%Hanami%'
        OR name ILIKE '%Machu Picchu%' OR name ILIKE '%Amalfi%' OR name ILIKE '%Santorini%'
        OR name ILIKE '%Sahara%' OR name ILIKE '%Holi Festival%' OR name ILIKE '%Great Migration%'
        OR name ILIKE '%Taj Mahal%' OR name ILIKE '%Fuji%' OR name ILIKE '%Matterhorn%'
        OR name ILIKE '%Albuquerque%Balloon%' OR name ILIKE '%Serengeti%'
      );
      UPDATE seasonal_experiences SET click_count = 82 WHERE click_count = 0 AND (
        name ILIKE '%Everest%' OR name ILIKE '%Annapurna%' OR name ILIKE '%Patagonia%'
        OR name ILIKE '%Torres del Paine%' OR name ILIKE '%Inca Trail%' OR name ILIKE '%Camino%'
        OR name ILIKE '%Diwali%' OR name ILIKE '%Lantern Festival%' OR name ILIKE '%Mardi Gras%'
        OR name ILIKE '%Day of the Dead%' OR name ILIKE '%Colosseum%' OR name ILIKE '%Acropolis%'
        OR name ILIKE '%Great Wall%' OR name ILIKE '%Uluru%' OR name ILIKE '%Grand Canyon%'
        OR name ILIKE '%Yellowstone%' OR name ILIKE '%Iguazu%' OR name ILIKE '%Victoria Falls%'
        OR name ILIKE '%Petra%' OR name ILIKE '%Pompeii%' OR name ILIKE '%Dolomites%'
        OR name ILIKE '%Milford%Track%' OR name ILIKE '%Galápagos%' OR name ILIKE '%Galapagos%'
        OR name ILIKE '%Angel Falls%' OR name ILIKE '%Kyoto%' OR name ILIKE '%Fushimi Inari%'
      );
      UPDATE seasonal_experiences SET click_count = 62 WHERE click_count = 0 AND (
        name ILIKE '%Tuscany%' OR name ILIKE '%Cinque Terre%' OR name ILIKE '%Cappadocia%'
        OR name ILIKE '%Dubrovnik%' OR name ILIKE '%Ha Long Bay%' OR name ILIKE '%Hoi An%'
        OR name ILIKE '%Bagan%' OR name ILIKE '%Chiang Mai%' OR name ILIKE '%Komodo%'
        OR name ILIKE '%Marrakech%' OR name ILIKE '%Cape Town%' OR name ILIKE '%Zanzibar%'
        OR name ILIKE '%Great Barrier Reef%' OR name ILIKE '%Lofoten%' OR name ILIKE '%Azores%'
        OR name ILIKE '%Hallstatt%' OR name ILIKE '%Lake Bled%' OR name ILIKE '%Kotor%'
        OR name ILIKE '%Edinburgh%' OR name ILIKE '%Reykjavik%'
      );
      UPDATE seasonal_experiences SET click_count = 38 WHERE click_count = 0 AND
        country IN ('Japan','Italy','France','Spain','Portugal','Greece','Thailand',
                    'Indonesia','Mexico','Peru','Colombia','New Zealand','Australia',
                    'Iceland','Norway','Austria','Switzerland','Morocco','India','Nepal','Sri Lanka');
      UPDATE seasonal_experiences SET click_count = 10 WHERE click_count = 0;
    `);
  } catch (err) {
    console.error('seasonal_experiences.click_count migration failed:', err.message);
  }

  // image_attribution on seasonal_experiences for Unsplash compliance (migration 033)
  try {
    await db.query(`
      ALTER TABLE seasonal_experiences ADD COLUMN IF NOT EXISTS image_attribution JSONB;
    `);
  } catch (err) {
    console.error('seasonal_experiences.image_attribution migration failed:', err.message);
  }

  // venues + pin_venues (migration 034)
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS venues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('national_park', 'ski_resort')),
        country TEXT,
        region TEXT,
        latitude NUMERIC(9,6),
        longitude NUMERIC(9,6),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS venues_type_idx ON venues(type);
      CREATE TABLE IF NOT EXISTS pin_venues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
        venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
        UNIQUE(pin_id, venue_id)
      );
      CREATE INDEX IF NOT EXISTS pin_venues_pin_idx ON pin_venues(pin_id);
      CREATE INDEX IF NOT EXISTS pin_venues_venue_idx ON pin_venues(venue_id);
    `);
    // Seed venue data if table is empty
    const { rows } = await db.query('SELECT COUNT(*) as cnt FROM venues');
    if (parseInt(rows[0].cnt) === 0) {
      const { seedVenues } = require('./scripts/seed-venues');
      await seedVenues(db);
    }
  } catch (err) {
    console.error('venues migration failed:', err.message);
  }
}

runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Startup migration error:', err.message);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (migration error above)`);
  });
});

