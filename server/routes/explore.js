// Explore routes — curated trip clusters and experiences
//
// GET  /api/explore/trips               — list all trip clusters (auth required)
// GET  /api/explore/trips/personalized  — personalized trip ranking (auth required, cached)
// GET  /api/explore/trips/:id           — trip detail + experiences (auth required)
// POST /api/explore/refresh             — trigger curator refresh (CURATOR_SECRET header)

const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { runCurator } = require('../services/curator');

// In-memory cache for personalized rankings: userId → { hash, rankedIds, timestamp }
const rankingCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// GET /api/explore/trips — summary list for the Explore grid (public — no auth required)
router.get('/trips', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        t.id, t.city, t.country, t.region, t.title, t.description,
        t.image_url, t.days_suggested, t.tags, t.last_scraped_at,
        COUNT(e.id)::int AS experience_count
      FROM curated_trips t
      LEFT JOIN curated_experiences e ON e.trip_id = t.id
      GROUP BY t.id
      ORDER BY t.city
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
 * Caches the ranking per user — only calls OpenAI when pins change.
 */
router.get('/trips/personalized', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    // Fetch all curated trips (fast DB query)
    const tripsResult = await db.query(`
      SELECT
        t.id, t.city, t.country, t.region, t.title, t.description,
        t.image_url, t.days_suggested, t.tags, t.last_scraped_at,
        COUNT(e.id)::int AS experience_count
      FROM curated_trips t
      LEFT JOIN curated_experiences e ON e.trip_id = t.id
      GROUP BY t.id
      ORDER BY t.city
    `);
    const allTrips = tripsResult.rows;

    if (!allTrips.length) {
      return res.json({ trips: allTrips, personalized: false });
    }

    // Quick hash of user's pin state (count + latest update)
    const hashResult = await db.query(
      `SELECT COUNT(*)::int AS cnt, MAX(updated_at)::text AS latest
       FROM pins WHERE user_id = $1 AND archived = false`,
      [userId]
    );
    const { cnt, latest } = hashResult.rows[0] || {};
    const pinHash = `${cnt}:${latest || 'none'}`;

    // Check cache
    const cached = rankingCache.get(userId);
    if (cached && cached.hash === pinHash && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
      // Apply cached ranking
      const ranked = applyRanking(allTrips, cached.rankedIds);
      return res.json({ trips: ranked, personalized: true });
    }

    // No cache hit — need to rank
    // First check if user has pins at all
    if (cnt === 0) {
      return res.json({ trips: allTrips, personalized: false });
    }

    // Fetch user's pins for taste profile
    const pinsResult = await db.query(
      `SELECT p.pin_type, p.place_name, p.normalized_country, p.dream_note, p.note,
              COALESCE(
                array_agg(et.name ORDER BY et.name) FILTER (WHERE et.name IS NOT NULL),
                '{}'
              ) AS tags
       FROM pins p
       LEFT JOIN pin_tags pt ON pt.pin_id = p.id
       LEFT JOIN experience_tags et ON et.id = pt.experience_tag_id
       WHERE p.user_id = $1
       GROUP BY p.id, p.pin_type, p.place_name, p.normalized_country, p.dream_note, p.note
       ORDER BY p.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const pins = pinsResult.rows;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!pins.length || !openaiKey) {
      return res.json({ trips: allTrips, personalized: false });
    }

    // Build taste profile
    const memories = pins.filter(p => p.pin_type === 'memory');
    const dreams = pins.filter(p => p.pin_type === 'dream');
    const visitedPlaces = memories.map(p => p.place_name).filter(Boolean);
    const dreamPlaces = dreams.map(p => p.place_name).filter(Boolean);
    const allTags = pins.flatMap(p => p.tags || []);
    const tagFrequency = allTags.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
    const topTags = Object.entries(tagFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);

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

Return ONLY a JSON object with a "trips" key containing an array of trip IDs in ranked order, e.g.: {"trips": ["id1", "id2", "id3"]}`;

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
        rankedIds = Array.isArray(parsed) ? parsed : (parsed.trips || parsed.ids || parsed.ranked || null);
      }
    } catch (err) {
      console.warn('[explore] personalized ranking AI error:', err.message);
    }

    if (Array.isArray(rankedIds) && rankedIds.length > 0) {
      // Cache the ranking
      rankingCache.set(userId, { hash: pinHash, rankedIds, timestamp: Date.now() });
      const ranked = applyRanking(allTrips, rankedIds);
      return res.json({ trips: ranked, personalized: true });
    }

    // Fallback: return unranked
    return res.json({ trips: allTrips, personalized: false });
  } catch (err) {
    console.error('[explore] GET /trips/personalized error:', err.message);
    res.status(500).json({ error: 'Failed to load personalized trips' });
  }
});

/** Apply ranking: top 3 personalized first, rest alphabetical by city */
function applyRanking(trips, rankedIds) {
  const top3Ids = new Set(rankedIds.slice(0, 3));
  const top3 = rankedIds.slice(0, 3)
    .map(id => trips.find(t => t.id === id))
    .filter(Boolean);
  const rest = trips
    .filter(t => !top3Ids.has(t.id))
    .sort((a, b) => (a.city || '').localeCompare(b.city || ''));
  return [...top3, ...rest];
}

// GET /api/explore/trips/:id — full trip with ordered experiences
// GET /api/explore/trips/:id — trip detail + experiences (public — no auth required)
router.get('/trips/:id', async (req, res) => {
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

// POST /api/explore/trips/generate — generate a discover card for a specific destination
router.post('/trips/generate', authMiddleware, async (req, res) => {
  const { city, country } = req.body;
  if (!city) return res.status(400).json({ error: 'city is required' });

  try {
    // Check if trip already exists
    const existing = await db.query('SELECT id FROM curated_trips WHERE LOWER(city) = LOWER($1)', [city]);
    if (existing.rows.length > 0) {
      // Return existing trip
      const trip = await db.query(
        `SELECT t.*, COUNT(e.id)::int AS experience_count
         FROM curated_trips t LEFT JOIN curated_experiences e ON e.trip_id = t.id
         WHERE t.id = $1 GROUP BY t.id`,
        [existing.rows[0].id]
      );
      return res.json({ success: true, trip: trip.rows[0], alreadyExisted: true });
    }

    // Generate via curator
    const { curateCity, upsertTrip, fetchCityPhoto } = require('../services/curator');
    const seedCity = { city, country: country || 'Unknown', region: country || 'Other' };
    const result = await curateCity(city, seedCity.country);

    if (!result?.trip || !Array.isArray(result?.experiences)) {
      return res.status(503).json({ error: 'Could not generate trip data. Try again.' });
    }

    const tripId = await upsertTrip(db, seedCity, result.trip, result.experiences);

    // Fetch iconic Unsplash photo
    try {
      const photoUrl = await fetchCityPhoto(city, seedCity.country);
      if (photoUrl) {
        await db.query('UPDATE curated_trips SET image_url = $1 WHERE id = $2', [photoUrl, tripId]);
      }
    } catch { /* photo is non-critical */ }

    const trip = await db.query(
      `SELECT t.*, COUNT(e.id)::int AS experience_count
       FROM curated_trips t LEFT JOIN curated_experiences e ON e.trip_id = t.id
       WHERE t.id = $1 GROUP BY t.id`,
      [tripId]
    );

    res.json({ success: true, trip: trip.rows[0], alreadyExisted: false });
  } catch (err) {
    console.error('[explore] generate trip error:', err.message);
    res.status(500).json({ error: 'Could not generate trip' });
  }
});

// POST /api/explore/refresh — curator-secret protected, responds immediately
router.post('/refresh', async (req, res) => {
  const secret = req.headers['x-curator-secret'];
  if (!secret || secret !== process.env.CURATOR_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Respond immediately — curator can take 40-60s for all cities
  const { SEED_CITIES } = require('../services/curator');
  res.json({ message: 'Curator refresh started', cities: SEED_CITIES.length });

  // Fire and forget
  runCurator(db).catch(err =>
    console.error('[explore] runCurator uncaught error:', err.message)
  );
});

// POST /api/explore/trips/:id/refresh-photo — admin: regenerate a trip's Unsplash photo
router.post('/trips/:id/refresh-photo', authMiddleware, async (req, res) => {
  const ADMIN_IDS = ['1c52f64b-a5ac-4823-a233-de3258401cb4']; // PJ
  if (!ADMIN_IDS.includes(req.user.id)) {
    return res.status(403).json({ error: 'Admin only' });
  }

  try {
    const { id } = req.params;
    const { query } = req.body || {};

    const trip = await db.query('SELECT city, country FROM curated_trips WHERE id = $1', [id]);
    if (!trip.rows.length) return res.status(404).json({ error: 'Trip not found' });

    const { fetchCityPhoto } = require('../services/curator');
    const photoUrl = query
      ? await (async () => {
          const { fetchDreamImage } = require('../services/unsplash');
          const result = await fetchDreamImage(query, []);
          return result?.imageUrl || null;
        })()
      : await fetchCityPhoto(trip.rows[0].city, trip.rows[0].country);

    if (!photoUrl) return res.status(404).json({ error: 'No photo found' });

    await db.query('UPDATE curated_trips SET image_url = $1 WHERE id = $2', [photoUrl, id]);
    res.json({ success: true, imageUrl: photoUrl });
  } catch (err) {
    console.error('Refresh trip photo error:', err);
    res.status(500).json({ error: 'Could not refresh photo' });
  }
});

// POST /api/explore/suggest-dream — generate a personalized dream pin suggestion
// Returns { placeName, dreamNote, unsplashImageUrl, unsplashAttribution }
router.post('/suggest-dream', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return res.status(503).json({ error: 'AI suggestions not configured' });
  }

  try {
    // Fetch user's existing memories and dreams for context / exclusion
    const pinsResult = await db.query(
      `SELECT place_name, pin_type, normalized_country
       FROM pins WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    const memories = pinsResult.rows.filter(p => p.pin_type === 'memory').map(p => p.place_name);
    const dreams   = pinsResult.rows.filter(p => p.pin_type === 'dream').map(p => p.place_name);

    const systemPrompt = `You are a travel curator. Based on a user's travel history and dreams, suggest one new dream destination they haven't considered yet. Respond ONLY with a JSON object: { "placeName": string, "dreamNote": string }. dreamNote should be 1-2 vivid sentences (max 120 chars) describing why this place is special.`;

    const userPrompt = `User has visited: ${memories.slice(0, 20).join(', ') || 'nowhere yet'}.
User already dreams of: ${dreams.slice(0, 20).join(', ') || 'nothing yet'}.
Suggest ONE dream destination that is different from all of the above. Make it specific (a city, region, or landmark — not just a country).`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 1.1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[explore] suggest-dream OpenAI error:', resp.status, errText.slice(0, 200));
      return res.status(503).json({ error: 'Could not generate suggestion' });
    }

    const aiData = await resp.json();
    let suggestion;
    try {
      suggestion = JSON.parse(aiData.choices[0].message.content);
    } catch {
      return res.status(503).json({ error: 'Could not parse suggestion' });
    }

    const { placeName, dreamNote } = suggestion;
    if (!placeName) return res.status(503).json({ error: 'No place suggested' });

    // Fetch an Unsplash image for the destination
    let unsplashImageUrl = null;
    let unsplashAttribution = null;
    try {
      const { fetchDreamImage } = require('../services/unsplash');
      const photo = await fetchDreamImage(placeName, []);
      if (photo) {
        unsplashImageUrl = photo.imageUrl || photo.url || null;
        unsplashAttribution = photo.attribution || null;
      }
    } catch { /* photo is non-critical */ }

    res.json({ placeName, dreamNote: dreamNote || '', unsplashImageUrl, unsplashAttribution });
  } catch (err) {
    console.error('[explore] suggest-dream error:', err.message);
    res.status(500).json({ error: 'Could not generate suggestion' });
  }
});

// Exposed for testing only
router._clearRankingCache = () => rankingCache.clear();

module.exports = router;
