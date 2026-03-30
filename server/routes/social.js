// Social routes for Travel Together
//
// Spec: docs/app/spec.md (Section 8: Social Layer)
// Contract: docs/app/spec.md

const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Helper to order user IDs consistently for friendship lookup
function orderUserIds(id1, id2) {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

// Helper: get accepted friend user IDs for a user
async function getFriendIds(userId) {
  const result = await db.query(
    `SELECT
       CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS friend_id
     FROM friendships
     WHERE (user_id_1 = $1 OR user_id_2 = $1)
       AND status = 'accepted'`,
    [userId]
  );
  return result.rows.map(r => r.friend_id);
}

// Helper: check if two users are friends (accepted)
async function areFriends(userId1, userId2) {
  const [u1, u2] = orderUserIds(userId1, userId2);
  const result = await db.query(
    `SELECT id FROM friendships
     WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'accepted'`,
    [u1, u2]
  );
  return result.rows.length > 0;
}

/**
 * POST /api/social/inspire/:pinId
 *
 * Creates a dream pin inspired by a friend's dream pin, and notifies the source pin owner.
 *
 * @implements REQ-SOCIAL-003, SCN-SOCIAL-003-01
 *
 * Parameters:
 *   - pinId (path): UUID of the source dream pin
 *
 * Returns:
 *   - 201: The newly created dream pin
 *   - 400: Source pin is not a dream pin
 *   - 403: Source pin owner is not a friend
 *   - 404: Source pin not found
 *   - 409: User already has a dream inspired by this pin
 */
router.post('/inspire/:pinId', async (req, res) => {
  try {
    const { pinId } = req.params;
    const currentUserId = req.user.id;

    // Fetch the source pin
    const sourceResult = await db.query(
      `SELECT p.*, u.display_name AS owner_display_name
       FROM pins p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1`,
      [pinId]
    );

    if (sourceResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }

    const sourcePin = sourceResult.rows[0];

    // Validate: must be a dream pin
    if (sourcePin.pin_type !== 'dream') {
      return res.status(400).json({ success: false, error: 'Can only be inspired by dream pins' });
    }

    // Validate: source pin must belong to a friend
    const isFriend = await areFriends(currentUserId, sourcePin.user_id);
    if (!isFriend) {
      return res.status(403).json({ success: false, error: 'Source pin owner is not a friend' });
    }

    // Edge case: check if user already has an inspired pin from this exact source pin
    const existingCheck = await db.query(
      `SELECT id FROM pins
       WHERE user_id = $1 AND inspired_by_pin_id = $2`,
      [currentUserId, pinId]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'You already have a dream inspired by this pin'
      });
    }

    // Create the new dream pin copying fields from source
    const newPinResult = await db.query(
      `INSERT INTO pins (
        user_id, pin_type, place_name, ai_summary,
        unsplash_image_url, unsplash_attribution,
        inspired_by_pin_id, inspired_by_user_id, inspired_by_display_name,
        normalized_city, normalized_country, normalized_region,
        latitude, longitude, location_confidence, location_verified
      )
      VALUES ($1, 'dream', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      [
        currentUserId,
        sourcePin.place_name,
        sourcePin.ai_summary || null,
        sourcePin.unsplash_image_url || null,
        sourcePin.unsplash_attribution || null,
        pinId,
        sourcePin.user_id,
        sourcePin.owner_display_name,
        sourcePin.normalized_city || null,
        sourcePin.normalized_country || null,
        sourcePin.normalized_region || null,
        sourcePin.latitude || null,
        sourcePin.longitude || null,
        sourcePin.location_confidence || null,
        sourcePin.location_verified || false
      ]
    );

    const newPin = newPinResult.rows[0];

    // Copy tags from source pin
    const sourceTags = await db.query(
      `SELECT experience_tag_id, custom_tag_id, sort_order
       FROM pin_tags
       WHERE pin_id = $1
       ORDER BY sort_order`,
      [pinId]
    );

    for (const tag of sourceTags.rows) {
      if (tag.experience_tag_id) {
        await db.query(
          `INSERT INTO pin_tags (pin_id, experience_tag_id, sort_order)
           VALUES ($1, $2, $3)`,
          [newPin.id, tag.experience_tag_id, tag.sort_order]
        );
      } else if (tag.custom_tag_id) {
        // For custom tags, we need to find-or-create for the current user
        const sourceCustom = await db.query(
          `SELECT name FROM custom_tags WHERE id = $1`,
          [tag.custom_tag_id]
        );
        if (sourceCustom.rows.length > 0) {
          const tagName = sourceCustom.rows[0].name;
          let customTagResult = await db.query(
            `SELECT id FROM custom_tags WHERE user_id = $1 AND name = $2`,
            [currentUserId, tagName]
          );
          if (customTagResult.rows.length === 0) {
            customTagResult = await db.query(
              `INSERT INTO custom_tags (user_id, name) VALUES ($1, $2) RETURNING id`,
              [currentUserId, tagName]
            );
          }
          await db.query(
            `INSERT INTO pin_tags (pin_id, custom_tag_id, sort_order)
             VALUES ($1, $2, $3)`,
            [newPin.id, customTagResult.rows[0].id, tag.sort_order]
          );
        }
      }
    }

    // Create notification for source pin owner
    const displayText = `${req.user.display_name} saved a dream inspired by your ${sourcePin.place_name} pin`;
    await db.query(
      `INSERT INTO notifications (user_id, actor_id, notification_type, pin_id, display_text)
       VALUES ($1, $2, 'inspired', $3, $4)`,
      [sourcePin.user_id, currentUserId, pinId, displayText]
    );

    // Return the full new pin with tags
    const fullPin = await getFullPin(newPin.id);
    res.status(201).json({ success: true, data: fullPin });
  } catch (error) {
    console.error('Inspire pin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/social/annotations
 *
 * Returns social annotations for all of the current user's pins in a given tab.
 * For each pin, finds friends with related pins in the opposite tab (matching normalized_region).
 *
 * @implements REQ-SOCIAL-001, SCN-SOCIAL-001-01, SCN-SOCIAL-001-02, REQ-DISCOVERY-001, REQ-DISCOVERY-002
 *
 * Query params:
 *   - tab (required): 'memory' or 'dream'
 *
 * Returns:
 *   - { annotations: { [pinId]: { friends: [{ userId, displayName, avatarUrl }], count: N } } }
 */
router.get('/annotations', async (req, res) => {
  try {
    const { tab } = req.query;
    const currentUserId = req.user.id;

    if (!tab || (tab !== 'memory' && tab !== 'dream')) {
      return res.status(400).json({ success: false, error: 'Query param "tab" is required and must be "memory" or "dream"' });
    }

    // The opposite pin type to match against
    const oppositeType = tab === 'memory' ? 'dream' : 'memory';

    // Single batch query: find all friends' opposite-type pins matching each of the user's pins by normalized_region
    const result = await db.query(
      `SELECT
         up.id AS user_pin_id,
         fp.user_id AS friend_user_id,
         u.display_name,
         u.avatar_url
       FROM pins up
       JOIN pins fp ON fp.normalized_region = up.normalized_region
         AND fp.pin_type = $2
         AND fp.archived = false
         AND fp.location_verified = true
       JOIN friendships f ON f.status = 'accepted'
         AND ((f.user_id_1 = $1 AND f.user_id_2 = fp.user_id)
           OR (f.user_id_2 = $1 AND f.user_id_1 = fp.user_id))
       JOIN users u ON u.id = fp.user_id
       WHERE up.user_id = $1
         AND up.pin_type = $3
         AND up.archived = false
         AND up.location_verified = true`,
      [currentUserId, oppositeType, tab]
    );

    // Group by user_pin_id, deduplicate friends per pin
    const annotationsMap = {};
    for (const row of result.rows) {
      if (!annotationsMap[row.user_pin_id]) {
        annotationsMap[row.user_pin_id] = new Map();
      }
      // Deduplicate by friend_user_id
      if (!annotationsMap[row.user_pin_id].has(row.friend_user_id)) {
        annotationsMap[row.user_pin_id].set(row.friend_user_id, {
          userId: row.friend_user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url
        });
      }
    }

    // Also fetch all user pins for this tab so we include pins with zero matches
    const userPinsResult = await db.query(
      `SELECT id FROM pins WHERE user_id = $1 AND pin_type = $2 AND archived = false`,
      [currentUserId, tab]
    );

    const annotations = {};
    for (const pin of userPinsResult.rows) {
      const friendsMap = annotationsMap[pin.id];
      const allFriends = friendsMap ? Array.from(friendsMap.values()) : [];
      annotations[pin.id] = {
        friends: allFriends.slice(0, 3),
        count: allFriends.length
      };
    }

    res.json({ success: true, data: { annotations } });
  } catch (error) {
    console.error('Get annotations error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/social/annotations/:userId
 *
 * Returns cross-annotations from the viewer's perspective when viewing another user's board.
 * For each of the board owner's pins, checks if the viewer has related pins in the same region.
 *
 * @implements REQ-NAV-006
 *
 * Query params:
 *   - tab (required): 'memory' or 'dream'
 *
 * Returns:
 *   - { success: true, data: { [pinId]: { viewerDreams?, viewerDreamPinId?, viewerHasBeen?, viewerMemoryPinId?, viewerAlsoDreams? } } }
 *   - 403: Must be friends to view annotations
 */
router.get('/annotations/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;
    const { tab } = req.query;

    if (!tab || (tab !== 'memory' && tab !== 'dream')) {
      return res.status(400).json({ success: false, error: 'Query param "tab" is required and must be "memory" or "dream"' });
    }

    // Verify friendship between viewer and board owner
    const isFriend = await areFriends(viewerId, userId);
    if (!isFriend) {
      return res.status(403).json({ success: false, error: 'Must be friends to view annotations' });
    }

    // Get board owner's pins of the specified tab type (non-archived, location_verified)
    const ownerPinsResult = await db.query(
      `SELECT id, normalized_region FROM pins
       WHERE user_id = $1 AND pin_type = $2 AND archived = false AND location_verified = true`,
      [userId, tab]
    );

    // Get viewer's non-archived pins
    const viewerPinsResult = await db.query(
      `SELECT id, pin_type, normalized_region FROM pins
       WHERE user_id = $1 AND archived = false`,
      [viewerId]
    );

    // Index viewer's pins by normalized_region for fast lookup
    const viewerDreamsByRegion = {};
    const viewerMemoriesByRegion = {};
    for (const pin of viewerPinsResult.rows) {
      if (!pin.normalized_region) continue;
      if (pin.pin_type === 'dream') {
        if (!viewerDreamsByRegion[pin.normalized_region]) {
          viewerDreamsByRegion[pin.normalized_region] = pin.id;
        }
      } else if (pin.pin_type === 'memory') {
        if (!viewerMemoriesByRegion[pin.normalized_region]) {
          viewerMemoriesByRegion[pin.normalized_region] = pin.id;
        }
      }
    }

    // Build annotations map
    const data = {};
    for (const ownerPin of ownerPinsResult.rows) {
      if (!ownerPin.normalized_region) continue;

      const region = ownerPin.normalized_region;

      if (tab === 'memory') {
        // Viewing friend's PAST: check if viewer has dream pins in same region
        const viewerDreamPinId = viewerDreamsByRegion[region];
        if (viewerDreamPinId) {
          data[ownerPin.id] = {
            viewerDreams: true,
            viewerDreamPinId: viewerDreamPinId
          };
        }
      } else if (tab === 'dream') {
        // Viewing friend's FUTURE: check if viewer has memory pins and/or dream pins in same region
        const viewerMemoryPinId = viewerMemoriesByRegion[region];
        const viewerDreamPinId = viewerDreamsByRegion[region];

        if (viewerMemoryPinId || viewerDreamPinId) {
          const annotation = {};
          if (viewerMemoryPinId) {
            annotation.viewerHasBeen = true;
            annotation.viewerMemoryPinId = viewerMemoryPinId;
          }
          annotation.viewerAlsoDreams = !!viewerDreamPinId;
          data[ownerPin.id] = annotation;
        }
      }
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get annotations for user error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/social/travel-together
 *
 * Returns dream pins that both the current user and at least one friend have pinned,
 * matching by normalized_region.
 *
 * @implements REQ-SOCIAL-002, SCN-SOCIAL-002-01
 *
 * Returns:
 *   - { matches: [{ region, userPin, friendMatches: [...] }] }
 */
router.get('/travel-together', async (req, res) => {
  try {
    const currentUserId = req.user.id;

    // Get friend IDs
    const friendIds = await getFriendIds(currentUserId);
    if (friendIds.length === 0) {
      return res.json({ success: true, data: { matches: [] } });
    }

    // Find dream pins the current user has that are verified and share a region with friends' dream pins
    const result = await db.query(
      `SELECT
         up.id AS user_pin_id,
         up.normalized_region AS region,
         up.place_name AS user_place_name,
         up.pin_type AS user_pin_type,
         up.ai_summary AS user_ai_summary,
         up.unsplash_image_url AS user_unsplash_image_url,
         up.unsplash_attribution AS user_unsplash_attribution,
         up.created_at AS user_created_at,
         up.updated_at AS user_updated_at,
         up.location_verified AS user_location_verified,
         up.normalized_city AS user_normalized_city,
         up.normalized_country AS user_normalized_country,
         up.latitude AS user_latitude,
         up.longitude AS user_longitude,
         up.location_confidence AS user_location_confidence,
         up.note AS user_note,
         up.dream_note AS user_dream_note,
         up.archived AS user_archived,
         fp.id AS friend_pin_id,
         fp.user_id AS friend_user_id,
         u.display_name AS friend_display_name,
         u.avatar_url AS friend_avatar_url
       FROM pins up
       JOIN pins fp ON LOWER(fp.normalized_region) = LOWER(up.normalized_region)
       JOIN users u ON u.id = fp.user_id
       WHERE up.user_id = $1
         AND up.pin_type = 'dream'
         AND up.archived = false
         AND up.location_verified = true
         AND fp.user_id = ANY($2)
         AND fp.pin_type = 'dream'
         AND fp.archived = false
         AND fp.location_verified = true`,
      [currentUserId, friendIds]
    );

    // Group by user pin
    const matchMap = new Map();
    for (const row of result.rows) {
      if (!matchMap.has(row.user_pin_id)) {
        matchMap.set(row.user_pin_id, {
          region: row.region,
          userPin: {
            id: row.user_pin_id,
            pinType: row.user_pin_type,
            placeName: row.user_place_name,
            normalizedRegion: row.region,
            normalizedCity: row.user_normalized_city,
            normalizedCountry: row.user_normalized_country,
            latitude: row.user_latitude,
            longitude: row.user_longitude,
            locationConfidence: row.user_location_confidence,
            locationVerified: row.user_location_verified,
            aiSummary: row.user_ai_summary,
            note: row.user_note,
            dreamNote: row.user_dream_note,
            unsplashImageUrl: row.user_unsplash_image_url,
            unsplashAttribution: row.user_unsplash_attribution,
            archived: row.user_archived,
            createdAt: row.user_created_at,
            updatedAt: row.user_updated_at
          },
          friendMatches: []
        });
      }
      matchMap.get(row.user_pin_id).friendMatches.push({
        userId: row.friend_user_id,
        displayName: row.friend_display_name,
        avatarUrl: row.friend_avatar_url,
        pinId: row.friend_pin_id
      });
    }

    const matches = Array.from(matchMap.values());

    res.json({ success: true, data: { matches } });
  } catch (error) {
    console.error('Travel together error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper: format a pin row to camelCase response (same as pins.js)
function formatPin(row) {
  return {
    id: row.id,
    pinType: row.pin_type,
    placeName: row.place_name,
    normalizedCity: row.normalized_city,
    normalizedCountry: row.normalized_country,
    normalizedRegion: row.normalized_region,
    latitude: row.latitude,
    longitude: row.longitude,
    locationConfidence: row.location_confidence,
    locationVerified: row.location_verified,
    aiSummary: row.ai_summary,
    note: row.note,
    transcript: row.transcript,
    correctionTranscript: row.correction_transcript,
    photoUrl: row.photo_url,
    photoSource: row.photo_source,
    unsplashImageUrl: row.unsplash_image_url,
    unsplashAttribution: row.unsplash_attribution,
    visitYear: row.visit_year,
    rating: row.rating,
    dreamNote: row.dream_note,
    archived: row.archived,
    inspiredByPinId: row.inspired_by_pin_id,
    inspiredByUserId: row.inspired_by_user_id,
    inspiredByDisplayName: row.inspired_by_display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Helper: fetch tags for a pin (same as pins.js)
async function getTagsForPin(pinId) {
  const result = await db.query(
    `SELECT pt.id as pin_tag_id, pt.experience_tag_id, pt.custom_tag_id, pt.sort_order,
            et.name as et_name, et.emoji as et_emoji,
            ct.name as ct_name
     FROM pin_tags pt
     LEFT JOIN experience_tags et ON pt.experience_tag_id = et.id
     LEFT JOIN custom_tags ct ON pt.custom_tag_id = ct.id
     WHERE pt.pin_id = $1
     ORDER BY pt.sort_order`,
    [pinId]
  );
  return result.rows.map(r => {
    if (r.experience_tag_id) {
      return { id: r.experience_tag_id, name: r.et_name, emoji: r.et_emoji, type: 'experience' };
    }
    return { id: r.custom_tag_id, name: r.ct_name, type: 'custom' };
  });
}

// Helper: fetch resources for a pin (same as pins.js)
async function getResourcesForPin(pinId) {
  const result = await db.query(
    `SELECT id, source_url, domain_name, photo_url, excerpt, sort_order, created_at
     FROM pin_resources
     WHERE pin_id = $1
     ORDER BY sort_order`,
    [pinId]
  );
  return result.rows.map(r => ({
    id: r.id,
    sourceUrl: r.source_url,
    domainName: r.domain_name,
    photoUrl: r.photo_url,
    excerpt: r.excerpt,
    sortOrder: r.sort_order,
    createdAt: r.created_at
  }));
}

// Helper: get full pin with tags and resources (same as pins.js)
async function getFullPin(pinId) {
  const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [pinId]);
  if (pinResult.rows.length === 0) return null;
  const pin = formatPin(pinResult.rows[0]);
  pin.tags = await getTagsForPin(pinId);
  pin.resources = await getResourcesForPin(pinId);

  const topResult = await db.query(
    'SELECT sort_order FROM top_pins WHERE pin_id = $1',
    [pinId]
  );
  if (topResult.rows.length > 0) {
    pin.isTop8 = true;
    pin.top8Order = topResult.rows[0].sort_order;
  } else {
    pin.isTop8 = false;
    pin.top8Order = null;
  }

  return pin;
}

module.exports = router;
