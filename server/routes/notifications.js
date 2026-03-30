// Notification routes for Travel Together
//
// Spec: docs/app/spec.md (Section 8: Social Layer - Notifications)
// Contract: docs/app/spec.md

const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/notifications
 *
 * Returns current user's notifications, newest first.
 * Joins with users table to get actor display_name and avatar_url.
 *
 * @implements REQ-NOTIF-001, SCN-NOTIF-001-01
 *
 * Query params:
 *   - unreadOnly (optional): if "true", returns only unread notifications
 *
 * Returns:
 *   - { notifications: [...], unreadCount: N }
 */
router.get('/', async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    const currentUserId = req.user.id;

    let whereClause = 'n.user_id = $1';
    const params = [currentUserId];

    if (unreadOnly === 'true') {
      whereClause += ' AND n.read = false';
    }

    const result = await db.query(
      `SELECT n.id, n.notification_type, n.pin_id, n.read, n.display_text, n.created_at,
              u.id AS actor_id, u.display_name AS actor_display_name, u.avatar_url AS actor_avatar_url
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       WHERE ${whereClause}
       ORDER BY n.created_at DESC`,
      params
    );

    // Get unread count (always, regardless of filter)
    const unreadResult = await db.query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = $1 AND read = false`,
      [currentUserId]
    );

    const notifications = result.rows.map(r => ({
      id: r.id,
      notificationType: r.notification_type,
      pinId: r.pin_id,
      read: r.read,
      displayText: r.display_text,
      createdAt: r.created_at,
      actor: {
        id: r.actor_id,
        displayName: r.actor_display_name,
        avatarUrl: r.actor_avatar_url
      }
    }));

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: parseInt(unreadResult.rows[0].cnt, 10)
      }
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/notifications/read
 *
 * Marks specified (or all) notifications as read for the current user.
 *
 * @implements REQ-NOTIF-001
 *
 * Body:
 *   - { notificationIds: [uuid, ...] } OR { all: true }
 *
 * Returns:
 *   - { success: true }
 */
router.put('/read', async (req, res) => {
  try {
    const { notificationIds, all } = req.body;
    const currentUserId = req.user.id;

    if (all === true) {
      await db.query(
        `UPDATE notifications SET read = true WHERE user_id = $1 AND read = false`,
        [currentUserId]
      );
    } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      await db.query(
        `UPDATE notifications SET read = true
         WHERE id = ANY($1) AND user_id = $2`,
        [notificationIds, currentUserId]
      );
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide notificationIds array or { all: true }'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
