// Tag routes for Travel Together
//
// Spec: docs/app/spec.md (Section 3: Tag Endpoints)
// Contract: docs/app/spec.md

const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/tags -- List all tags (experience + user's custom)
// @implements REQ-MEMORY-003, SCN-MEMORY-003-01
router.get('/', async (req, res) => {
  try {
    const experienceResult = await db.query(
      `SELECT id, name, emoji, description, gradient_start, gradient_end, sort_order
       FROM experience_tags
       ORDER BY sort_order`
    );

    const customResult = await db.query(
      `SELECT id, name FROM custom_tags WHERE user_id = $1 ORDER BY name`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: {
        experienceTags: experienceResult.rows.map(r => ({
          id: r.id,
          name: r.name,
          emoji: r.emoji,
          description: r.description,
          gradientStart: r.gradient_start,
          gradientEnd: r.gradient_end,
          sortOrder: r.sort_order
        })),
        customTags: customResult.rows.map(r => ({
          id: r.id,
          name: r.name
        }))
      }
    });
  } catch (error) {
    console.error('List tags error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/tags/custom -- Create custom tag
// @implements REQ-MEMORY-003
router.post('/custom', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required'
      });
    }

    // Check for existing custom tag with same name for this user
    const existing = await db.query(
      'SELECT id FROM custom_tags WHERE user_id = $1 AND name = $2',
      [req.user.id, name.trim()]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Tag already exists'
      });
    }

    const result = await db.query(
      `INSERT INTO custom_tags (user_id, name) VALUES ($1, $2) RETURNING id, name`,
      [req.user.id, name.trim()]
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name
      }
    });
  } catch (error) {
    console.error('Create custom tag error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
