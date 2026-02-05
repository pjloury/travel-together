const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// GET /api/users/search?q=searchterm - search users
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 1) {
      return res.json({ success: true, data: [] });
    }

    const searchTerm = `%${q}%`;

    const result = await db.query(
      `SELECT id, username, display_name, email
       FROM users
       WHERE id != $1
         AND (username ILIKE $2 OR email ILIKE $2)
       ORDER BY username
       LIMIT 20`,
      [req.user.id, searchTerm]
    );

    res.json({
      success: true,
      data: result.rows.map(r => ({
        id: r.id,
        username: r.username,
        displayName: r.display_name
      }))
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper to check if two users are friends
async function areFriends(userId1, userId2) {
  const [id1, id2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
  const result = await db.query(
    `SELECT id FROM friendships 
     WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'accepted'`,
    [id1, id2]
  );
  return result.rows.length > 0;
}

// GET /api/users/:userId/profile - view user profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const isOwnProfile = userId === req.user.id;
    const isFriend = !isOwnProfile && await areFriends(req.user.id, userId);
    const canViewFull = isOwnProfile || isFriend;

    // Get basic user info
    const userResult = await db.query(
      `SELECT id, username, display_name, created_at,
              (SELECT COUNT(*) FROM country_visits WHERE user_id = $1) as total_countries
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Limited profile for non-friends
    if (!canViewFull) {
      return res.json({
        success: true,
        data: {
          id: user.id,
          displayName: user.display_name,
          totalCountries: parseInt(user.total_countries),
          isFriend: false
        }
      });
    }

    // Full profile for self or friends
    const countriesResult = await db.query(
      `SELECT cv.id, cv.country_code, cv.country_name, cv.created_at,
              COALESCE(
                json_agg(
                  json_build_object('id', city.id, 'cityName', city.city_name)
                ) FILTER (WHERE city.id IS NOT NULL), 
                '[]'
              ) as cities
       FROM country_visits cv
       LEFT JOIN city_visits city ON city.country_visit_id = cv.id
       WHERE cv.user_id = $1
       GROUP BY cv.id
       ORDER BY cv.created_at DESC`,
      [userId]
    );

    const wishlistResult = await db.query(
      `SELECT id, country_code, country_name, interest_level, specific_cities, created_at
       FROM country_wishlist WHERE user_id = $1
       ORDER BY interest_level DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at,
        totalCountries: parseInt(user.total_countries),
        isFriend: isFriend,
        countries: countriesResult.rows.map(r => ({
          id: r.id,
          countryCode: r.country_code,
          countryName: r.country_name,
          cities: r.cities
        })),
        wishlist: wishlistResult.rows.map(r => ({
          id: r.id,
          countryCode: r.country_code,
          countryName: r.country_name,
          interestLevel: r.interest_level,
          specificCities: r.specific_cities || []
        }))
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;

