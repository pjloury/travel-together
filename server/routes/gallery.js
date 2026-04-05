// Gallery routes — curated travel photo collection
const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/gallery — paginated gallery photos (public)
router.get('/', async (req, res) => {
  try {
    const { region, limit = 30, offset = 0 } = req.query;

    let where = '';
    const params = [];
    let paramIdx = 1;

    if (region && region !== 'All') {
      where = `WHERE region = $${paramIdx}`;
      params.push(region);
      paramIdx++;
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(
      `SELECT id, image_url, thumb_url, photographer_name, location_name,
              country, region, description, likes
       FROM gallery_photos
       ${where}
       ORDER BY likes DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int as total FROM gallery_photos ${where}`,
      region && region !== 'All' ? [region] : []
    );

    res.json({
      photos: result.rows.map(r => ({
        id: r.id,
        imageUrl: r.image_url,
        thumbUrl: r.thumb_url,
        photographer: r.photographer_name,
        location: r.location_name,
        country: r.country,
        region: r.region,
        description: r.description,
        likes: r.likes,
      })),
      total: countResult.rows[0].total,
    });
  } catch (err) {
    console.error('[gallery] error:', err.message);
    res.status(500).json({ error: 'Failed to load gallery' });
  }
});

module.exports = router;
