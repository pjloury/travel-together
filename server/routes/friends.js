const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Helper to order user IDs consistently
function orderUserIds(id1, id2) {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

// POST /api/friends/request - send friend request
router.post('/request', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    // Can't friend yourself
    if (userId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot send friend request to yourself' 
      });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Order IDs consistently
    const [userId1, userId2] = orderUserIds(req.user.id, userId);

    // Check for existing friendship/request
    const existing = await db.query(
      'SELECT id, status FROM friendships WHERE user_id_1 = $1 AND user_id_2 = $2',
      [userId1, userId2]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Friend request already exists' 
      });
    }

    // Create friendship request
    const result = await db.query(
      `INSERT INTO friendships (user_id_1, user_id_2, status, requested_by)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id, status, created_at`,
      [userId1, userId2, req.user.id]
    );

    const friendship = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.created_at
      }
    });

  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/friends/pending - list incoming pending requests
router.get('/pending', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT f.id, f.status, f.created_at, f.requested_by,
              u.id as requester_id, u.username, u.display_name
       FROM friendships f
       JOIN users u ON u.id = f.requested_by
       WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND f.status = 'pending'
         AND f.requested_by != $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        requestedBy: {
          id: r.requester_id,
          username: r.username,
          displayName: r.display_name
        }
      }))
    });

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/friends - list accepted friends
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        f.id as friendship_id,
        u.id, u.username, u.display_name,
        (SELECT COUNT(*) FROM country_visits cv WHERE cv.user_id = u.id) as total_countries
       FROM friendships f
       JOIN users u ON (
         CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END = u.id
       )
       WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND f.status = 'accepted'
       ORDER BY u.display_name`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name,
        totalCountries: parseInt(r.total_countries),
        friendshipId: r.friendship_id
      }))
    });

  } catch (error) {
    console.error('Get friends list error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/friends/accept/:friendshipId - accept pending request
router.post('/accept/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;

    // Get the friendship
    const friendshipResult = await db.query(
      `SELECT id, user_id_1, user_id_2, status, requested_by 
       FROM friendships WHERE id = $1`,
      [friendshipId]
    );

    if (friendshipResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Friend request not found' });
    }

    const friendship = friendshipResult.rows[0];

    // Check user is part of this friendship
    if (friendship.user_id_1 !== req.user.id && friendship.user_id_2 !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Can't accept your own request
    if (friendship.requested_by === req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'Cannot accept your own request' 
      });
    }

    // Check it's pending
    if (friendship.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Request already processed' });
    }

    // Accept
    const result = await db.query(
      `UPDATE friendships 
       SET status = 'accepted', accepted_at = NOW()
       WHERE id = $1
       RETURNING id, status, accepted_at`,
      [friendshipId]
    );

    res.json({
      success: true,
      data: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        acceptedAt: result.rows[0].accepted_at
      }
    });

  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/friends/:friendshipId - decline request or remove friend
router.delete('/:friendshipId', async (req, res) => {
  try {
    const { friendshipId } = req.params;

    // Check user is part of this friendship
    const result = await db.query(
      `DELETE FROM friendships 
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       RETURNING id`,
      [friendshipId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Friendship not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete friendship error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

