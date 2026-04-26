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
});

