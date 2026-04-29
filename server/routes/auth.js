const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, displayName, ref } = req.body;

    // Validation
    if (!email || !username || !password || !displayName) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters' 
      });
    }

    // Check for existing email
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already exists' 
      });
    }

    // Check for existing username
    const usernameCheck = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Username already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (email, username, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, display_name, created_at`,
      [email, username, displayName, passwordHash]
    );

    const user = result.rows[0];

    // Auto-friend the inviter if registered via invite link
    let inviterId = null;
    if (ref) {
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
            // Create accepted friendship directly (skip pending)
            await db.query(
              `INSERT INTO friendships (user_id_1, user_id_2, status, requested_by)
               VALUES ($1, $2, 'accepted', $3)
               ON CONFLICT DO NOTHING`,
              [uid1, uid2, inviterId]
            );
            console.log(`[auth] Auto-friended ${user.id} with inviter ${inviterId}`);
          } else {
            inviterId = null; // Don't redirect to self
          }
        }
      } catch (err) {
        // Non-critical — don't block registration if auto-friend fails
        console.warn('[auth] Auto-friend failed:', err.message);
      }
    }

    // Claim any pending tag invites that were sent to this user's
    // email — adds them to the corresponding memories' companions and
    // marks the rows claimed so the inviter sees them flip from
    // "pending" to "tagged" on their next view.
    let claimedTagsCount = 0;
    try {
      const pending = await db.query(
        `SELECT pt.id, pt.pin_id
         FROM pending_tags pt
         WHERE lower(pt.invite_email) = lower($1)
           AND pt.claimed_by_user_id IS NULL`,
        [email]
      );
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
      console.warn('[auth] Pending tag claim failed:', err.message);
    }

    // Mint a JWT so the client can drop the user straight into the
    // app — saves a second round-trip + redundant bcrypt.compare. JWT
    // shape matches /api/auth/login (90-day expiry).
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          createdAt: user.created_at,
        },
        ...(inviterId ? { inviterId } : {}),
        ...(claimedTagsCount ? { claimedTagsCount } : {}),
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user by email
    const result = await db.query(
      'SELECT id, email, username, display_name, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    // Generate JWT (90-day lifetime — long enough that returning users
    // rarely have to re-authenticate, since Google One Tap is unreliable
    // when 3rd-party cookies are blocked). JWT_SECRET is required at
    // boot (server/index.js) so this never falls back to a hardcoded
    // dev secret.
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    res.json({
      success: true,
      data: { token }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/auth/me - Get current user profile (protected)
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.display_name,
      avatarUrl: req.user.avatar_url,
      authProvider: req.user.auth_provider,
      createdAt: req.user.created_at
    }
  });
});

// PUT /api/auth/me - Update current user profile (protected)
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const { displayName, username } = req.body;

    if (!displayName || displayName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Display name is required'
      });
    }

    if (displayName.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Display name must be 100 characters or less'
      });
    }

    if (username && username.trim()) {
      // Validate format: 3-20 chars, alphanumeric + underscores only
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
        return res.status(400).json({
          success: false,
          error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores'
        });
      }

      // Check uniqueness (exclude current user)
      const usernameCheck = await db.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username.trim(), req.user.id]
      );
      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
    }

    let query, params;
    if (username && username.trim()) {
      query = 'UPDATE users SET display_name = $1, username = $2 WHERE id = $3 RETURNING display_name, username';
      params = [displayName.trim(), username.trim(), req.user.id];
    } else {
      query = 'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING display_name, username';
      params = [displayName.trim(), req.user.id];
    }
    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        displayName: result.rows[0].display_name,
        username: result.rows[0].username
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find user
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    // Always return success to prevent email enumeration
    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists, a reset link has been sent'
      });
    }

    const userId = userResult.rows[0].id;

    // Generate token
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    // Send password reset email via Resend
    const { sendPasswordResetEmail } = require('../services/email');
    const emailResult = await sendPasswordResetEmail({ toEmail: email, token });
    if (emailResult.skipped) {
      console.log('PASSWORD RESET LINK (email not configured):');
      console.log(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`);
    }

    res.json({
      success: true,
      message: 'If an account exists, a reset link has been sent'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token and password are required'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    // Find valid token
    const tokenResult = await db.query(
      `SELECT id, user_id FROM password_reset_tokens 
       WHERE token = $1 AND expires_at > NOW() AND used_at IS NULL`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token'
      });
    }

    const { id: tokenId, user_id: userId } = tokenResult.rows[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );

    // Mark token as used
    await db.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [tokenId]
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;

