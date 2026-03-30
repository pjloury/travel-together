// Location normalization and Unsplash image routes for Travel Together
//
// Spec: docs/app/spec.md (Section 6: Location Normalization, Section 7: Unsplash Integration)
// Contract: docs/app/spec.md

const express = require('express');
const authMiddleware = require('../middleware/auth');
const { normalizeLocation } = require('../services/claude');
const { fetchDreamImage, getFallbackForTag } = require('../services/unsplash');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/location/normalize
 *
 * Normalizes a free-form place name to structured location data.
 *
 * @implements REQ-LOCATION-001, REQ-LOCATION-002, SCN-LOCATION-002-01
 *
 * Request body: { placeName: string }
 * Response: { success: true, data: { display_name, normalized_city, normalized_country, normalized_region, latitude, longitude, confidence } }
 * On failure: returns original placeName as display_name with confidence 'low' (never hard-fails)
 */
router.post('/normalize', async (req, res) => {
  try {
    const { placeName } = req.body;

    if (!placeName) {
      return res.status(400).json({
        success: false,
        error: 'placeName is required.',
      });
    }

    const result = await normalizeLocation(placeName);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Location normalization error:', error);
    // Per spec: never hard-fail. Return original placeName with low confidence.
    res.json({
      success: true,
      data: {
        display_name: req.body.placeName,
        normalized_city: null,
        normalized_country: null,
        normalized_region: null,
        latitude: null,
        longitude: null,
        confidence: 'low',
      },
    });
  }
});

/**
 * POST /api/location/unsplash
 *
 * Fetches an Unsplash image for a dream pin, with gradient+emoji fallback.
 *
 * @implements REQ-DREAM-002, SCN-DREAM-002-01
 *
 * Request body: { placeName: string, tags?: string[] }
 * Response on image found: { success: true, data: { imageUrl, attribution, fallback: false } }
 * Response on no image: { success: true, data: { gradient, emoji, fallback: true } }
 */
router.post('/unsplash', async (req, res) => {
  try {
    const { placeName, tags } = req.body;

    if (!placeName) {
      return res.status(400).json({
        success: false,
        error: 'placeName is required.',
      });
    }

    const result = await fetchDreamImage(placeName, tags || []);

    if (result) {
      res.json({
        success: true,
        data: {
          imageUrl: result.imageUrl,
          attribution: result.attribution,
          fallback: false,
        },
      });
    } else {
      // No Unsplash result: return gradient+emoji fallback from first tag
      const fallback = getFallbackForTag(tags && tags.length > 0 ? tags[0] : null);
      res.json({
        success: true,
        data: {
          gradient: fallback.gradient,
          emoji: fallback.emoji,
          fallback: true,
        },
      });
    }
  } catch (error) {
    console.error('Unsplash fetch error:', error);
    // Fallback on any error
    const { tags } = req.body;
    const fallback = getFallbackForTag(tags && tags.length > 0 ? tags[0] : null);
    res.json({
      success: true,
      data: {
        gradient: fallback.gradient,
        emoji: fallback.emoji,
        fallback: true,
      },
    });
  }
});

module.exports = router;
