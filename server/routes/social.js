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

    // Match by normalized COUNTRY (not region/continent) — region was too
    // coarse and produced almost no matches because most users haven't
    // spread pins across whole continents. Country-level overlap actually
    // surfaces the "who's been where" pattern users care about.
    //
    // We also drop the location_verified gate. The flag is only set by
    // the background normalizer and lots of perfectly-good city/country
    // pins never get normalized (e.g. quick country-only adds, AI
    // location lookup glitch). Filtering on it hid most legitimate
    // overlaps. We still require normalized_country to be present so
    // the join is meaningful.
    const result = await db.query(
      `SELECT
         up.id AS user_pin_id,
         fp.user_id AS friend_user_id,
         u.display_name,
         u.avatar_url
       FROM pins up
       JOIN pins fp ON fp.normalized_country = up.normalized_country
         AND fp.pin_type = $2
         AND fp.archived = false
         AND fp.normalized_country IS NOT NULL
       JOIN friendships f ON f.status = 'accepted'
         AND ((f.user_id_1 = $1 AND f.user_id_2 = fp.user_id)
           OR (f.user_id_2 = $1 AND f.user_id_1 = fp.user_id))
       JOIN users u ON u.id = fp.user_id
       WHERE up.user_id = $1
         AND up.pin_type = $3
         AND up.archived = false
         AND up.normalized_country IS NOT NULL`,
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

/**
 * GET /api/social/overlap/:friendId
 * Returns travel commonalities between current user and a friend.
 * Categories:
 *   - both_visited: both have memory pins in the same region/country
 *   - both_dream: both have dream pins in the same region/country
 *   - you_visited_they_dream: you have a memory, they have a dream
 *   - they_visited_you_dream: they have a memory, you have a dream
 *   - shared_tags: experience tags you both use frequently
 */
router.get('/overlap/:friendId', async (req, res) => {
  try {
    const userId = req.user.id;
    const friendId = req.params.friendId;

    if (userId === friendId) {
      return res.json({ success: true, data: { overlaps: [], sharedTags: [] } });
    }

    // Verify friendship
    const [uid1, uid2] = userId < friendId ? [userId, friendId] : [friendId, userId];
    const friendCheck = await db.query(
      `SELECT id FROM friendships WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'accepted'`,
      [uid1, uid2]
    );
    if (friendCheck.rows.length === 0) {
      return res.json({ success: true, data: { overlaps: [], sharedTags: [] } });
    }

    // Fetch both users' pins with normalized locations
    const [myPins, theirPins] = await Promise.all([
      db.query(
        `SELECT id, pin_type, place_name, normalized_country, normalized_region, normalized_city
         FROM pins WHERE user_id = $1 AND archived = false AND normalized_country IS NOT NULL`,
        [userId]
      ),
      db.query(
        `SELECT id, pin_type, place_name, normalized_country, normalized_region, normalized_city
         FROM pins WHERE user_id = $1 AND archived = false AND normalized_country IS NOT NULL`,
        [friendId]
      ),
    ]);

    const overlaps = [];
    const seen = new Set();

    // Build lookup maps by region and country
    function buildMap(rows) {
      const byRegion = {};
      const byCountry = {};
      for (const p of rows) {
        const region = (p.normalized_region || '').toLowerCase();
        const country = (p.normalized_country || '').toLowerCase();
        if (region) {
          if (!byRegion[region]) byRegion[region] = [];
          byRegion[region].push(p);
        }
        if (country) {
          if (!byCountry[country]) byCountry[country] = [];
          byCountry[country].push(p);
        }
      }
      return { byRegion, byCountry };
    }

    const myMap = buildMap(myPins.rows);
    const theirMap = buildMap(theirPins.rows);

    // Find overlaps by country (more specific than region)
    function findOverlaps(myType, theirType, category) {
      const myFiltered = myPins.rows.filter(p => p.pin_type === myType);
      for (const mp of myFiltered) {
        const country = (mp.normalized_country || '').toLowerCase();
        if (!country) continue;
        const theirInCountry = (theirMap.byCountry[country] || [])
          .filter(p => p.pin_type === theirType);
        if (theirInCountry.length > 0) {
          const key = `${category}:${country}`;
          if (seen.has(key)) continue;
          seen.add(key);
          overlaps.push({
            category,
            country: mp.normalized_country,
            region: mp.normalized_region,
            myPlace: mp.place_name,
            theirPlace: theirInCountry[0].place_name,
          });
        }
      }
    }

    findOverlaps('memory', 'memory', 'both_visited');
    findOverlaps('dream', 'dream', 'both_dream');
    findOverlaps('memory', 'dream', 'you_visited_they_dream');
    findOverlaps('dream', 'memory', 'they_visited_you_dream');

    // Find shared tags
    const [myTags, theirTags] = await Promise.all([
      db.query(
        `SELECT et.name, COUNT(*)::int as cnt
         FROM pin_tags pt
         JOIN pins p ON p.id = pt.pin_id
         JOIN experience_tags et ON et.id = pt.experience_tag_id
         WHERE p.user_id = $1 AND p.archived = false
         GROUP BY et.name ORDER BY cnt DESC LIMIT 10`,
        [userId]
      ),
      db.query(
        `SELECT et.name, COUNT(*)::int as cnt
         FROM pin_tags pt
         JOIN pins p ON p.id = pt.pin_id
         JOIN experience_tags et ON et.id = pt.experience_tag_id
         WHERE p.user_id = $1 AND p.archived = false
         GROUP BY et.name ORDER BY cnt DESC LIMIT 10`,
        [friendId]
      ),
    ]);

    const myTagSet = new Set(myTags.rows.map(t => t.name));
    const sharedTags = theirTags.rows
      .filter(t => myTagSet.has(t.name))
      .map(t => t.name);

    res.json({
      success: true,
      data: { overlaps: overlaps.slice(0, 15), sharedTags },
    });
  } catch (err) {
    console.error('[social] overlap error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load overlap data' });
  }
});

/**
 * GET /api/social/friends-countries
 *
 * Aggregate view powering the Friends-tab world map. For every country
 * any of the current user's accepted friends has a memory pin in,
 * returns the list of friends who've been there.
 *
 * Response: { data: { countries: [{ country, friends: [{ userId, displayName, avatarUrl }] }] } }
 *
 * Country sources (in priority order, mirroring BoardView's bar):
 *   1. pins.countries[] (multi-country trips)
 *   2. pins.normalized_country (single primary)
 *   3. pin_locations.normalized_country (stop-level)
 *
 * Friends per country are de-duplicated and sorted alphabetically by
 * display name. The endpoint is cheap to call — single SQL plus an
 * in-memory aggregation.
 */
router.get('/friends-countries', async (req, res) => {
  try {
    const userId = req.user.id;

    // Pull every (friend, country) pair plus the matching pin's
    // place_name + a short memory snippet so the FriendsCountriesMap
    // tooltip can show "Sarah — Tokyo, Japan: cherry blossoms in
    // Shibuya" without a second round-trip. Snippet is the first
    // ~80 chars of ai_summary / note (whichever is non-empty).
    const result = await db.query(
      `SELECT
         u.id            AS friend_id,
         u.display_name  AS display_name,
         u.avatar_url    AS avatar_url,
         COALESCE(NULLIF(unnest_country, ''), p.normalized_country) AS country,
         p.id            AS pin_id,
         p.place_name    AS place_name,
         p.ai_summary    AS ai_summary,
         p.note          AS note,
         p.created_at    AS created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END
       JOIN pins p ON p.user_id = u.id
       LEFT JOIN LATERAL unnest(COALESCE(p.countries, ARRAY[]::text[])) AS unnest_country ON true
       WHERE f.status = 'accepted'
         AND (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND p.pin_type = 'memory'
         AND p.archived = false
         AND COALESCE(NULLIF(unnest_country, ''), p.normalized_country) IS NOT NULL
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const stopRows = await db.query(
      `SELECT
         u.id            AS friend_id,
         u.display_name  AS display_name,
         u.avatar_url    AS avatar_url,
         pl.normalized_country AS country,
         p.id            AS pin_id,
         p.place_name    AS place_name,
         p.ai_summary    AS ai_summary,
         p.note          AS note,
         p.created_at    AS created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END
       JOIN pins p ON p.user_id = u.id
       JOIN pin_locations pl ON pl.pin_id = p.id
       WHERE f.status = 'accepted'
         AND (f.user_id_1 = $1 OR f.user_id_2 = $1)
         AND p.pin_type = 'memory'
         AND p.archived = false
         AND pl.normalized_country IS NOT NULL
         AND pl.normalized_country <> ''
       ORDER BY p.created_at DESC`,
      [userId]
    );

    // Aggregate: country → friend → list of memories. Pin set keys on
    // pinId so we don't double-count pins that show up via both the
    // primary country path and pin_locations.
    const SNIPPET_LIMIT = 90;
    function snip(text) {
      if (!text) return null;
      const cleaned = String(text).replace(/\s+/g, ' ').trim();
      if (!cleaned) return null;
      if (cleaned.length <= SNIPPET_LIMIT) return cleaned;
      return cleaned.slice(0, SNIPPET_LIMIT - 1).trimEnd() + '…';
    }
    const map = new Map();
    function add(row) {
      const key = (row.country || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { country: row.country, friends: new Map() });
      }
      const entry = map.get(key);
      if (!entry.friends.has(row.friend_id)) {
        entry.friends.set(row.friend_id, {
          userId: row.friend_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          memories: new Map(), // pinId → { placeName, snippet }
        });
      }
      const fEntry = entry.friends.get(row.friend_id);
      if (!fEntry.memories.has(row.pin_id)) {
        fEntry.memories.set(row.pin_id, {
          pinId: row.pin_id,
          placeName: row.place_name,
          snippet: snip(row.ai_summary) || snip(row.note),
        });
      }
    }
    for (const r of result.rows) add(r);
    for (const r of stopRows.rows) add(r);

    const countries = Array.from(map.values())
      .map(({ country, friends }) => ({
        country,
        friends: Array.from(friends.values())
          .map(f => ({
            userId: f.userId,
            displayName: f.displayName,
            avatarUrl: f.avatarUrl,
            // Cap at 3 memories per friend per country to keep the
            // tooltip readable even on multi-trip overlaps.
            memories: Array.from(f.memories.values()).slice(0, 3),
          }))
          .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '')),
      }))
      .sort((a, b) => a.country.localeCompare(b.country));

    res.json({ success: true, data: { countries } });
  } catch (err) {
    console.error('[social] friends-countries error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load friends countries' });
  }
});

/**
 * GET /api/social/multi-overlap?userIds=u1,u2,u3
 *
 * Powers the multi-friend compare view. Returns the auth user's
 * countries plus the countries of each requested friend, in a flat
 * shape the client can intersect / group by country.
 *
 * Each requested userId MUST be an accepted friend of the auth user
 * (or be the auth user themselves) — otherwise it's silently dropped.
 *
 * Response shape:
 *   {
 *     members: [{ userId, displayName, avatarUrl }],   // includes auth user first
 *     byCountry: [
 *       { country, visitedBy: [userId, ...], dreamingBy: [userId, ...] }
 *     ]
 *   }
 *
 * Country sources mirror /api/social/friends-countries:
 *   1. pins.countries[]
 *   2. pins.normalized_country
 *   3. pin_locations.normalized_country (stop-level)
 */
router.get('/multi-overlap', async (req, res) => {
  try {
    const meId = req.user.id;
    const raw = (req.query.userIds || '').split(',').map(s => s.trim()).filter(Boolean);
    // Always include the auth user. Drop dupes preserving order.
    const requested = [meId, ...raw.filter(id => id !== meId)];

    // Validate friendships in one query — accepts ids that are either
    // the auth user OR an accepted friend.
    const friends = await getFriendIds(meId);
    const friendSet = new Set(friends);
    const allowed = requested.filter(id => id === meId || friendSet.has(id));
    if (allowed.length === 0) {
      return res.json({ success: true, data: { members: [], byCountry: [] } });
    }

    // Fetch the display info for the included users.
    const memberRows = await db.query(
      `SELECT id AS user_id, display_name, avatar_url
       FROM users WHERE id = ANY($1::uuid[])`,
      [allowed]
    );
    const memberMap = new Map(memberRows.rows.map(r => [r.user_id, {
      userId: r.user_id,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
    }]));
    const members = allowed.map(id => memberMap.get(id)).filter(Boolean);

    // Fetch each member's countries x pinType. We do it in two queries
    // (pin-level + stop-level) and merge in JS.
    const pinRows = await db.query(
      `SELECT
         p.user_id,
         p.pin_type,
         COALESCE(NULLIF(unnest_country, ''), p.normalized_country) AS country
       FROM pins p
       LEFT JOIN LATERAL unnest(COALESCE(p.countries, ARRAY[]::text[])) AS unnest_country ON true
       WHERE p.user_id = ANY($1::uuid[])
         AND p.archived = false
         AND COALESCE(NULLIF(unnest_country, ''), p.normalized_country) IS NOT NULL`,
      [allowed]
    );
    const stopRows = await db.query(
      `SELECT p.user_id, p.pin_type, pl.normalized_country AS country
       FROM pins p JOIN pin_locations pl ON pl.pin_id = p.id
       WHERE p.user_id = ANY($1::uuid[])
         AND p.archived = false
         AND pl.normalized_country IS NOT NULL
         AND pl.normalized_country <> ''`,
      [allowed]
    );

    // country (canonical-cased: first occurrence) → { visitedBy: Set, dreamingBy: Set }
    const map = new Map();
    function add(row) {
      const key = (row.country || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, { country: row.country, visitedBy: new Set(), dreamingBy: new Set() });
      }
      const e = map.get(key);
      if (row.pin_type === 'memory') e.visitedBy.add(row.user_id);
      else if (row.pin_type === 'dream') e.dreamingBy.add(row.user_id);
    }
    for (const r of pinRows.rows) add(r);
    for (const r of stopRows.rows) add(r);

    const byCountry = Array.from(map.values())
      .map(({ country, visitedBy, dreamingBy }) => ({
        country,
        visitedBy: Array.from(visitedBy),
        dreamingBy: Array.from(dreamingBy),
      }))
      .sort((a, b) => a.country.localeCompare(b.country));

    res.json({ success: true, data: { members, byCountry } });
  } catch (err) {
    console.error('[social] multi-overlap error:', err.message);
    res.status(500).json({ success: false, error: 'Could not load multi-overlap' });
  }
});

module.exports = router;
