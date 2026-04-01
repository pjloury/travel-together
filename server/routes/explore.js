// Explore routes — curated trip clusters and experiences
//
// GET  /api/explore/trips       — list all trip clusters (auth required)
// GET  /api/explore/trips/:id   — trip detail + experiences (auth required)
// POST /api/explore/refresh     — trigger curator refresh (CURATOR_SECRET header)

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { runCurator } = require('../services/curator');

// GET /api/explore/trips — summary list for the Explore grid
router.get('/trips', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        t.id, t.city, t.country, t.region, t.title, t.description,
        t.image_url, t.days_suggested, t.tags, t.last_scraped_at,
        COUNT(e.id)::int AS experience_count
      FROM curated_trips t
      LEFT JOIN curated_experiences e ON e.trip_id = t.id
      GROUP BY t.id
      ORDER BY t.region, t.city
    `);
    res.json({ trips: result.rows });
  } catch (err) {
    console.error('[explore] GET /trips error:', err.message);
    res.status(500).json({ error: 'Failed to load trips' });
  }
});

// GET /api/explore/trips/:id — full trip with ordered experiences
router.get('/trips/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const tripResult = await db.query(
      'SELECT * FROM curated_trips WHERE id = $1',
      [id]
    );
    if (!tripResult.rows.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const expResult = await db.query(
      `SELECT * FROM curated_experiences
       WHERE trip_id = $1
       ORDER BY day_number, sort_order`,
      [id]
    );

    res.json({ trip: tripResult.rows[0], experiences: expResult.rows });
  } catch (err) {
    console.error('[explore] GET /trips/:id error:', err.message);
    res.status(500).json({ error: 'Failed to load trip' });
  }
});

// POST /api/explore/refresh — curator-secret protected, responds immediately
router.post('/refresh', async (req, res) => {
  const secret = req.headers['x-curator-secret'];
  if (!secret || secret !== process.env.CURATOR_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Respond immediately — curator can take 40-60s for all cities
  res.json({ message: 'Curator refresh started', cities: 20 });

  // Fire and forget
  runCurator(db).catch(err =>
    console.error('[explore] runCurator uncaught error:', err.message)
  );
});

module.exports = router;
