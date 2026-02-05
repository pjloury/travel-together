const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/users/search?q=searchterm - search users
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q}%`;

    const result = await db.query(
      `SELECT id, username, display_name, email
       FROM users
       WHERE id != $1
         AND (username ILIKE $2 OR email ILIKE $2)
       ORDER BY username
       LIMIT 20`,
      [req.user.id, searchTerm]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name
      }))
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

