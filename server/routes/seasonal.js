// Seasonal experiences — browse editorial experiences by month + category.
const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Canonical display categories mapped from the raw seed category values.
// Keeps the client UI clean without exposing raw snake_case dataset tags.
const CATEGORY_GROUPS = {
  'Festivals & Events': [
    'beer_festival', 'harvest_festival', 'village_festival', 'themed_festival',
    'Festival', 'cultural_ritual', 'traditional_ceremony', 'regional_culture',
    'local_ritual', 'music_festival',
  ],
  'Food & Drink': [
    'food_neighborhood', 'street_food', 'specialty_market', 'Culinary',
    'food_market', 'coffee_culture', 'wine',
  ],
  'Nature & Wildlife': [
    'Nature', 'wildlife_encounter', 'natural_wonder', 'bloom_event',
    'geological', 'sky_phenomena', 'water_drama', 'chromatic_earth',
    'dark_sky', 'stargazing', 'astronomy', 'waterfall',
  ],
  'Hiking & Adventure': [
    'hiking_trekking', 'mountain_landscape', 'scenic_route', 'Adventure',
    'Hiking', 'water_drama',
  ],
  'Beach & Water': [
    'Beach', 'coastal', 'surf', 'dive', 'Diving', 'Snorkelling',
    'Freediving', 'Kayaking',
  ],
  'Architecture & Streets': [
    'Architecture Tourism', 'Architecture', 'neighborhood_wandering',
    'street_art', 'public_murals', 'art_neighborhood',
    'Slow Train / Journey as Destination', 'Set-Jetting / Film & TV Location Tourism',
    'photography_destination', 'Photography',
  ],
  'Culture & History': [
    'Culture', 'History', 'ancient_ruins', 'Archaeology', 'Temples',
    'sacred_site', 'Pilgrimage', 'artisan', 'traditional_craft', 'Music',
    'Art', 'thermal_bathing', 'match_day',
  ],
  'Wellness & Slow': [
    'thermal_bathing', 'Relaxation', 'Wellness', 'Meditation',
    'Slow Train / Journey as Destination',
  ],
};

// Build a lookup: raw category → display group
const CAT_TO_GROUP = {};
for (const [group, raws] of Object.entries(CATEGORY_GROUPS)) {
  for (const raw of raws) {
    CAT_TO_GROUP[raw.toLowerCase()] = group;
  }
}

function normalizeCategories(rawCats) {
  const groups = new Set();
  for (const c of rawCats) {
    const g = CAT_TO_GROUP[c.toLowerCase()];
    if (g) groups.add(g);
  }
  return [...groups];
}

function formatExperience(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    months: row.months || [],
    whenText: row.when_text,
    categories: normalizeCategories(row.categories || []),
    rawCategories: row.categories || [],
    vibeTags: (row.vibe_tags || []).slice(0, 5),
    description: row.description,
    whySpecial: row.why_special,
    bestFor: row.best_for || [],
    accessibility: row.accessibility,
    sourceDataset: row.source_dataset,
    imageUrl: row.image_url || null,
  };
}

// GET /api/seasonal?month=5&category=Festivals+%26+Events&vibe=off-beaten-path&limit=30&offset=0
// month: 1-12 (optional — omit for all months / "any time")
// category: display category label (optional)
// vibe: a single vibe tag string (optional)
router.get('/', async (req, res) => {
  try {
    const { month, category, vibe, limit = 30, offset = 0 } = req.query;
    const lim = Math.min(parseInt(limit) || 30, 100);
    const off = parseInt(offset) || 0;

    const conditions = [];
    const values = [];
    let p = 1;

    if (month) {
      const m = parseInt(month);
      if (m >= 1 && m <= 12) {
        // Include experiences that have this month OR no months at all (any-time)
        conditions.push(`($${p} = ANY(months) OR array_length(months, 1) IS NULL OR array_length(months, 1) = 0)`);
        values.push(m);
        p++;
      }
    }

    if (category) {
      // Find all raw category values that map to this display group
      const matchingRaw = Object.entries(CAT_TO_GROUP)
        .filter(([, g]) => g === category)
        .map(([raw]) => raw);
      if (matchingRaw.length > 0) {
        // categories column overlaps with the matching raw values (case-insensitive)
        const placeholders = matchingRaw.map((_, i) => `$${p + i}`).join(', ');
        conditions.push(
          `EXISTS (
            SELECT 1 FROM unnest(categories) AS c
            WHERE lower(c) = ANY(ARRAY[${placeholders}])
          )`
        );
        values.push(...matchingRaw);
        p += matchingRaw.length;
      }
    }

    if (vibe) {
      conditions.push(`$${p} = ANY(vibe_tags)`);
      values.push(vibe.toLowerCase());
      p++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*) FROM seasonal_experiences ${where}`,
      values
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await db.query(
      `SELECT * FROM seasonal_experiences
       ${where}
       ORDER BY click_count DESC, name
       LIMIT $${p} OFFSET $${p + 1}`,
      [...values, lim, off]
    );

    res.json({
      success: true,
      data: result.rows.map(formatExperience),
      total,
      limit: lim,
      offset: off,
    });
  } catch (err) {
    console.error('GET /api/seasonal error:', err);
    res.status(500).json({ success: false, error: 'Failed to load experiences' });
  }
});

// GET /api/seasonal/categories — list of available display categories with counts
router.get('/categories', async (req, res) => {
  try {
    const { month } = req.query;
    let where = '';
    const values = [];

    if (month) {
      const m = parseInt(month);
      if (m >= 1 && m <= 12) {
        where = `WHERE ($1 = ANY(months) OR array_length(months, 1) IS NULL OR array_length(months, 1) = 0)`;
        values.push(m);
      }
    }

    const result = await db.query(
      `SELECT unnest(categories) AS cat, COUNT(*) AS cnt
       FROM seasonal_experiences
       ${where}
       GROUP BY cat`,
      values
    );

    // Map raw → display group and sum counts
    const groupCounts = {};
    for (const row of result.rows) {
      const g = CAT_TO_GROUP[(row.cat || '').toLowerCase()];
      if (g) groupCounts[g] = (groupCounts[g] || 0) + parseInt(row.cnt);
    }

    const categories = Object.entries(groupCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));

    res.json({ success: true, categories });
  } catch (err) {
    console.error('GET /api/seasonal/categories error:', err);
    res.status(500).json({ success: false, error: 'Failed to load categories' });
  }
});

// GET /api/seasonal/vibes — top vibe tags across all experiences
router.get('/vibes', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT unnest(vibe_tags) AS vibe, COUNT(*) AS cnt
       FROM seasonal_experiences
       GROUP BY vibe
       ORDER BY cnt DESC
       LIMIT 20`
    );
    const vibes = result.rows.map(r => r.vibe);
    res.json({ success: true, vibes });
  } catch (err) {
    console.error('GET /api/seasonal/vibes error:', err);
    res.status(500).json({ success: false, error: 'Failed to load vibes' });
  }
});

// GET /api/seasonal/map — all experiences that have coords, for map view
// Supports same month/category/vibe filters as the main list endpoint.
router.get('/map', async (req, res) => {
  try {
    const { month, category, vibe } = req.query;
    const conditions = ['lat IS NOT NULL', 'lon IS NOT NULL'];
    const values = [];
    let p = 1;

    if (month) {
      const m = parseInt(month);
      if (m >= 1 && m <= 12) {
        conditions.push(`($${p} = ANY(months) OR array_length(months, 1) IS NULL OR array_length(months, 1) = 0)`);
        values.push(m);
        p++;
      }
    }

    if (category) {
      const matchingRaw = Object.entries(CAT_TO_GROUP)
        .filter(([, g]) => g === category)
        .map(([raw]) => raw);
      if (matchingRaw.length > 0) {
        const placeholders = matchingRaw.map((_, i) => `$${p + i}`).join(', ');
        conditions.push(
          `EXISTS (SELECT 1 FROM unnest(categories) AS c WHERE lower(c) = ANY(ARRAY[${placeholders}]))`
        );
        values.push(...matchingRaw);
        p += matchingRaw.length;
      }
    }

    if (vibe) {
      conditions.push(`$${p} = ANY(vibe_tags)`);
      values.push(vibe.toLowerCase());
      p++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const result = await db.query(
      `SELECT id, name, city, country, lat, lon, months, categories, vibe_tags, image_url, description
       FROM seasonal_experiences
       ${where}
       ORDER BY name`,
      values
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        city: row.city,
        country: row.country,
        lat: row.lat,
        lon: row.lon,
        months: row.months || [],
        categories: normalizeCategories(row.categories || []),
        vibeTags: (row.vibe_tags || []).slice(0, 5),
        imageUrl: row.image_url || null,
        description: row.description,
      })),
    });
  } catch (err) {
    console.error('GET /api/seasonal/map error:', err);
    res.status(500).json({ success: false, error: 'Failed to load map experiences' });
  }
});

// POST /api/seasonal/:id/click — increment global click count for popularity sorting
router.post('/:id/click', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(
      `UPDATE seasonal_experiences SET click_count = click_count + 1 WHERE id = $1`,
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/seasonal/:id/click error:', err);
    res.status(500).json({ success: false, error: 'Failed to record click' });
  }
});

module.exports = router;
