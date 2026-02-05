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

// GET /api/wishlist - list user's wishlist with friend annotations
router.get('/', async (req, res) => {
  try {
    // Get user's wishlist
    const wishlistResult = await db.query(
      `SELECT id, country_code, country_name, interest_level, specific_cities, created_at 
       FROM country_wishlist 
       WHERE user_id = $1 
       ORDER BY interest_level DESC, created_at DESC`,
      [req.user.id]
    );

    // Get user's accepted friends (handle case where table doesn't exist yet)
    let friendIds = [];
    try {
      const friendsResult = await db.query(
        `SELECT 
          CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END as friend_id
         FROM friendships 
         WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
        [req.user.id]
      );
      friendIds = friendsResult.rows.map(r => r.friend_id);
    } catch (err) {
      // Friendships table may not exist yet
      friendIds = [];
    }

    // Build response with friend annotations
    const data = await Promise.all(wishlistResult.rows.map(async (item) => {
      let friendsWhoHaveBeen = [];
      let friendsWhoAlsoWant = [];

      if (friendIds.length > 0) {
        // Friends who have visited this country (including city visits)
        const visitedResult = await db.query(
          `SELECT DISTINCT u.id, u.display_name,
            ARRAY_AGG(DISTINCT cv2.city_name) FILTER (WHERE cv2.city_name IS NOT NULL) as cities_visited
           FROM users u
           JOIN country_visits cv ON cv.user_id = u.id AND cv.country_code = $1
           LEFT JOIN city_visits cv2 ON cv2.country_visit_id = cv.id
           WHERE u.id = ANY($2)
           GROUP BY u.id, u.display_name`,
          [item.country_code, friendIds]
        );
        friendsWhoHaveBeen = visitedResult.rows.map(r => ({
          id: r.id,
          displayName: r.display_name,
          citiesVisited: r.cities_visited || []
        }));

        // Friends who also want to visit
        const wantResult = await db.query(
          `SELECT u.id, u.display_name, cw.interest_level, cw.specific_cities
           FROM users u
           JOIN country_wishlist cw ON cw.user_id = u.id AND cw.country_code = $1
           WHERE u.id = ANY($2)`,
          [item.country_code, friendIds]
        );
        friendsWhoAlsoWant = wantResult.rows.map(r => ({
          id: r.id,
          displayName: r.display_name,
          interestLevel: r.interest_level,
          specificCities: r.specific_cities || []
        }));
      }

      return {
        id: item.id,
        countryCode: item.country_code,
        countryName: item.country_name,
        interestLevel: item.interest_level,
        specificCities: item.specific_cities || [],
        createdAt: item.created_at,
        friendsWhoHaveBeen,
        friendsWhoAlsoWant
      };
    }));

    res.json({ success: true, data });

  } catch (error) {
    console.error('List wishlist error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/wishlist - add country to wishlist
router.post('/', async (req, res) => {
  try {
    const { countryCode, countryName, interestLevel, specificCities } = req.body;

    if (!countryCode || !countryName || !interestLevel) {
      return res.status(400).json({ 
        success: false, 
        error: 'Country code, name, and interest level are required' 
      });
    }

    if (interestLevel < 1 || interestLevel > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Interest level must be between 1 and 5' 
      });
    }

    // Validate country code
    const isValid = await validateCountryCode(countryCode);
    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Invalid country code' });
    }

    // Check if already on wishlist
    const existing = await db.query(
      'SELECT id FROM country_wishlist WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Country already on wishlist' });
    }

    const result = await db.query(
      `INSERT INTO country_wishlist (user_id, country_code, country_name, interest_level, specific_cities)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, country_code, country_name, interest_level, specific_cities, created_at`,
      [req.user.id, countryCode, countryName, interestLevel, specificCities || []]
    );

    const item = result.rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: item.id,
        countryCode: item.country_code,
        countryName: item.country_name,
        interestLevel: item.interest_level,
        specificCities: item.specific_cities || [],
        createdAt: item.created_at
      }
    });

  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/wishlist/:countryCode - update wishlist item
router.put('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;
    const { interestLevel, specificCities } = req.body;

    // Check if exists
    const existing = await db.query(
      'SELECT id FROM country_wishlist WHERE user_id = $1 AND country_code = $2',
      [req.user.id, countryCode]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wishlist item not found' });
    }

    // Build update query dynamically
    const updates = [];
    const values = [req.user.id, countryCode];
    let paramIndex = 3;

    if (interestLevel !== undefined) {
      if (interestLevel < 1 || interestLevel > 5) {
        return res.status(400).json({ 
          success: false, 
          error: 'Interest level must be between 1 and 5' 
        });
      }
      updates.push(`interest_level = $${paramIndex++}`);
      values.push(interestLevel);
    }

    if (specificCities !== undefined) {
      updates.push(`specific_cities = $${paramIndex++}`);
      values.push(specificCities);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }

    const result = await db.query(
      `UPDATE country_wishlist SET ${updates.join(', ')}
       WHERE user_id = $1 AND country_code = $2
       RETURNING id, country_code, country_name, interest_level, specific_cities, created_at`,
      values
    );

    const item = result.rows[0];
    res.json({
      success: true,
      data: {
        id: item.id,
        countryCode: item.country_code,
        countryName: item.country_name,
        interestLevel: item.interest_level,
        specificCities: item.specific_cities || [],
        createdAt: item.created_at
      }
    });

  } catch (error) {
    console.error('Update wishlist error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/wishlist/:countryCode - remove from wishlist
router.delete('/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    const result = await db.query(
      'DELETE FROM country_wishlist WHERE user_id = $1 AND country_code = $2 RETURNING id',
      [req.user.id, countryCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Wishlist item not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete wishlist error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

