const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// GET /api/venues?type=national_park|ski_resort&q=<search>
// Returns top 20 matching venues
router.get('/', async (req, res) => {
  try {
    const { type, q } = req.query;
    const validTypes = ['national_park', 'ski_resort'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    const conditions = [];
    const values = [];
    let i = 1;

    if (type) {
      conditions.push(`type = $${i++}`);
      values.push(type);
    }
    if (q && q.trim()) {
      conditions.push(`name ILIKE $${i++}`);
      values.push(`%${q.trim()}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = (await db.query(
      `SELECT id, name, type, country, region, latitude, longitude
       FROM venues ${where}
       ORDER BY name
       LIMIT 20`,
      values
    )).rows;

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Venues search error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/venues/visited?type=national_park|ski_resort
// Returns venues the current user has tagged on any of their pins
router.get('/visited', async (req, res) => {
  try {
    const { type } = req.query;
    const validTypes = ['national_park', 'ski_resort'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid type' });
    }

    const values = [req.user.id];
    let typeClause = '';
    if (type) {
      typeClause = 'AND v.type = $2';
      values.push(type);
    }

    const rows = (await db.query(
      `SELECT DISTINCT v.id, v.name, v.type, v.country, v.region, v.latitude, v.longitude
       FROM pin_venues pv
       JOIN venues v ON v.id = pv.venue_id
       JOIN pins p ON p.id = pv.pin_id
       WHERE p.user_id = $1 AND p.archived = false ${typeClause}
       ORDER BY v.name`,
      values
    )).rows;

    // Counts per type
    const counts = rows.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1;
      return acc;
    }, {});

    // Totals
    const totalRows = (await db.query(
      `SELECT type, COUNT(*) as total FROM venues ${type ? 'WHERE type = $1' : ''} GROUP BY type`,
      type ? [type] : []
    )).rows;
    const totals = totalRows.reduce((acc, r) => {
      acc[r.type] = parseInt(r.total);
      return acc;
    }, {});

    res.json({ success: true, data: rows, counts, totals });
  } catch (err) {
    console.error('Venues visited error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/venues/all?type=national_park|ski_resort
// Returns all venues with visited:true/false for the current user (for map overlay)
router.get('/all', async (req, res) => {
  try {
    const { type } = req.query;
    const validTypes = ['national_park', 'ski_resort'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: 'type required: national_park or ski_resort' });
    }

    const rows = (await db.query(
      `SELECT v.id, v.name, v.type, v.country, v.region, v.latitude, v.longitude,
              EXISTS (
                SELECT 1 FROM pin_venues pv
                JOIN pins p ON p.id = pv.pin_id
                WHERE pv.venue_id = v.id AND p.user_id = $1 AND p.archived = false
              ) AS visited
       FROM venues v
       WHERE v.type = $2
       ORDER BY v.name`,
      [req.user.id, type]
    )).rows;

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Venues all error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
