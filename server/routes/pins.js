// Pin CRUD routes for Travel Together
//
// Spec: docs/app/spec.md (Section 3: Pin Endpoints, Top 8 Endpoints)
// Contract: docs/app/spec.md

const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { normalizeLocation } = require('../services/claude');
const { generatePinImage } = require('../services/imagegen');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * Background location normalization for a pin.
 * Called fire-and-forget after pin creation; does not block the response.
 *
 * @implements REQ-LOCATION-002, SCN-LOCATION-002-01
 *
 * @param {string} pinId - UUID of the pin to update
 * @param {string} placeName - Free-form place name to normalize
 */
async function normalizeAndUpdatePin(pinId, placeName) {
  const result = await normalizeLocation(placeName);

  const locationVerified = result.confidence !== 'low';

  await db.query(
    `UPDATE pins SET
       normalized_city = $1,
       normalized_country = $2,
       normalized_region = $3,
       latitude = $4,
       longitude = $5,
       location_confidence = $6,
       location_verified = $7,
       updated_at = NOW()
     WHERE id = $8`,
    [
      result.normalized_city,
      result.normalized_country,
      result.normalized_region,
      result.latitude,
      result.longitude,
      result.confidence,
      locationVerified,
      pinId,
    ]
  );
}

// Helper: check if two users are friends
async function areFriends(userId1, userId2) {
  const [u1, u2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  const result = await db.query(
    `SELECT id FROM friendships
     WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'accepted'`,
    [u1, u2]
  );
  return result.rows.length > 0;
}

// Helper: format a pin row to camelCase response
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
    companions: row.companions || [],
    countries: row.countries || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// Helper: fetch tags for a pin
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

// Helper: fetch resources for a pin
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

// Helper: insert tags for a pin
async function insertTagsForPin(pinId, tags, userId) {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return;

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (tag.experienceTagId) {
      await db.query(
        `INSERT INTO pin_tags (pin_id, experience_tag_id, sort_order)
         VALUES ($1, $2, $3)`,
        [pinId, tag.experienceTagId, i]
      );
    } else if (tag.customTagName) {
      // Find or create custom tag
      let customTagResult = await db.query(
        `SELECT id FROM custom_tags WHERE user_id = $1 AND name = $2`,
        [userId, tag.customTagName]
      );
      if (customTagResult.rows.length === 0) {
        customTagResult = await db.query(
          `INSERT INTO custom_tags (user_id, name) VALUES ($1, $2) RETURNING id`,
          [userId, tag.customTagName]
        );
      }
      const customTagId = customTagResult.rows[0].id;
      await db.query(
        `INSERT INTO pin_tags (pin_id, custom_tag_id, sort_order)
         VALUES ($1, $2, $3)`,
        [pinId, customTagId, i]
      );
    }
  }
}

// Helper: fetch additional stops for a pin
async function getLocationsForPin(pinId) {
  const result = await db.query(
    `SELECT id, place_name, normalized_city, normalized_country, normalized_region,
            latitude, longitude, location_confidence, sort_order
     FROM pin_locations WHERE pin_id = $1 ORDER BY sort_order`,
    [pinId]
  );
  return result.rows.map(r => ({
    id: r.id,
    placeName: r.place_name,
    normalizedCity: r.normalized_city,
    normalizedCountry: r.normalized_country,
    normalizedRegion: r.normalized_region,
    latitude: r.latitude,
    longitude: r.longitude,
    locationConfidence: r.location_confidence,
    sortOrder: r.sort_order,
  }));
}

// Helper: get full pin with tags and resources
async function getFullPin(pinId) {
  const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [pinId]);
  if (pinResult.rows.length === 0) return null;
  const pin = formatPin(pinResult.rows[0]);
  pin.tags = await getTagsForPin(pinId);
  pin.resources = await getResourcesForPin(pinId);
  pin.locations = await getLocationsForPin(pinId);

  // Check top pin status
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

// GET /api/pins/top -- Get user's Top 8
// Must be defined BEFORE /:id to avoid route conflict
// @implements REQ-PROFILE-001, SCN-PROFILE-001-01
router.get('/top', async (req, res) => {
  try {
    const { tab, userId } = req.query;

    if (!tab || (tab !== 'memory' && tab !== 'dream')) {
      return res.status(400).json({
        success: false,
        error: "tab is required and must be 'memory' or 'dream'"
      });
    }

    const targetUserId = userId || req.user.id;

    const result = await db.query(
      `SELECT tp.sort_order, p.*
       FROM top_pins tp
       JOIN pins p ON tp.pin_id = p.id
       WHERE tp.user_id = $1 AND tp.tab = $2
       ORDER BY tp.sort_order`,
      [targetUserId, tab]
    );

    const data = [];
    for (const row of result.rows) {
      const pin = formatPin(row);
      pin.tags = await getTagsForPin(row.id);
      pin.resources = await getResourcesForPin(row.id);
      data.push({
        sortOrder: row.sort_order,
        pin
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get top pins error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/pins/top -- Set Top 8 (full replacement)
// @implements REQ-PROFILE-001, SCN-PROFILE-001-01
router.put('/top', async (req, res) => {
  try {
    const { tab, pinIds } = req.body;

    if (!tab || (tab !== 'memory' && tab !== 'dream')) {
      return res.status(400).json({
        success: false,
        error: "tab is required and must be 'memory' or 'dream'"
      });
    }

    if (!Array.isArray(pinIds)) {
      return res.status(400).json({
        success: false,
        error: 'pinIds must be an array'
      });
    }

    if (pinIds.length > 8) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 8 pins in Top 8'
      });
    }

    // Validate all pin IDs belong to current user and match tab type
    if (pinIds.length > 0) {
      const pinCheck = await db.query(
        `SELECT id, pin_type FROM pins WHERE id = ANY($1) AND user_id = $2`,
        [pinIds, req.user.id]
      );

      const foundPins = new Map(pinCheck.rows.map(r => [r.id, r.pin_type]));
      for (const pinId of pinIds) {
        const pinType = foundPins.get(pinId);
        if (!pinType || pinType !== tab) {
          return res.status(400).json({
            success: false,
            error: `Pin ${pinId} does not belong to you or does not match tab type`
          });
        }
      }
    }

    // Atomically replace: delete existing, insert new (wrapped in transaction)
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'DELETE FROM top_pins WHERE user_id = $1 AND tab = $2',
        [req.user.id, tab]
      );

      for (let i = 0; i < pinIds.length; i++) {
        await client.query(
          `INSERT INTO top_pins (user_id, pin_id, tab, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, pinIds[i], tab, i]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({ success: true, data: { count: pinIds.length } });
  } catch (error) {
    console.error('Set top pins error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/pins -- Create a pin
// @implements REQ-MEMORY-001, SCN-MEMORY-001-01, REQ-DREAM-001, SCN-DREAM-001-01, REQ-SOCIAL-003
router.post('/', async (req, res) => {
  try {
    const {
      pinType, placeName, note, aiSummary, transcript, correctionTranscript,
      photoUrl, photoSource, visitYear, rating, dreamNote, tags,
      unsplashImageUrl, unsplashAttribution,
      inspiredByPinId, inspiredByUserId, inspiredByDisplayName,
      companions
    } = req.body;

    // Validation
    if (!pinType || !placeName) {
      return res.status(400).json({
        success: false,
        error: 'pinType and placeName are required'
      });
    }

    if (pinType !== 'memory' && pinType !== 'dream') {
      return res.status(400).json({
        success: false,
        error: "pinType must be 'memory' or 'dream'"
      });
    }

    // Insert pin
    const result = await db.query(
      `INSERT INTO pins (
        user_id, pin_type, place_name, note, ai_summary, transcript, correction_transcript,
        photo_url, photo_source, visit_year, rating, dream_note,
        unsplash_image_url, unsplash_attribution,
        inspired_by_pin_id, inspired_by_user_id, inspired_by_display_name,
        companions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        req.user.id, pinType, placeName, note || null, aiSummary || null,
        transcript || null, correctionTranscript || null,
        photoUrl || null, photoSource || null,
        visitYear || null, rating || null, dreamNote || null,
        unsplashImageUrl || null, unsplashAttribution || null,
        inspiredByPinId || null, inspiredByUserId || null, inspiredByDisplayName || null,
        companions || []
      ]
    );

    const pinId = result.rows[0].id;

    // Insert tags
    await insertTagsForPin(pinId, tags, req.user.id);

    // Return full pin
    const fullPin = await getFullPin(pinId);

    res.status(201).json({ success: true, data: fullPin });

    // Fire-and-forget: async location normalization after response is sent
    // @implements REQ-LOCATION-002, SCN-LOCATION-002-01
    normalizeAndUpdatePin(pinId, placeName).catch(err =>
      console.error('Background normalization failed for pin', pinId, err)
    );

    // Fire-and-forget: generate AI cover image if pin has no photo yet
    if (!photoUrl && !unsplashImageUrl) {
      generatePinImage({ placeName, pinType, tags: tags || [], aiSummary })
        .then(async imageUrl => {
          if (imageUrl) {
            await db.query(
              `UPDATE pins SET photo_url = $1, photo_source = 'gemini_imagen' WHERE id = $2`,
              [imageUrl, pinId]
            );
          }
        })
        .catch(err => console.error('Background image generation failed for pin', pinId, err));
    }
  } catch (error) {
    console.error('Create pin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/pins -- List pins
// @implements REQ-MEMORY-004, SCN-MEMORY-004-01, REQ-DREAM-004, SCN-DREAM-004-01, REQ-NAV-002, REQ-NAV-005, REQ-SOCIAL-001, REQ-DISCOVERY-001, REQ-DISCOVERY-002
router.get('/', async (req, res) => {
  try {
    const {
      type, userId, tag, search, includeArchived,
      limit = 50, offset = 0
    } = req.query;

    if (!type || (type !== 'memory' && type !== 'dream')) {
      return res.status(400).json({
        success: false,
        error: "type query param is required and must be 'memory' or 'dream'"
      });
    }

    const targetUserId = userId || req.user.id;
    const isSelf = targetUserId === req.user.id;
    let isFriend = false;

    if (!isSelf) {
      isFriend = await areFriends(req.user.id, targetUserId);
    }

    // Determine visibility
    // Own pins: all (including archived if requested)
    // Friend's pins: all non-archived
    // Non-friend's pins: only Top 8 for that tab
    let query;
    let params;

    let totalCount;

    if (isSelf) {
      // Own pins - all, optionally including archived
      let whereClause = 'p.user_id = $1 AND p.pin_type = $2';
      let paramIndex = 3;
      params = [targetUserId, type];

      if (type === 'dream' && includeArchived !== 'true') {
        whereClause += ' AND p.archived = false';
      }

      if (tag) {
        whereClause += ` AND EXISTS (SELECT 1 FROM pin_tags pt WHERE pt.pin_id = p.id AND pt.experience_tag_id = $${paramIndex})`;
        params.push(parseInt(tag));
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND p.place_name ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Count total matching rows (without LIMIT/OFFSET)
      const countQuery = `SELECT COUNT(*) FROM pins p WHERE ${whereClause}`;
      const countRes = await db.query(countQuery, params);
      totalCount = parseInt(countRes.rows[0].count, 10);

      query = `
        SELECT p.*,
               tp.sort_order as top8_order
        FROM pins p
        LEFT JOIN top_pins tp ON tp.pin_id = p.id AND tp.user_id = p.user_id AND tp.tab = p.pin_type
        WHERE ${whereClause}
        ORDER BY tp.sort_order ASC NULLS LAST, p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(parseInt(limit), parseInt(offset));

    } else if (isFriend) {
      // Friend's pins: all non-archived
      let whereClause = 'p.user_id = $1 AND p.pin_type = $2 AND p.archived = false';
      let paramIndex = 3;
      params = [targetUserId, type];

      if (tag) {
        whereClause += ` AND EXISTS (SELECT 1 FROM pin_tags pt WHERE pt.pin_id = p.id AND pt.experience_tag_id = $${paramIndex})`;
        params.push(parseInt(tag));
        paramIndex++;
      }

      if (search) {
        whereClause += ` AND p.place_name ILIKE $${paramIndex}`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Count total matching rows (without LIMIT/OFFSET)
      const countQuery = `SELECT COUNT(*) FROM pins p WHERE ${whereClause}`;
      const countRes = await db.query(countQuery, params);
      totalCount = parseInt(countRes.rows[0].count, 10);

      query = `
        SELECT p.*,
               tp.sort_order as top8_order
        FROM pins p
        LEFT JOIN top_pins tp ON tp.pin_id = p.id AND tp.user_id = p.user_id AND tp.tab = p.pin_type
        WHERE ${whereClause}
        ORDER BY tp.sort_order ASC NULLS LAST, p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(parseInt(limit), parseInt(offset));

    } else {
      // Non-friend: only Top 8
      params = [targetUserId, type];

      // Count total matching rows (without LIMIT/OFFSET)
      const countQuery = `SELECT COUNT(*) FROM top_pins tp JOIN pins p ON tp.pin_id = p.id WHERE tp.user_id = $1 AND tp.tab = $2 AND p.archived = false`;
      const countRes = await db.query(countQuery, params);
      totalCount = parseInt(countRes.rows[0].count, 10);

      query = `
        SELECT p.*,
               tp.sort_order as top8_order
        FROM top_pins tp
        JOIN pins p ON tp.pin_id = p.id
        WHERE tp.user_id = $1 AND tp.tab = $2 AND p.archived = false
        ORDER BY tp.sort_order ASC
        LIMIT $3 OFFSET $4
      `;
      params.push(parseInt(limit), parseInt(offset));
    }

    const result = await db.query(query, params);

    // Build pin list with tags
    const pins = [];
    for (const row of result.rows) {
      const pin = formatPin(row);
      pin.tags = await getTagsForPin(row.id);
      pin.resources = await getResourcesForPin(row.id);
      pin.isTop8 = row.top8_order !== null && row.top8_order !== undefined;
      pin.top8Order = row.top8_order !== null && row.top8_order !== undefined ? row.top8_order : null;
      pins.push(pin);
    }

    // @implements REQ-SOCIAL-001, REQ-DISCOVERY-001, REQ-DISCOVERY-002
    // Add social annotation counts to each pin in a batch (no N+1)
    if (pins.length > 0) {
      // Get accepted friend IDs for the current user
      const friendResult = await db.query(
        `SELECT
           CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS friend_id
         FROM friendships
         WHERE (user_id_1 = $1 OR user_id_2 = $1)
           AND status = 'accepted'`,
        [req.user.id]
      );
      const friendIds = friendResult.rows.map(r => r.friend_id);

      if (friendIds.length > 0) {
        // Collect pin IDs by type with their regions/place_names
        const memoryPins = pins.filter(p => p.pinType === 'memory');
        const dreamPins = pins.filter(p => p.pinType === 'dream');

        // For memory pins: count friends who dream of the same region
        if (memoryPins.length > 0) {
          const memoryRegions = memoryPins
            .map(p => p.normalizedRegion)
            .filter(Boolean);
          const memoryPlaceNames = memoryPins.map(p => p.placeName);

          if (memoryRegions.length > 0 || memoryPlaceNames.length > 0) {
            const countResult2 = await db.query(
              `SELECT
                 COALESCE(LOWER(fp.normalized_region), LOWER(fp.place_name)) AS match_key,
                 COUNT(DISTINCT fp.user_id) AS cnt
               FROM pins fp
               WHERE fp.user_id = ANY($1)
                 AND fp.pin_type = 'dream'
                 AND fp.archived = false
                 AND (
                   LOWER(fp.normalized_region) = ANY($2)
                   OR LOWER(fp.place_name) = ANY($3)
                 )
               GROUP BY match_key`,
              [
                friendIds,
                memoryRegions.map(r => r.toLowerCase()),
                memoryPlaceNames.map(n => n.toLowerCase())
              ]
            );

            const countMap = new Map();
            for (const row of countResult2.rows) {
              countMap.set(row.match_key, parseInt(row.cnt, 10));
            }

            for (const pin of memoryPins) {
              const regionKey = pin.normalizedRegion ? pin.normalizedRegion.toLowerCase() : null;
              const nameKey = pin.placeName.toLowerCase();
              pin.friendsDreamingCount = (regionKey && countMap.get(regionKey)) || countMap.get(nameKey) || 0;
            }
          } else {
            for (const pin of memoryPins) {
              pin.friendsDreamingCount = 0;
            }
          }
        }

        // For dream pins: count friends who have visited the same region
        if (dreamPins.length > 0) {
          const dreamRegions = dreamPins
            .map(p => p.normalizedRegion)
            .filter(Boolean);
          const dreamPlaceNames = dreamPins.map(p => p.placeName);

          if (dreamRegions.length > 0 || dreamPlaceNames.length > 0) {
            const countResult2 = await db.query(
              `SELECT
                 COALESCE(LOWER(fp.normalized_region), LOWER(fp.place_name)) AS match_key,
                 COUNT(DISTINCT fp.user_id) AS cnt
               FROM pins fp
               WHERE fp.user_id = ANY($1)
                 AND fp.pin_type = 'memory'
                 AND fp.archived = false
                 AND (
                   LOWER(fp.normalized_region) = ANY($2)
                   OR LOWER(fp.place_name) = ANY($3)
                 )
               GROUP BY match_key`,
              [
                friendIds,
                dreamRegions.map(r => r.toLowerCase()),
                dreamPlaceNames.map(n => n.toLowerCase())
              ]
            );

            const countMap = new Map();
            for (const row of countResult2.rows) {
              countMap.set(row.match_key, parseInt(row.cnt, 10));
            }

            for (const pin of dreamPins) {
              const regionKey = pin.normalizedRegion ? pin.normalizedRegion.toLowerCase() : null;
              const nameKey = pin.placeName.toLowerCase();
              pin.friendsVisitedCount = (regionKey && countMap.get(regionKey)) || countMap.get(nameKey) || 0;
            }
          } else {
            for (const pin of dreamPins) {
              pin.friendsVisitedCount = 0;
            }
          }
        }
      } else {
        // No friends - set all counts to 0
        for (const pin of pins) {
          if (pin.pinType === 'memory') {
            pin.friendsDreamingCount = 0;
          } else {
            pin.friendsVisitedCount = 0;
          }
        }
      }
    }

    // Get total counts for this user
    const countResult = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE pin_type = 'memory') as memory_count,
         COUNT(*) FILTER (WHERE pin_type = 'dream' AND archived = false) as dream_count
       FROM pins WHERE user_id = $1`,
      [targetUserId]
    );

    const counts = countResult.rows[0];

    res.json({
      success: true,
      data: {
        pins,
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        memoryCount: parseInt(counts.memory_count),
        dreamCount: parseInt(counts.dream_count)
      }
    });
  } catch (error) {
    console.error('List pins error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/pins/map-data -- Get map data for authenticated user
// Must be defined BEFORE /:id to avoid route conflict
router.get('/map-data', async (req, res) => {
  try {
    const userId = req.user.id;

    // Dream pins with tags
    const dreamResult = await db.query(
      `SELECT
        p.id, p.place_name, p.latitude, p.longitude, p.normalized_country,
        COALESCE(
          json_agg(json_build_object('name', et.name, 'emoji', et.emoji) ORDER BY et.name)
          FILTER (WHERE et.id IS NOT NULL),
          '[]'
        ) as tags
      FROM pins p
      LEFT JOIN pin_tags pt ON pt.pin_id = p.id
      LEFT JOIN experience_tags et ON et.id = pt.experience_tag_id
      WHERE p.user_id = $1 AND p.pin_type = 'dream' AND p.archived = false
      GROUP BY p.id
      ORDER BY p.created_at DESC`,
      [userId]
    );

    // Filter out dream pins where both lat AND lng are null
    const dreamPins = dreamResult.rows
      .filter(row => row.latitude !== null || row.longitude !== null)
      .map(row => ({
        id: row.id,
        placeName: row.place_name,
        lat: row.latitude,
        lng: row.longitude,
        normalizedCountry: row.normalized_country,
        tags: row.tags
      }));

    // Visited countries
    const visitedResult = await db.query(
      `SELECT DISTINCT normalized_country
       FROM pins
       WHERE user_id = $1 AND pin_type = 'memory' AND normalized_country IS NOT NULL AND archived = false`,
      [userId]
    );

    const visitedCountries = visitedResult.rows.map(row => row.normalized_country);

    res.json({
      success: true,
      data: {
        dreamPins,
        visitedCountries,
        totalVisited: visitedCountries.length,
        totalDreams: dreamResult.rows.length
      }
    });
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ success: false, error: 'Failed to load map data' });
  }
});

// GET /api/pins/:id -- Get single pin
// @implements REQ-MEMORY-004, REQ-DREAM-004
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [id]);
    if (pinResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }

    const pinRow = pinResult.rows[0];
    const isSelf = pinRow.user_id === req.user.id;

    if (!isSelf) {
      const isFriend = await areFriends(req.user.id, pinRow.user_id);
      if (!isFriend) {
        // Non-friend: can only see Top 8 pins
        const topCheck = await db.query(
          'SELECT id FROM top_pins WHERE pin_id = $1 AND user_id = $2',
          [id, pinRow.user_id]
        );
        if (topCheck.rows.length === 0) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized to view this pin'
          });
        }
      }
    }

    const fullPin = await getFullPin(id);
    res.json({ success: true, data: fullPin });
  } catch (error) {
    console.error('Get pin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/pins/:id -- Update a pin
// @implements REQ-VOICE-004, SCN-VOICE-004-01, REQ-LOCATION-003, SCN-LOCATION-003-01
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check pin exists and user owns it
    const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [id]);
    if (pinResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }
    if (pinResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to edit this pin' });
    }

    const {
      placeName, note, aiSummary, photoUrl, photoSource,
      visitYear, rating, dreamNote, archived, tags,
      locationVerified, normalizedCity, normalizedCountry, normalizedRegion,
      latitude, longitude, locationConfidence,
      transcript, correctionTranscript,
      unsplashImageUrl, unsplashAttribution,
      companions, countries
    } = req.body;

    // Build dynamic update
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    const addField = (column, value) => {
      if (value !== undefined) {
        setClauses.push(`${column} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    };

    addField('place_name', placeName);
    addField('note', note);
    addField('ai_summary', aiSummary);
    addField('photo_url', photoUrl);
    addField('photo_source', photoSource);
    addField('visit_year', visitYear);
    addField('rating', rating);
    addField('dream_note', dreamNote);
    addField('archived', archived);
    addField('location_verified', locationVerified);
    addField('normalized_city', normalizedCity);
    addField('normalized_country', normalizedCountry);
    addField('normalized_region', normalizedRegion);
    addField('latitude', latitude);
    addField('longitude', longitude);
    addField('location_confidence', locationConfidence);
    addField('transcript', transcript);
    addField('correction_transcript', correctionTranscript);
    addField('unsplash_image_url', unsplashImageUrl);
    addField('unsplash_attribution', unsplashAttribution);
    addField('companions', companions);
    addField('countries', countries);

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = NOW()`);
      values.push(id);
      await db.query(
        `UPDATE pins SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
        values
      );
    }

    // If tags provided, replace all existing tags
    if (tags !== undefined) {
      await db.query('DELETE FROM pin_tags WHERE pin_id = $1', [id]);
      await insertTagsForPin(id, tags, req.user.id);
    }

    // Return full updated pin
    const fullPin = await getFullPin(id);
    res.json({ success: true, data: fullPin });
  } catch (error) {
    console.error('Update pin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/pins/:id -- Delete a pin
// @implements REQ-MEMORY-001, REQ-DREAM-001
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check pin exists and user owns it
    const pinResult = await db.query(
      'SELECT id, user_id FROM pins WHERE id = $1',
      [id]
    );
    if (pinResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }
    if (pinResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to delete this pin' });
    }

    // Delete pin (cascades to pin_tags, pin_resources, top_pins via ON DELETE CASCADE)
    // inspired_by_pin_id on other pins is NOT a FK, so those rows survive per spec
    await db.query('DELETE FROM pins WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete pin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/pins/:id/convert -- Convert dream pin to memory (prefill + optional archive)
// @implements REQ-DREAM-005, SCN-DREAM-005-01, SCN-DREAM-005-02
router.post('/:id/convert', async (req, res) => {
  try {
    const { id } = req.params;
    const { keepDream } = req.body;

    // 1. Fetch pin by id
    const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [id]);
    if (pinResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }

    const pinRow = pinResult.rows[0];

    // 2. Must be a dream pin
    if (pinRow.pin_type !== 'dream') {
      return res.status(400).json({ success: false, error: 'Only dream pins can be converted' });
    }

    // 3. Must be owned by current user
    if (pinRow.user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized to convert this pin' });
    }

    // 4. If keepDream is false, archive the dream pin
    let archived = false;
    if (keepDream === false) {
      await db.query('UPDATE pins SET archived = true WHERE id = $1', [id]);
      archived = true;
    }

    // 5. Fetch tag names via JOIN on pin_tags + experience_tags/custom_tags
    const tagResult = await db.query(
      `SELECT COALESCE(et.name, ct.name) AS tag_name
       FROM pin_tags pt
       LEFT JOIN experience_tags et ON pt.experience_tag_id = et.id
       LEFT JOIN custom_tags ct ON pt.custom_tag_id = ct.id
       WHERE pt.pin_id = $1
       ORDER BY pt.sort_order`,
      [id]
    );
    const tagNames = tagResult.rows.map(r => r.tag_name).filter(Boolean);

    // Return prefilled memory fields from the dream pin
    res.json({
      success: true,
      data: {
        dreamPinId: pinRow.id,
        prefilled: {
          placeName: pinRow.place_name,
          tags: tagNames,
          normalizedRegion: pinRow.normalized_region,
          normalizedCity: pinRow.normalized_city,
          normalizedCountry: pinRow.normalized_country,
          latitude: pinRow.latitude,
          longitude: pinRow.longitude,
          locationVerified: pinRow.location_verified,
          locationConfidence: pinRow.location_confidence,
        },
        archived,
      },
    });
  } catch (error) {
    console.error('Convert dream pin error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/pins/:id/resources -- Add inspiration resource
// @implements REQ-DREAM-001, SCN-DREAM-001-01
router.post('/:id/resources', async (req, res) => {
  try {
    const { id } = req.params;

    // Check pin exists, user owns it, and it's a dream pin
    const pinResult = await db.query(
      'SELECT id, user_id, pin_type FROM pins WHERE id = $1',
      [id]
    );
    if (pinResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }
    if (pinResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    // @implements REQ-DREAM-001 (dream pin data model — resources only on dream pins)
    if (pinResult.rows[0].pin_type !== 'dream') {
      return res.status(400).json({ success: false, error: 'Resources can only be added to dream pins' });
    }

    // Check resource count (max 10 per spec)
    const countResult = await db.query(
      'SELECT COUNT(*) as cnt FROM pin_resources WHERE pin_id = $1',
      [id]
    );
    if (parseInt(countResult.rows[0].cnt) >= 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 resources per pin'
      });
    }

    const { sourceUrl, domainName, photoUrl, excerpt } = req.body;

    // Get next sort_order
    const orderResult = await db.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order FROM pin_resources WHERE pin_id = $1',
      [id]
    );
    const nextOrder = orderResult.rows[0].next_order;

    const result = await db.query(
      `INSERT INTO pin_resources (pin_id, source_url, domain_name, photo_url, excerpt, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, sourceUrl, domainName, photoUrl || null, excerpt || null, nextOrder]
    );

    const r = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: r.id,
        sourceUrl: r.source_url,
        domainName: r.domain_name,
        photoUrl: r.photo_url,
        excerpt: r.excerpt,
        sortOrder: r.sort_order,
        createdAt: r.created_at
      }
    });
  } catch (error) {
    console.error('Add resource error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/pins/:id/resources/:resourceId -- Remove resource
// @implements REQ-DREAM-001
router.delete('/:id/resources/:resourceId', async (req, res) => {
  try {
    const { id, resourceId } = req.params;

    // Check pin ownership
    const pinResult = await db.query(
      'SELECT user_id FROM pins WHERE id = $1',
      [id]
    );
    if (pinResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Pin not found' });
    }
    if (pinResult.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const result = await db.query(
      'DELETE FROM pin_resources WHERE id = $1 AND pin_id = $2 RETURNING id',
      [resourceId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Resource not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
