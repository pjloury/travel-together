// Search routes for Travel Together
//
// Spec: docs/app/spec.md (REQ-NAV-005: User Search)
// Contract: docs/app/spec.md

const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/search/users
 *
 * Searches users by display_name or username prefix match.
 * Returns user cards with pin counts and top tags.
 *
 * @implements REQ-NAV-005, SCN-NAV-005-01
 *
 * Query params:
 *   - q (required, min 2 chars): search query
 *
 * Returns:
 *   - Array of { userId, displayName, username, avatarUrl, memoryCount, dreamCount, topTags }
 *   - Limit 20 results
 *   - Excludes current user
 *   - No friendship filter (global search)
 */
router.get('/users', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchTerm = q + '%';

    // Get matching users with pin counts in a single query
    const result = await db.query(
      `SELECT
         u.id,
         u.display_name,
         u.username,
         u.avatar_url,
         COALESCE(mc.cnt, 0) AS memory_count,
         COALESCE(dc.cnt, 0) AS dream_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM pins
         WHERE user_id = u.id AND pin_type = 'memory' AND archived = false
       ) mc ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS cnt FROM pins
         WHERE user_id = u.id AND pin_type = 'dream' AND archived = false
       ) dc ON true
       WHERE u.id != $1
         AND (u.display_name ILIKE $2 OR u.username ILIKE $2)
       ORDER BY u.display_name
       LIMIT 20`,
      [req.user.id, searchTerm]
    );

    const userIds = result.rows.map(r => r.id);

    // Batch: get top tags for all result users in one query
    let tagsByUser = {};
    if (userIds.length > 0) {
      const tagsResult = await db.query(
        `SELECT pt.user_id, et.name, et.emoji, COUNT(*) as use_count
         FROM (
           SELECT p.user_id, pt.experience_tag_id
           FROM pins p
           JOIN pin_tags pt ON pt.pin_id = p.id
           WHERE p.user_id = ANY($1) AND p.archived = false AND pt.experience_tag_id IS NOT NULL
         ) pt
         JOIN experience_tags et ON et.id = pt.experience_tag_id
         GROUP BY pt.user_id, et.name, et.emoji
         ORDER BY pt.user_id, use_count DESC`,
        [userIds]
      );
      for (const t of tagsResult.rows) {
        if (!tagsByUser[t.user_id]) tagsByUser[t.user_id] = [];
        if (tagsByUser[t.user_id].length < 3) {
          tagsByUser[t.user_id].push({ name: t.name, emoji: t.emoji });
        }
      }
    }

    // Batch: check which result users are friends with the current user
    let friendSet = new Set();
    if (userIds.length > 0) {
      const friendResult = await db.query(
        `SELECT user_id_1, user_id_2 FROM friendships
         WHERE status = 'accepted'
         AND (
           (user_id_1 = $1 AND user_id_2 = ANY($2))
           OR (user_id_2 = $1 AND user_id_1 = ANY($2))
         )`,
        [req.user.id, userIds]
      );
      for (const r of friendResult.rows) {
        const friendId = r.user_id_1 === req.user.id ? r.user_id_2 : r.user_id_1;
        friendSet.add(friendId);
      }
    }

    const users = result.rows.map(row => ({
      userId: row.id,
      displayName: row.display_name,
      username: row.username,
      avatarUrl: row.avatar_url,
      memoryCount: parseInt(row.memory_count, 10),
      dreamCount: parseInt(row.dream_count, 10),
      topTags: tagsByUser[row.id] || [],
      isFriend: friendSet.has(row.id)
    }));

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
