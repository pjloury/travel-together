// User preferences routes for Travel Together
//
// Spec: docs/app/spec.md (Section 3: User Preferences Endpoints)
// Contract: docs/app/spec.md

const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/preferences -- Get user preferences
// @implements REQ-NAV-004, SCN-NAV-004-01
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT last_tab FROM user_preferences WHERE user_id = $1',
      [req.user.id]
    );

    // Default to 'memory' if no preferences row exists yet
    const lastTab = result.rows.length > 0 ? result.rows[0].last_tab : 'memory';

    res.json({
      success: true,
      data: { lastTab }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/preferences -- Update user preferences
// @implements REQ-NAV-004, SCN-NAV-004-01
router.put('/', async (req, res) => {
  try {
    const { lastTab } = req.body;

    if (!lastTab || (lastTab !== 'memory' && lastTab !== 'dream')) {
      return res.status(400).json({
        success: false,
        error: "lastTab must be 'memory' or 'dream'"
      });
    }

    // Upsert preferences
    await db.query(
      `INSERT INTO user_preferences (user_id, last_tab, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET last_tab = $2, updated_at = NOW()`,
      [req.user.id, lastTab]
    );

    res.json({
      success: true,
      data: { lastTab }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
