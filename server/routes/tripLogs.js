// Trip log routes — casual/frequent trip memories with timeline view
const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { normalizeLocation } = require('../services/claude');

const router = express.Router();
router.use(authMiddleware);

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatTripLog(row, tags = []) {
  return {
    id: row.id,
    pinType: row.pin_type,
    placeName: row.place_name,
    normalizedCity: row.normalized_city,
    normalizedCountry: row.normalized_country,
    normalizedRegion: row.normalized_region,
    latitude: row.latitude,
    longitude: row.longitude,
    aiSummary: row.ai_summary,
    note: row.note,
    photoUrl: row.photo_url,
    unsplashImageUrl: row.unsplash_image_url,
    unsplashAttribution: row.unsplash_attribution,
    visitYear: row.visit_year,
    visitMonth: row.visit_month,
    visitMonthName: row.visit_month ? MONTH_NAMES[row.visit_month] : null,
    rating: row.rating,
    companions: row.companions || [],
    countries: row.countries || [],
    wouldGoBack: row.would_go_back ?? null,
    isTripLog: row.is_trip_log || false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
  };
}

async function getTagsForPin(pinId) {
  const result = await db.query(
    `SELECT pt.experience_tag_id, pt.custom_tag_id, pt.sort_order,
            et.name as et_name, et.emoji as et_emoji, et.short_name as et_short,
            ct.name as ct_name
     FROM pin_tags pt
     LEFT JOIN experience_tags et ON pt.experience_tag_id = et.id
     LEFT JOIN custom_tags ct ON pt.custom_tag_id = ct.id
     WHERE pt.pin_id = $1
     ORDER BY pt.sort_order`,
    [pinId]
  );
  return result.rows.map(r =>
    r.experience_tag_id
      ? { id: r.experience_tag_id, name: r.et_name, shortName: r.et_short || r.et_name, emoji: r.et_emoji, type: 'experience' }
      : { id: r.custom_tag_id, name: r.ct_name, shortName: r.ct_name, type: 'custom' }
  );
}

async function batchGetTagsForPins(pinIds) {
  if (!pinIds.length) return {};
  const result = await db.query(
    `SELECT pt.pin_id, pt.experience_tag_id, pt.custom_tag_id, pt.sort_order,
            et.name as et_name, et.emoji as et_emoji, et.short_name as et_short,
            ct.name as ct_name
     FROM pin_tags pt
     LEFT JOIN experience_tags et ON pt.experience_tag_id = et.id
     LEFT JOIN custom_tags ct ON pt.custom_tag_id = ct.id
     WHERE pt.pin_id = ANY($1)
     ORDER BY pt.pin_id, pt.sort_order`,
    [pinIds]
  );
  const map = {};
  for (const id of pinIds) map[id] = [];
  for (const r of result.rows) {
    const tag = r.experience_tag_id
      ? { id: r.experience_tag_id, name: r.et_name, shortName: r.et_short || r.et_name, emoji: r.et_emoji, type: 'experience' }
      : { id: r.custom_tag_id, name: r.ct_name, shortName: r.ct_name, type: 'custom' };
    map[r.pin_id].push(tag);
  }
  return map;
}

// GET /api/trip-logs — list user's trip log entries, newest first
router.get('/', async (req, res) => {
  try {
    const { limit = 200, offset = 0 } = req.query;
    const result = await db.query(
      `SELECT * FROM pins
       WHERE user_id = $1 AND pin_type = 'memory' AND archived = FALSE
       ORDER BY visit_year DESC NULLS LAST, visit_month DESC NULLS LAST, created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    const pinIds = result.rows.map(r => r.id);
    const tagsMap = await batchGetTagsForPins(pinIds);

    const logs = result.rows.map(row => formatTripLog(row, tagsMap[row.id] || []));
    res.json({ success: true, data: logs, total: logs.length });
  } catch (err) {
    console.error('GET /api/trip-logs error:', err);
    res.status(500).json({ success: false, error: 'Failed to load trip logs' });
  }
});

// POST /api/trip-logs — create a new trip log entry
router.post('/', async (req, res) => {
  try {
    const {
      placeName, visitYear, visitMonth, note, rating, companions, tags,
    } = req.body;

    if (!placeName) {
      return res.status(400).json({ success: false, error: 'placeName is required' });
    }
    if (visitMonth !== undefined && visitMonth !== null) {
      const m = parseInt(visitMonth);
      if (isNaN(m) || m < 1 || m > 12) {
        return res.status(400).json({ success: false, error: 'visitMonth must be 1–12' });
      }
    }

    const result = await db.query(
      `INSERT INTO pins (user_id, pin_type, is_trip_log, place_name, visit_year, visit_month, note, rating, companions)
       VALUES ($1, 'memory', TRUE, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.user.id,
        placeName,
        visitYear || null,
        visitMonth || null,
        note || null,
        rating || null,
        companions || [],
      ]
    );

    const pinId = result.rows[0].id;

    // Insert tags if provided
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        if (tag.experienceTagId) {
          await db.query(
            'INSERT INTO pin_tags (pin_id, experience_tag_id, sort_order) VALUES ($1, $2, $3)',
            [pinId, tag.experienceTagId, i]
          );
        } else if (tag.customTagName) {
          let ctResult = await db.query(
            'SELECT id FROM custom_tags WHERE user_id = $1 AND name = $2',
            [req.user.id, tag.customTagName]
          );
          if (ctResult.rows.length === 0) {
            ctResult = await db.query(
              'INSERT INTO custom_tags (user_id, name) VALUES ($1, $2) RETURNING id',
              [req.user.id, tag.customTagName]
            );
          }
          await db.query(
            'INSERT INTO pin_tags (pin_id, custom_tag_id, sort_order) VALUES ($1, $2, $3)',
            [pinId, ctResult.rows[0].id, i]
          );
        }
      }
    }

    const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [pinId]);
    const tagList = await getTagsForPin(pinId);
    const log = formatTripLog(pinResult.rows[0], tagList);

    res.status(201).json({ success: true, data: log });

    // Background location normalization
    normalizeLocation(placeName).then(loc => {
      db.query(
        `UPDATE pins SET
           normalized_city=$1, normalized_country=$2, normalized_region=$3,
           latitude=$4, longitude=$5, location_confidence=$6, location_verified=$7,
           updated_at=NOW()
         WHERE id=$8`,
        [loc.normalized_city, loc.normalized_country, loc.normalized_region,
         loc.latitude, loc.longitude, loc.confidence, loc.confidence !== 'low', pinId]
      ).catch(err => console.error('Trip log normalization failed', pinId, err));
    }).catch(err => console.error('Trip log normalization failed', pinId, err));

  } catch (err) {
    console.error('POST /api/trip-logs error:', err);
    res.status(500).json({ success: false, error: 'Failed to create trip log' });
  }
});

// PATCH /api/trip-logs/:id — update a trip log entry
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { placeName, visitYear, visitMonth, note, rating, companions } = req.body;

    // Verify ownership and that it's a trip log
    const check = await db.query(
      'SELECT id FROM pins WHERE id = $1 AND user_id = $2 AND is_trip_log = TRUE',
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trip log not found' });
    }

    if (visitMonth !== undefined && visitMonth !== null) {
      const m = parseInt(visitMonth);
      if (isNaN(m) || m < 1 || m > 12) {
        return res.status(400).json({ success: false, error: 'visitMonth must be 1–12' });
      }
    }

    await db.query(
      `UPDATE pins SET
         place_name = COALESCE($1, place_name),
         visit_year = COALESCE($2, visit_year),
         visit_month = COALESCE($3, visit_month),
         note = COALESCE($4, note),
         rating = COALESCE($5, rating),
         companions = COALESCE($6, companions),
         updated_at = NOW()
       WHERE id = $7`,
      [
        placeName || null, visitYear || null, visitMonth || null,
        note || null, rating || null,
        companions !== undefined ? companions : null,
        id,
      ]
    );

    const pinResult = await db.query('SELECT * FROM pins WHERE id = $1', [id]);
    const tagList = await getTagsForPin(id);
    res.json({ success: true, data: formatTripLog(pinResult.rows[0], tagList) });
  } catch (err) {
    console.error('PATCH /api/trip-logs/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to update trip log' });
  }
});

// DELETE /api/trip-logs/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const check = await db.query(
      'SELECT id FROM pins WHERE id = $1 AND user_id = $2 AND is_trip_log = TRUE',
      [id, req.user.id]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Trip log not found' });
    }
    await db.query('DELETE FROM pin_tags WHERE pin_id = $1', [id]);
    await db.query('DELETE FROM pins WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/trip-logs/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete trip log' });
  }
});

module.exports = router;
