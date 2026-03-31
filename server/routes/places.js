// Places autocomplete proxy — keeps GOOGLE_PLACES_KEY server-side.
// Uses the Google Places API (New) — https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
//
// GET /api/places/autocomplete?q=<text>
// Returns array of { description, placeId, mainText, secondaryText }

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');

router.get('/autocomplete', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) {
    console.warn('[places] GOOGLE_PLACES_KEY not set');
    return res.json([]);
  }

  try {
    // New Places API (v1) — POST-based with field masks
    const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': [
          'suggestions.placePrediction.placeId',
          'suggestions.placePrediction.text',
          'suggestions.placePrediction.structuredFormat',
        ].join(','),
      },
      body: JSON.stringify({
        input: q,
        // No includedPrimaryTypes restriction — allow cities, countries, regions,
        // neighbourhoods, landmarks, etc. so "New York", "Kyoto", "Patagonia" all work.
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[places] API error:', resp.status, errText);
      return res.json([]);
    }

    const data = await resp.json();

    const results = (data.suggestions || []).slice(0, 6).map(s => {
      const pred = s.placePrediction || {};
      return {
        description:   pred.text?.text || '',
        placeId:       pred.placeId || '',
        mainText:      pred.structuredFormat?.mainText?.text || pred.text?.text || '',
        secondaryText: pred.structuredFormat?.secondaryText?.text || '',
      };
    });

    res.json(results);
  } catch (err) {
    console.error('[places] autocomplete error:', err.message);
    res.json([]);
  }
});

module.exports = router;
