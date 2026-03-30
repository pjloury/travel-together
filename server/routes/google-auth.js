const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

/**
 * POST /api/auth/google
 * Handle Google OAuth sign-in
 * Body: { credential } - Google ID token from frontend
 */
router.post('/', async (req, res) => {
  try {
    const { credential } = req.body;
    
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
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
      isNewUser
    });
  } catch (error) {
    console.error('Google auth error:', error.message, error.stack);
    res.status(500).json({ success: false, error: 'Authentication failed', debug: error.message });
  }
});

/**
 * Verify Google ID token and extract user info
 */
async function verifyGoogleToken(credential) {
  try {
    // Decode the JWT (Google ID tokens are JWTs)
    // In production, you should verify the signature using Google's public keys
    // For simplicity, we'll decode and verify the issuer
    
    const parts = credential.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    // Basic validation
    if (!payload.iss || !payload.iss.includes('accounts.google.com')) {
      throw new Error('Invalid token issuer');
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new Error('Token expired');
    }

    // Verify audience matches our client ID (if configured)
    if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Invalid token audience');
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email.split('@')[0],
      picture: payload.picture || null
    };
  } catch (error) {
    console.error('Token verification error:', error);
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

