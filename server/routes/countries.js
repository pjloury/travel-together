const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Validate country code against REST Countries API
async function validateCountryCode(countryCode) {
  try {
    const response = await fetch(`https://restcountries.com/v3.1/alpha/${countryCode}`);
    return response.ok;
  } catch (error) {
    console.error('Country validation error:', error);
    return false;
  }
}

// GET /api/countries - list user's visited countries
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, country_code, country_name, created_at 
       FROM country_visits 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        countryCode: row.country_code,
        countryName: row.country_name,
        createdAt: row.created_at
      }))
    });

  } catch (error) {
    console.error('List countries error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/countries - add country to visited
router.post('/', async (req, res) => {
  try {
    const { countryCode, countryName } = req.body;

    // Validation
    if (!countryCode || !countryName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Country code and name are required' 
      });
    }

    // Validate country code
    const isValid = await validateCountryCode(countryCode);
    if (!isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid country code' 
      });
    }

    // Check if already added
    const existing = await db.query(
      'SELECT id FROM country_visits WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Country already added' 
      });
    }

    // Insert
    const result = await db.query(
      `INSERT INTO country_visits (user_id, country_code, country_name)
       VALUES ($1, $2, $3)
       RETURNING id, country_code, country_name, created_at`,
      [req.user.id, countryCode, countryName]
    );

    const country = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: country.id,
        countryCode: country.country_code,
        countryName: country.country_name,
        createdAt: country.created_at
      }
    });

  } catch (error) {
    console.error('Add country error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// DELETE /api/countries/:countryCode - remove country
router.delete('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    const result = await db.query(
      'DELETE FROM country_visits WHERE user_id = $1 AND country_code = $2 RETURNING id',
      [req.user.id, countryCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Country not found' 
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete country error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/countries/:countryCode/cities - list cities in country
router.get('/:countryCode/cities', async (req, res) => {
  try {
    const { countryCode } = req.params;

    // Get country visit
    const countryResult = await db.query(
      'SELECT id FROM country_visits WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );

    if (countryResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Country not in your travel history' 
      });
    }

    const countryVisitId = countryResult.rows[0].id;

    const result = await db.query(
      `SELECT id, city_name, place_id, created_at 
       FROM city_visits 
       WHERE country_visit_id = $1 
       ORDER BY created_at DESC`,
      [countryVisitId]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        cityName: row.city_name,
        placeId: row.place_id,
        createdAt: row.created_at
      }))
    });

  } catch (error) {
    console.error('List cities error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/countries/:countryCode/detail - comprehensive country info
router.get('/:countryCode/detail', async (req, res) => {
  try {
    const { countryCode } = req.params;

    // Get user's visit to this country
    const visitResult = await db.query(
      'SELECT id, country_name FROM country_visits WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );

    const visited = visitResult.rows.length > 0;
    const countryName = visitResult.rows[0]?.country_name || '';
    
    // Get cities if visited
    let cities = [];
    if (visited) {
      const citiesResult = await db.query(
        `SELECT id, city_name, place_id FROM city_visits WHERE country_visit_id = $1`,
        [visitResult.rows[0].id]
      );
      cities = citiesResult.rows.map(r => ({
        id: r.id,
        cityName: r.city_name,
        placeId: r.place_id
      }));
    }

    // Check wishlist status
    const wishlistResult = await db.query(
      'SELECT interest_level, specific_cities FROM country_wishlist WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );
    const onWishlist = wishlistResult.rows.length > 0;
    const wishlistInfo = onWishlist ? {
      interestLevel: wishlistResult.rows[0].interest_level,
      specificCities: wishlistResult.rows[0].specific_cities || []
    } : null;

    // Get friends who've visited
    const friendsResult = await db.query(
      `SELECT 
        CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END as friend_id
       FROM friendships 
       WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
      [req.user.id]
    );
    const friendIds = friendsResult.rows.map(r => r.friend_id);

    let friendsVisited = [];
    let friendsWant = [];

    if (friendIds.length > 0) {
      // Friends who've been
      const fvResult = await db.query(
        `SELECT u.id, u.display_name,
          ARRAY_AGG(DISTINCT cv2.city_name) FILTER (WHERE cv2.city_name IS NOT NULL) as cities
         FROM users u
         JOIN country_visits cv ON cv.user_id = u.id AND cv.country_code = $1
         LEFT JOIN city_visits cv2 ON cv2.country_visit_id = cv.id
         WHERE u.id = ANY($2)
         GROUP BY u.id, u.display_name`,
        [countryCode, friendIds]
      );
      friendsVisited = fvResult.rows.map(r => ({
        id: r.id,
        displayName: r.display_name,
        citiesVisited: r.cities || []
      }));

      // Friends who want to go
      const fwResult = await db.query(
        `SELECT u.id, u.display_name, cw.interest_level, cw.specific_cities
         FROM users u
         JOIN country_wishlist cw ON cw.user_id = u.id AND cw.country_code = $1
         WHERE u.id = ANY($2)`,
        [countryCode, friendIds]
      );
      friendsWant = fwResult.rows.map(r => ({
        id: r.id,
        displayName: r.display_name,
        interestLevel: r.interest_level,
        specificCities: r.specific_cities || []
      }));
    }

    // Get country name if we don't have it
    let finalCountryName = countryName;
    if (!finalCountryName && (onWishlist || friendsVisited.length > 0)) {
      if (onWishlist) {
        const wlName = await db.query(
          'SELECT country_name FROM country_wishlist WHERE user_id = $1 AND country_code = $2',
          [req.user.id, countryCode]
        );
        finalCountryName = wlName.rows[0]?.country_name || countryCode;
      }
    }

    res.json({
      success: true,
      data: {
        countryCode,
        countryName: finalCountryName || countryCode,
        visited,
        cities,
        onWishlist,
        wishlistInfo,
        friendsVisited,
        friendsWant
      }
    });

  } catch (error) {
    console.error('Country detail error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/countries/:countryCode/cities - add city to country
router.post('/:countryCode/cities', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { cityName, placeId } = req.body;

    if (!cityName) {
      return res.status(400).json({ 
        success: false, 
        error: 'City name is required' 
      });
    }

    // Get country visit
    const countryResult = await db.query(
      'SELECT id FROM country_visits WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );

    if (countryResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Country not in your travel history' 
      });
    }

    const countryVisitId = countryResult.rows[0].id;

    const result = await db.query(
      `INSERT INTO city_visits (user_id, country_visit_id, city_name, place_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, city_name, place_id, created_at`,
      [req.user.id, countryVisitId, cityName, placeId || null]
    );

    const city = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: city.id,
        cityName: city.city_name,
        placeId: city.place_id,
        createdAt: city.created_at
      }
    });

  } catch (error) {
    console.error('Add city error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;

