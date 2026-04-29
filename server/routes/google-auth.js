const express = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');

const router = express.Router();

// Singleton verifier — fetches and caches Google's JWKs internally so we
// don't hit Google on every login. Aud check happens inside verifyIdToken
// (we pass GOOGLE_CLIENT_ID as the expected audience), and signature is
// verified against the JWKs the library pulls from
// https://www.googleapis.com/oauth2/v3/certs.
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Handle Google OAuth sign-in
 * Body: { credential } - Google ID token from frontend
 */
router.post('/', async (req, res) => {
  try {
    const { credential, ref } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, error: 'Google credential is required' });
    }

    // Verify the Google ID token
    const googleUserInfo = await verifyGoogleToken(credential);
    
    if (!googleUserInfo) {
      return res.status(401).json({ success: false, error: 'Invalid Google credential' });
    }

    const { googleId, email, name, picture } = googleUserInfo;

    // Check if user exists with this Google ID
    let userResult = await db.query(
      'SELECT id, email, username, display_name, avatar_url FROM users WHERE google_id = $1',
      [googleId]
    );

    let user = userResult.rows[0];
    let isNewUser = false;

    if (!user) {
      // Check if user exists with this email (might have registered with password)
      userResult = await db.query(
        'SELECT id, email, username, display_name, google_id, avatar_url FROM users WHERE email = $1',
        [email]
      );
      
      user = userResult.rows[0];

      if (user) {
        // Link Google account to existing user
        await db.query(
          `UPDATE users 
           SET google_id = $1, avatar_url = COALESCE(avatar_url, $2), auth_provider = 'google'
           WHERE id = $3`,
          [googleId, picture, user.id]
        );
        user.avatar_url = user.avatar_url || picture;
      } else {
        // Create new user
        isNewUser = true;
        const username = generateUsername(email, name);
        
        const insertResult = await db.query(
          `INSERT INTO users (email, username, display_name, google_id, avatar_url, auth_provider, password_hash)
           VALUES ($1, $2, $3, $4, $5, 'google', '')
           RETURNING id, email, username, display_name, avatar_url`,
          [email, username, name, googleId, picture]
        );
        
        user = insertResult.rows[0];
      }
    }

    // Auto-friend the inviter if registered via invite link (new users only)
    let inviterId = null;
    if (isNewUser && ref) {
      try {
        const inviteResult = await db.query(
          'SELECT user_id FROM invite_links WHERE code = $1',
          [ref]
        );
        if (inviteResult.rows.length > 0) {
          inviterId = inviteResult.rows[0].user_id;
          if (inviterId !== user.id) {
            const [uid1, uid2] = inviterId < user.id
              ? [inviterId, user.id]
              : [user.id, inviterId];
            await db.query(
              `INSERT INTO friendships (user_id_1, user_id_2, status, requested_by)
               VALUES ($1, $2, 'accepted', $3)
               ON CONFLICT DO NOTHING`,
              [uid1, uid2, inviterId]
            );
            console.log(`[auth] Auto-friended ${user.id} with inviter ${inviterId} (Google)`);
          } else {
            inviterId = null; // Don't redirect to self
          }
        }
      } catch (err) {
        console.warn('[auth] Auto-friend failed (Google):', err.message);
      }
    }

    // Claim any pending memory-tag invites that were sent to this
    // user's email — same logic as the email/password register path.
    let claimedTagsCount = 0;
    if (isNewUser) {
      try {
        const pending = await db.query(
          `SELECT pt.id, pt.pin_id
           FROM pending_tags pt
           WHERE lower(pt.invite_email) = lower($1)
             AND pt.claimed_by_user_id IS NULL`,
          [user.email]
        );
        const displayName = user.display_name;
        for (const row of pending.rows) {
          const pinRow = await db.query('SELECT companions FROM pins WHERE id = $1', [row.pin_id]);
          const current = pinRow.rows[0]?.companions || [];
          if (!current.includes(displayName)) {
            await db.query(
              'UPDATE pins SET companions = $1, updated_at = NOW() WHERE id = $2',
              [[...current, displayName], row.pin_id]
            );
          }
          await db.query(
            'UPDATE pending_tags SET claimed_by_user_id = $1, claimed_at = NOW() WHERE id = $2',
            [user.id, row.id]
          );
          claimedTagsCount++;
        }
      } catch (err) {
        console.warn('[auth] Pending tag claim failed (Google):', err.message);
      }
    }

    // Generate JWT (90-day lifetime — see note in routes/auth.js).
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      },
      isNewUser,
      ...(inviterId ? { inviterId } : {}),
      ...(claimedTagsCount ? { claimedTagsCount } : {}),
    });
  } catch (error) {
    // Log full error server-side; return a generic message to the client
    // so we don't leak SQL/Stack details over the wire.
    console.error('[auth/google] Unexpected error:', error.message, error.stack);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

/**
 * Verify a Google ID token end-to-end:
 *   1. Cryptographic signature against Google's JWKs (RSA / RS256)
 *   2. iss == accounts.google.com
 *   3. aud == our GOOGLE_CLIENT_ID
 *   4. exp not in the past
 *   5. email_verified == true (rejects unverified Workspace orgs that
 *      could otherwise spoof an existing account's email)
 *
 * Returns null on ANY failure so the caller hands back a generic 401
 * instead of leaking which check failed.
 */
async function verifyGoogleToken(credential) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.error('[auth/google] GOOGLE_CLIENT_ID not configured — refusing to verify token');
    return null;
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) throw new Error('No payload in verified token');

    // Issuer check (verifyIdToken validates iss internally, but belt and
    // suspenders — accept both the with- and without-https forms Google
    // has shipped over the years).
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      throw new Error('Invalid token issuer');
    }

    // Reject unverified emails — a Google Workspace admin could otherwise
    // create an account with email=victim@gmail.com and we'd link to the
    // existing victim account by email match.
    if (payload.email_verified !== true) {
      throw new Error('Google email not verified');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || null,
    };
  } catch (error) {
    console.error('[auth/google] Token verification failed:', error.message);
    return null;
  }
}

/**
 * Generate a unique username from email/name
 */
function generateUsername(email, name) {
  // Create base username from name or email
  const base = name 
    ? name.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)
    : email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
  
  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).slice(2, 6);
  
  return `${base}_${suffix}`;
}

module.exports = router;

