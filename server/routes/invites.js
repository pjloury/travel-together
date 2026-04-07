// Invite routes — shareable invite links + email invitations
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

/**
 * POST /api/invites/link
 * Generate (or return existing) shareable invite link for the current user.
 * Each user gets one persistent invite code.
 */
router.post('/link', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check for existing code
    const existing = await db.query(
      'SELECT code FROM invite_links WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length > 0) {
      const frontendUrl = process.env.FRONTEND_URL || 'https://travel-together.vercel.app';
      return res.json({
        success: true,
        code: existing.rows[0].code,
        link: `${frontendUrl}/join/${existing.rows[0].code}`,
      });
    }

    // Generate new code
    const code = crypto.randomBytes(6).toString('hex'); // 12-char hex
    await db.query(
      'INSERT INTO invite_links (user_id, code) VALUES ($1, $2)',
      [userId, code]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://travel-together.vercel.app';
    res.json({
      success: true,
      code,
      link: `${frontendUrl}/join/${code}`,
    });
  } catch (err) {
    console.error('[invites] link error:', err.message);
    res.status(500).json({ success: false, error: 'Could not generate invite link' });
  }
});

/**
 * GET /api/invites/info/:code
 * Public — returns inviter info for the invite landing page.
 */
router.get('/info/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const result = await db.query(
      `SELECT u.id, u.display_name, u.username, u.avatar_url,
              (SELECT COUNT(*) FROM pins WHERE user_id = u.id AND pin_type = 'memory' AND archived = false)::int AS memory_count,
              (SELECT COUNT(*) FROM pins WHERE user_id = u.id AND pin_type = 'dream' AND archived = false)::int AS dream_count
       FROM invite_links il
       JOIN users u ON u.id = il.user_id
       WHERE il.code = $1`,
      [code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Invite not found' });
    }

    const inviter = result.rows[0];
    res.json({
      success: true,
      inviter: {
        id: inviter.id,
        displayName: inviter.display_name,
        username: inviter.username,
        avatarUrl: inviter.avatar_url,
        memoryCount: inviter.memory_count,
        dreamCount: inviter.dream_count,
      },
    });
  } catch (err) {
    console.error('[invites] info error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load invite info' });
  }
});

/**
 * POST /api/invites/send
 * Send email invitation(s). Accepts a single email or array of emails.
 */
router.post('/send', authenticateToken, async (req, res) => {
  try {
    let { email, emails } = req.body;

    // Support both single email and array
    const emailList = emails || (email ? [email] : []);
    const validEmails = emailList
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (validEmails.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one valid email required' });
    }

    const inviterName = req.user.displayName || req.user.display_name || 'A friend';
    const inviterUsername = req.user.username || null;

    const results = [];
    for (const toEmail of validEmails) {
      try {
        const result = await sendInviteEmail({ toEmail, inviterName, inviterUsername });
        results.push({ email: toEmail, ...result });
      } catch (err) {
        results.push({ email: toEmail, error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error('Invite email error:', err);
    res.status(500).json({ success: false, error: 'Could not send invites' });
  }
});

module.exports = router;
