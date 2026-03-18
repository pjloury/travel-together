const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Helper to get friend IDs
async function getFriendIds(userId) {
  const result = await db.query(
    `SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END as friend_id
     FROM friendships
     WHERE (user_id_1 = $1 OR user_id_2 = $1) AND status = 'accepted'`,
    [userId]
  );
  return result.rows.map(r => r.friend_id);
}

// GET /api/alignment/i-can-help - Places I've BEEN that friends WANT
router.get('/i-can-help', async (req, res) => {
  try {
    const friendIds = await getFriendIds(req.user.id);
    
    if (friendIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get countries I've visited with my cities
    const myCountries = await db.query(
      `SELECT cv.country_code, cv.country_name,
              ARRAY_AGG(DISTINCT city.city_name) FILTER (WHERE city.city_name IS NOT NULL) as my_cities
       FROM country_visits cv
       LEFT JOIN city_visits city ON city.country_visit_id = cv.id
       WHERE cv.user_id = $1
       GROUP BY cv.country_code, cv.country_name`,
      [req.user.id]
    );

    if (myCountries.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const countryCodes = myCountries.rows.map(c => c.country_code);

    // Get friends who want these countries
    const friendsWant = await db.query(
      `SELECT cw.country_code, u.id as friend_id, u.display_name, 
              cw.interest_level, cw.specific_cities
       FROM country_wishlist cw
       JOIN users u ON u.id = cw.user_id
       WHERE cw.user_id = ANY($1) AND cw.country_code = ANY($2)`,
      [friendIds, countryCodes]
    );

    // Build response
    const data = myCountries.rows
      .map(country => {
        const friendsWhoWant = friendsWant.rows
          .filter(f => f.country_code === country.country_code)
          .map(f => ({
            id: f.friend_id,
            displayName: f.display_name,
            interestLevel: f.interest_level,
            specificCities: f.specific_cities || []
          }));

        if (friendsWhoWant.length === 0) return null;

        return {
          countryCode: country.country_code,
          countryName: country.country_name,
          myCitiesVisited: country.my_cities || [],
          friendsWhoWant
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.friendsWhoWant.length - a.friendsWhoWant.length);

    res.json({ success: true, data });

  } catch (error) {
    console.error('I can help error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/alignment/help-me - Places I WANT that friends have BEEN
router.get('/help-me', async (req, res) => {
  try {
    const friendIds = await getFriendIds(req.user.id);
    
    if (friendIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get my wishlist
    const myWishlist = await db.query(
      `SELECT country_code, country_name, interest_level, specific_cities
       FROM country_wishlist WHERE user_id = $1`,
      [req.user.id]
    );

    if (myWishlist.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const countryCodes = myWishlist.rows.map(w => w.country_code);

    // Get friends who have visited these countries (with their cities)
    const friendsVisited = await db.query(
      `SELECT cv.country_code, u.id as friend_id, u.display_name,
              ARRAY_AGG(DISTINCT city.city_name) FILTER (WHERE city.city_name IS NOT NULL) as cities_visited
       FROM country_visits cv
       JOIN users u ON u.id = cv.user_id
       LEFT JOIN city_visits city ON city.country_visit_id = cv.id
       WHERE cv.user_id = ANY($1) AND cv.country_code = ANY($2)
       GROUP BY cv.country_code, u.id, u.display_name`,
      [friendIds, countryCodes]
    );

    // Build response
    const data = myWishlist.rows
      .map(wishItem => {
        const friendsWhoHaveBeen = friendsVisited.rows
          .filter(f => f.country_code === wishItem.country_code)
          .map(f => ({
            id: f.friend_id,
            displayName: f.display_name,
            citiesVisited: f.cities_visited || []
          }));

        if (friendsWhoHaveBeen.length === 0) return null;

        return {
          countryCode: wishItem.country_code,
          countryName: wishItem.country_name,
          myInterestLevel: wishItem.interest_level,
          mySpecificCities: wishItem.specific_cities || [],
          friendsWhoHaveBeen
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.friendsWhoHaveBeen.length - a.friendsWhoHaveBeen.length);

    res.json({ success: true, data });

  } catch (error) {
    console.error('Help me error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/alignment/lets-go - Places I WANT that friends also WANT
router.get('/lets-go', async (req, res) => {
  try {
    const friendIds = await getFriendIds(req.user.id);
    
    if (friendIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Get my wishlist
    const myWishlist = await db.query(
      `SELECT country_code, country_name, interest_level, specific_cities
       FROM country_wishlist WHERE user_id = $1`,
      [req.user.id]
    );

    if (myWishlist.rows.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const countryCodes = myWishlist.rows.map(w => w.country_code);

    // Get friends who also want these countries
    const friendsWant = await db.query(
      `SELECT cw.country_code, u.id as friend_id, u.display_name,
              cw.interest_level, cw.specific_cities
       FROM country_wishlist cw
       JOIN users u ON u.id = cw.user_id
       WHERE cw.user_id = ANY($1) AND cw.country_code = ANY($2)`,
      [friendIds, countryCodes]
    );

    // Build response
    const data = myWishlist.rows
      .map(wishItem => {
        const friendsWhoAlsoWant = friendsWant.rows
          .filter(f => f.country_code === wishItem.country_code)
          .map(f => ({
            id: f.friend_id,
            displayName: f.display_name,
            interestLevel: f.interest_level,
            specificCities: f.specific_cities || []
          }));

        if (friendsWhoAlsoWant.length === 0) return null;

        return {
          countryCode: wishItem.country_code,
          countryName: wishItem.country_name,
          myInterestLevel: wishItem.interest_level,
          mySpecificCities: wishItem.specific_cities || [],
          friendsWhoAlsoWant
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.friendsWhoAlsoWant.length - a.friendsWhoAlsoWant.length);

    res.json({ success: true, data });

  } catch (error) {
    console.error('Lets go error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/alignment/:friendId
 * Get detailed travel overlap with a specific friend
 */
router.get('/:friendId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { friendId } = req.params;

    // Verify friendship
    const friendship = await db.query(
      `SELECT id FROM friendships WHERE status = 'accepted' AND (
        (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)
      )`,
      [userId, friendId]
    );
    if (friendship.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Not friends' });
    }

    const friendInfo = await db.query(
      'SELECT id, username, display_name FROM users WHERE id = $1',
      [friendId]
    );

    // Shared wishlist
    const shared = await db.query(
      `SELECT cw1.country_code, cw1.country_name,
              cw1.interest_level as your_interest, cw2.interest_level as their_interest
       FROM country_wishlist cw1
       JOIN country_wishlist cw2 ON cw1.country_code = cw2.country_code
       WHERE cw1.user_id = $1 AND cw2.user_id = $2
       ORDER BY (cw1.interest_level + cw2.interest_level) DESC`,
      [userId, friendId]
    );

    // Only you want
    const onlyYou = await db.query(
      `SELECT cw.country_code, cw.country_name, cw.interest_level as your_interest
       FROM country_wishlist cw
       WHERE cw.user_id = $1
         AND NOT EXISTS (SELECT 1 FROM country_wishlist WHERE user_id = $2 AND country_code = cw.country_code)
       ORDER BY cw.interest_level DESC`,
      [userId, friendId]
    );

    // Only they want
    const onlyThem = await db.query(
      `SELECT cw.country_code, cw.country_name, cw.interest_level as their_interest
       FROM country_wishlist cw
       WHERE cw.user_id = $2
         AND NOT EXISTS (SELECT 1 FROM country_wishlist WHERE user_id = $1 AND country_code = cw.country_code)
       ORDER BY cw.interest_level DESC`,
      [userId, friendId]
    );

    // Countries I've visited that they want
    const iCanHelp = await db.query(
      `SELECT cv.country_code, cv.country_name, cw.interest_level as their_interest
       FROM country_visits cv
       JOIN country_wishlist cw ON cv.country_code = cw.country_code AND cw.user_id = $2
       WHERE cv.user_id = $1
       ORDER BY cw.interest_level DESC`,
      [userId, friendId]
    );

    // Countries they've visited that I want
    const theyCanHelp = await db.query(
      `SELECT cv.country_code, cv.country_name, cw.interest_level as your_interest
       FROM country_visits cv
       JOIN country_wishlist cw ON cv.country_code = cw.country_code AND cw.user_id = $1
       WHERE cv.user_id = $2
       ORDER BY cw.interest_level DESC`,
      [userId, friendId]
    );

    res.json({
      success: true,
      data: {
        friend: friendInfo.rows[0],
        sharedWishlist: shared.rows,
        onlyYouWant: onlyYou.rows,
        onlyTheyWant: onlyThem.rows,
        iCanHelp: iCanHelp.rows,
        theyCanHelp: theyCanHelp.rows
      }
    });
  } catch (error) {
    console.error('Alignment overlap error:', error);
    res.status(500).json({ success: false, error: 'Failed to get overlap' });
  }
});

module.exports = router;

