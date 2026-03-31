// Pin locations — manage the additional stops for a memory/dream pin.
//
// A pin's primary location is stored on the pins table.
// Extra stops are stored in pin_locations.

const express = require('express');
const router = express.Router({ mergeParams: true }); // access :pinId from parent
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { normalizeLocation } = require('../services/claude');

router.use(authenticateToken);

// Helper: background normalize a pin_location row
async function normalizeAndUpdateLocation(locId, placeName) {
  try {
    const result = await normalizeLocation(placeName);
    await db.query(
      `UPDATE pin_locations SET
         normalized_city = $1,
         normalized_country = $2,
         normalized_region = $3,
         latitude = $4,
         longitude = $5,
         location_confidence = $6
       WHERE id = $7`,
      [
        result.normalized_city,
        result.normalized_country,
        result.normalized_region,
        result.latitude,
        result.longitude,
        result.confidence,
        locId,
      ]
    );
  } catch (err) {
    console.error('Background location normalize failed for pin_location', locId, err.message);
  }
}

/**
 * POST /api/pins/:pinId/locations
 * Add a stop to a pin.
 * Body: { placeName: string }
 */
router.post('/', async (req, res) => {
  const { pinId } = req.params;
  const { placeName } = req.body;

  if (!placeName || !placeName.trim()) {
    return res.status(400).json({ success: false, error: 'placeName is required' });
  }

  // Verify ownership
  const pinRes = await db.query('SELECT user_id FROM pins WHERE id = $1', [pinId]);
  if (pinRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Pin not found' });
  if (pinRes.rows[0].user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Forbidden' });

  // Insert with next sort_order
  const countRes = await db.query('SELECT COUNT(*) FROM pin_locations WHERE pin_id = $1', [pinId]);
  const sortOrder = parseInt(countRes.rows[0].count, 10);

  const insertRes = await db.query(
    `INSERT INTO pin_locations (pin_id, place_name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
    [pinId, placeName.trim(), sortOrder]
  );
  const loc = insertRes.rows[0];

  res.status(201).json({
    success: true,
    data: {
      id: loc.id,
      placeName: loc.place_name,
      normalizedCountry: loc.normalized_country,
      latitude: loc.latitude,
      longitude: loc.longitude,
      sortOrder: loc.sort_order,
    },
  });

  // Fire-and-forget normalization
  normalizeAndUpdateLocation(loc.id, placeName.trim());
});

/**
 * PUT /api/pins/:pinId/locations/:locId
 * Update a stop's place name (re-triggers background normalization).
 * Body: { placeName: string }
 */
router.put('/:locId', async (req, res) => {
  const { pinId, locId } = req.params;
  const { placeName } = req.body;

  if (!placeName || !placeName.trim()) {
    return res.status(400).json({ success: false, error: 'placeName is required' });
  }

  // Verify ownership
  const pinRes = await db.query('SELECT user_id FROM pins WHERE id = $1', [pinId]);
  if (pinRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Pin not found' });
  if (pinRes.rows[0].user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Forbidden' });

  await db.query(
    `UPDATE pin_locations SET
       place_name = $1,
       normalized_city = NULL,
       normalized_country = NULL,
       normalized_region = NULL,
       latitude = NULL,
       longitude = NULL,
       location_confidence = NULL
     WHERE id = $2 AND pin_id = $3`,
    [placeName.trim(), locId, pinId]
  );

  const row = (await db.query('SELECT * FROM pin_locations WHERE id = $1', [locId])).rows[0];
  if (!row) return res.status(404).json({ success: false, error: 'Location not found' });

  res.json({
    success: true,
    data: {
      id: row.id,
      placeName: row.place_name,
      normalizedCountry: row.normalized_country,
      latitude: row.latitude,
      longitude: row.longitude,
      sortOrder: row.sort_order,
    },
  });

  // Re-normalize in background
  normalizeAndUpdateLocation(locId, placeName.trim());
});

/**
 * DELETE /api/pins/:pinId/locations/:locId
 * Remove a stop from a pin.
 */
router.delete('/:locId', async (req, res) => {
  const { pinId, locId } = req.params;

  // Verify ownership via pin
  const pinRes = await db.query('SELECT user_id FROM pins WHERE id = $1', [pinId]);
  if (pinRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Pin not found' });
  if (pinRes.rows[0].user_id !== req.user.id) return res.status(403).json({ success: false, error: 'Forbidden' });

  await db.query('DELETE FROM pin_locations WHERE id = $1 AND pin_id = $2', [locId, pinId]);
  res.json({ success: true });
});

module.exports = router;
