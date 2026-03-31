// POST /api/invites/send — send an invite email to a non-user companion.
const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

/**
 * POST /api/invites/send
 *
 * Sends an email to a non-app-user inviting them to view the sender's profile
 * and sign up for Travel Together.
 *
 * Body: { email: string }
 * Auth: required
 */
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Valid email required' });
    }

    const inviterName     = req.user.displayName || req.user.display_name || 'A friend';
    const inviterUsername = req.user.username || null;

    const result = await sendInviteEmail({ toEmail: email, inviterName, inviterUsername });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Invite email error:', err);
    res.status(500).json({ success: false, error: 'Could not send invite' });
  }
});

module.exports = router;
