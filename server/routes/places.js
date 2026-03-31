// Places autocomplete proxy — keeps GOOGLE_PLACES_KEY server-side.
// GET /api/places/autocomplete?q=<text>
// Returns array of { description, placeId, mainText, secondaryText }

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.get('/autocomplete', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return res.json([]);

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(q)}&key=${key}&types=(regions)`;
    const resp = await fetch(url);
    const data = await resp.json();

    const results = (data.predictions || []).slice(0, 6).map(p => ({
      description:   p.description,
      placeId:       p.place_id,
      mainText:      p.structured_formatting?.main_text || p.description,
      secondaryText: p.structured_formatting?.secondary_text || '',
    }));
    res.json(results);
  } catch (err) {
    console.error('Places autocomplete error:', err.message);
    res.json([]);
  }
});

module.exports = router;
