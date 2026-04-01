// Explore routes — curated trip clusters and experiences
//
// GET  /api/explore/trips               — list all trip clusters (auth required)
// GET  /api/explore/trips/personalized  — personalized trip ranking (auth required)
// GET  /api/explore/trips/:id           — trip detail + experiences (auth required)
// POST /api/explore/refresh             — trigger curator refresh (CURATOR_SECRET header)

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

/**
 * GET /api/explore/trips/personalized
 * Returns curated trips ranked for the current user based on their pins.
 * Uses OpenAI to score relevance and filter out destinations already visited.
 */
router.get('/trips/personalized', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch user's pins (memories + dreams)
    const pinsResult = await db.query(
      `SELECT pin_type, place_name, country, tags, dream_note, notes
       FROM pins
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    // Fetch all curated trips
    const tripsResult = await db.query(`
      SELECT
        t.id, t.city, t.country, t.region, t.title, t.description,
        t.image_url, t.days_suggested, t.tags, t.last_scraped_at,
        COUNT(e.id)::int AS experience_count
      FROM curated_trips t
      LEFT JOIN curated_experiences e ON e.trip_id = t.id
      GROUP BY t.id
      ORDER BY t.region, t.city
    `);

    const allTrips = tripsResult.rows;
    const pins = pinsResult.rows;

    // If no pins or no trips, return unranked list
    if (!pins.length || !allTrips.length) {
      return res.json({ trips: allTrips, personalized: false });
    }

    // Build a taste profile from the user's pins
    const memories = pins.filter(p => p.pin_type === 'memory');
    const dreams = pins.filter(p => p.pin_type === 'dream');

    const visitedPlaces = memories.map(p => p.place_name).filter(Boolean);
    const dreamPlaces = dreams.map(p => p.place_name).filter(Boolean);
    const allTags = pins.flatMap(p => p.tags || []);
    const tagFrequency = allTags.reduce((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
    const topTags = Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);

    // Use OpenAI to rank trips by relevance to this taste profile
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.json({ trips: allTrips, personalized: false });
    }

    const tripSummaries = allTrips.map(t =>
      `${t.id}: ${t.city}, ${t.country} (${t.region}) — tags: ${(t.tags || []).join(', ')}`
    ).join('\n');

    const profileDesc = [
      visitedPlaces.length ? `Places visited: ${visitedPlaces.slice(0, 10).join(', ')}` : '',
      dreamPlaces.length ? `Dream destinations: ${dreamPlaces.slice(0, 10).join(', ')}` : '',
      topTags.length ? `Top travel interests: ${topTags.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const prompt = `You are a travel recommendation engine. Given a user's taste profile and a list of curated trips, return a ranked list of trip IDs ordered from most to least relevant.

Rules:
- Prioritize trips similar in vibe/category to the user's interests
- Include destinations similar to dream pins but NOT identical cities
- Avoid cities already in visited places (they appear in memories)
- Return ALL trip IDs in ranked order

User taste profile:
${profileDesc}

Available trips (format: id: city, country — tags):
${tripSummaries}

Return ONLY a JSON array of trip IDs in ranked order, e.g.: ["id1", "id2", "id3"]`;

    let rankedIds = null;
    try {
      const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a travel recommendation engine. Respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 512,
          response_format: { type: 'json_object' },
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const raw = aiData?.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(raw);
        // Handle both array and {trips: [...]} shapes
        rankedIds = Array.isArray(parsed) ? parsed : (parsed.trips || parsed.ids || parsed.ranked || null);
      }
    } catch (err) {
      console.warn('[explore] personalized ranking AI error:', err.message);
    }

    // Apply ranking if we got valid IDs
    if (Array.isArray(rankedIds) && rankedIds.length > 0) {
      const idOrder = new Map(rankedIds.map((id, i) => [id, i]));
      const ranked = [...allTrips].sort((a, b) => {
        const ia = idOrder.has(a.id) ? idOrder.get(a.id) : Infinity;
        const ib = idOrder.has(b.id) ? idOrder.get(b.id) : Infinity;
        return ia - ib;
      });
      return res.json({ trips: ranked, personalized: true });
    }

    // Fallback: return unranked
    return res.json({ trips: allTrips, personalized: false });
  } catch (err) {
    console.error('[explore] GET /trips/personalized error:', err.message);
    res.status(500).json({ error: 'Failed to load personalized trips' });
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
