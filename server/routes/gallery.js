// Gallery routes — curated travel photo collection
const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { fetchDreamImage } = require('../services/unsplash');
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

// GET /api/gallery/resort-photo — fetch an Unsplash photo for a resort query (public)
router.get('/resort-photo', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    if (!accessKey) {
      return res.json({ imageUrl: null, thumbUrl: null });
    }

    const url = new URL('https://api.unsplash.com/search/photos');
    url.searchParams.set('query', `${query} landscape scenery -people -portrait -person -selfie`);
    url.searchParams.set('per_page', '5');
    url.searchParams.set('orientation', 'landscape');

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Client-ID ${accessKey}` },
    });

    if (!response.ok) {
      console.error('[gallery] Unsplash error:', response.status);
      return res.json({ imageUrl: null, thumbUrl: null });
    }

    const data = await response.json();
    const results = data.results || [];
    if (results.length === 0) {
      return res.json({ imageUrl: null, thumbUrl: null });
    }

    // Pick the most-liked photo for quality
    const best = results.reduce((a, b) => (b.likes || 0) > (a.likes || 0) ? b : a, results[0]);

    res.json({
      imageUrl: best.urls.regular,
      thumbUrl: best.urls.small,
    });
  } catch (err) {
    console.error('[gallery] resort-photo error:', err.message);
    res.json({ imageUrl: null, thumbUrl: null });
  }
});

// POST /api/gallery/suggest — AI suggests 5 stunning lesser-known places (auth required)
router.post('/suggest', authMiddleware, async (req, res) => {
  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(503).json({ error: 'AI suggestions not available' });
    }

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

    // Call OpenAI for 5 picturesque places
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a travel expert who specializes in lesser-known, breathtaking destinations. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: `Suggest 5 stunning, lesser-known travel destinations that most people haven't heard of. For each, provide:
- location: the specific place name
- country: the country
- region: geographic region (Asia, Europe, Africa, Latin America, Middle East, North America, Oceania, South America)
- description: 1-2 evocative sentences about why it's breathtaking
- searchQuery: a short Unsplash search query (3-5 words) to find a beautiful photo of this place

Avoid well-known tourist spots like Paris, Tokyo, Bali, etc. Focus on hidden gems — remote valleys, undiscovered coastlines, forgotten villages, secret islands.

Return JSON: { "places": [ { "location", "country", "region", "description", "searchQuery" } ] }`,
          },
        ],
        temperature: 0.9,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[gallery] OpenAI error:', aiRes.status, errText.slice(0, 200));
      return res.status(502).json({ error: 'AI service error' });
    }

    const aiData = await aiRes.json();
    const raw = aiData?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim());
    } catch {
      console.error('[gallery] JSON parse error:', raw.slice(0, 200));
      return res.status(502).json({ error: 'Could not parse AI response' });
    }

    const places = parsed.places || [];

    // Fetch Unsplash photos for each place
    const results = await Promise.allSettled(
      places.map(async (place) => {
        let imageUrl = null;
        let thumbUrl = null;

        if (unsplashKey) {
          try {
            const searchUrl = new URL('https://api.unsplash.com/search/photos');
            searchUrl.searchParams.set('query', `${place.searchQuery} landscape -people -portrait`);
            searchUrl.searchParams.set('per_page', '3');
            searchUrl.searchParams.set('orientation', 'landscape');

            const photoRes = await fetch(searchUrl.toString(), {
              headers: { 'Authorization': `Client-ID ${unsplashKey}` },
            });

            if (photoRes.ok) {
              const photoData = await photoRes.json();
              const photos = photoData.results || [];
              if (photos.length > 0) {
                const best = photos.reduce((a, b) => (b.likes || 0) > (a.likes || 0) ? b : a, photos[0]);
                imageUrl = best.urls.regular;
                thumbUrl = best.urls.small;
              }
            }
          } catch (err) {
            console.error('[gallery] Unsplash fetch error for', place.location, err.message);
          }
        }

        return {
          location: place.location,
          country: place.country,
          region: place.region,
          description: place.description,
          imageUrl,
          thumbUrl,
        };
      })
    );

    const suggestions = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    res.json({ suggestions });
  } catch (err) {
    console.error('[gallery] suggest error:', err.message);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

module.exports = router;
