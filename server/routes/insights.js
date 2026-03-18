const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { generateCountryProfile, generatePersonalizedRecommendations, generateTripProposal, generateTravelProfile } = require('../services/claude');

const router = express.Router();

/**
 * GET /api/insights/country/:code
 * Get AI-generated cultural facts and travel guide for a country
 * Cached in DB, regenerated if older than 30 days
 */
router.get('/country/:code', auth, async (req, res) => {
  try {
    const { code } = req.params;
    const countryCode = code.toUpperCase();

    // Check cache
    const cached = await db.query(
      `SELECT * FROM country_profiles WHERE country_code = $1
       AND ai_generated_at > NOW() - INTERVAL '30 days'`,
      [countryCode]
    );

    if (cached.rows.length > 0) {
      return res.json({ success: true, data: cached.rows[0], cached: true });
    }

    const { name } = req.query; // optional fallback country name

    // Get country name from user's visits or wishlist
    const countryInfo = await db.query(
      `SELECT DISTINCT country_name FROM country_visits WHERE country_code = $1
       UNION
       SELECT DISTINCT country_name FROM country_wishlist WHERE country_code = $1
       LIMIT 1`,
      [countryCode]
    );

    let countryName;
    if (countryInfo.rows.length === 0 && name) {
      countryName = name;
    } else if (countryInfo.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Country not found' });
    } else {
      countryName = countryInfo.rows[0].country_name;
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'AI service not configured',
        hint: 'Set ANTHROPIC_API_KEY environment variable'
      });
    }

    // Generate with AI
    const profile = await generateCountryProfile(countryCode, countryName);

    // Upsert into cache
    const result = await db.query(
      `INSERT INTO country_profiles
         (country_code, country_name, best_times, cultural_facts, general_tips, top_experiences, vibe, ai_generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (country_code) DO UPDATE SET
         best_times = $3, cultural_facts = $4, general_tips = $5,
         top_experiences = $6, vibe = $7, ai_generated_at = NOW()
       RETURNING *`,
      [
        countryCode, countryName,
        JSON.stringify(profile.bestTimes || []),
        profile.culturalFacts || [],
        profile.generalTips || [],
        JSON.stringify(profile.topExperiences || []),
        profile.vibe || null
      ]
    );

    res.json({ success: true, data: result.rows[0], cached: false });
  } catch (error) {
    console.error('Country insights error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate insights' });
  }
});

/**
 * GET /api/insights/discover
 * Personalized destination recommendations based on travel history + friends
 */
router.get('/discover', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's visited countries
    const visitedResult = await db.query(
      'SELECT country_code, country_name FROM country_visits WHERE user_id = $1',
      [userId]
    );

    // Get user's wishlist
    const wishlistResult = await db.query(
      'SELECT country_code, country_name, interest_level FROM country_wishlist WHERE user_id = $1',
      [userId]
    );

    // Get friends' wishlists (for overlap suggestions)
    const friendsWishlistResult = await db.query(
      `SELECT DISTINCT cw.country_code, cw.country_name
       FROM country_wishlist cw
       JOIN friendships f ON (
         (f.user_id_1 = $1 AND f.user_id_2 = cw.user_id) OR
         (f.user_id_2 = $1 AND f.user_id_1 = cw.user_id)
       )
       WHERE f.status = 'accepted' AND cw.user_id != $1`,
      [userId]
    );

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'AI service not configured'
      });
    }

    const result = await generatePersonalizedRecommendations(
      visitedResult.rows,
      wishlistResult.rows,
      friendsWishlistResult.rows
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Discover error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate recommendations' });
  }
});

/**
 * POST /api/insights/trip-proposal
 * Generate an AI trip proposal for a group
 * Body: { countryCode, countryName, participantIds: [userId, ...] }
 */
router.post('/trip-proposal', auth, async (req, res) => {
  try {
    const { countryCode, countryName, participantIds = [] } = req.body;
    const userId = req.user.id;

    if (!countryCode || !countryName) {
      return res.status(400).json({ success: false, error: 'countryCode and countryName are required' });
    }

    // All participants = current user + specified friends
    const allParticipantIds = [userId, ...participantIds.filter(id => id !== userId)];

    // Get each participant's travel context
    const participants = [];
    for (const participantId of allParticipantIds) {
      const userResult = await db.query(
        'SELECT id, display_name FROM users WHERE id = $1',
        [participantId]
      );
      if (!userResult.rows[0]) continue;

      const visited = await db.query(
        'SELECT country_name FROM country_visits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [participantId]
      );
      const wishlist = await db.query(
        'SELECT country_name FROM country_wishlist WHERE user_id = $1 ORDER BY interest_level DESC LIMIT 8',
        [participantId]
      );

      participants.push({
        displayName: userResult.rows[0].display_name,
        visited: visited.rows.map(r => r.country_name),
        wishlist: wishlist.rows.map(r => r.country_name)
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'AI service not configured' });
    }

    const proposal = await generateTripProposal(countryCode, countryName, participants);

    // Save proposal to DB
    const saved = await db.query(
      `INSERT INTO trip_proposals
         (created_by, country_code, country_name, title, mood, tagline, duration,
          activities, itinerary, best_time_to_go, group_tip, is_ai_generated, participant_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12)
       RETURNING *`,
      [
        userId, countryCode, countryName,
        proposal.title, proposal.mood, proposal.tagline, proposal.duration,
        proposal.activities || [],
        proposal.itinerary, proposal.bestTimeToGo, proposal.groupTip,
        allParticipantIds
      ]
    );

    res.json({ success: true, data: saved.rows[0] });
  } catch (error) {
    console.error('Trip proposal error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate trip proposal' });
  }
});

/**
 * GET /api/insights/trip-proposals
 * Get all trip proposals created by or involving current user
 */
router.get('/trip-proposals', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query(
      `SELECT tp.*, u.display_name as creator_name
       FROM trip_proposals tp
       JOIN users u ON tp.created_by = u.id
       WHERE tp.created_by = $1 OR $1 = ANY(tp.participant_ids)
       ORDER BY tp.created_at DESC`,
      [userId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get proposals error:', error);
    res.status(500).json({ success: false, error: 'Failed to get proposals' });
  }
});

/**
 * GET /api/insights/travel-profile
 * Get or generate current user's AI travel profile
 */
router.get('/travel-profile', auth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check cache (7 days)
    const cached = await db.query(
      `SELECT * FROM user_travel_profiles
       WHERE user_id = $1 AND generated_at > NOW() - INTERVAL '7 days'`,
      [userId]
    );

    if (cached.rows.length > 0) {
      return res.json({ success: true, data: cached.rows[0], cached: true });
    }

    const visited = await db.query(
      'SELECT country_code, country_name FROM country_visits WHERE user_id = $1',
      [userId]
    );
    const wishlist = await db.query(
      'SELECT country_code, country_name, interest_level FROM country_wishlist WHERE user_id = $1',
      [userId]
    );

    if (visited.rows.length === 0 && wishlist.rows.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: 'Add some countries to get your travel profile!'
      });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ success: false, error: 'AI service not configured' });
    }

    const profile = await generateTravelProfile(visited.rows, wishlist.rows);

    const saved = await db.query(
      `INSERT INTO user_travel_profiles
         (user_id, profile_summary, travel_style, top_regions, insights, next_challenge, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         profile_summary = $2, travel_style = $3, top_regions = $4,
         insights = $5, next_challenge = $6, generated_at = NOW()
       RETURNING *`,
      [
        userId, profile.summary, profile.travelStyle,
        profile.topRegions || [], profile.insights || [],
        profile.nextChallenge
      ]
    );

    res.json({ success: true, data: saved.rows[0], cached: false });
  } catch (error) {
    console.error('Travel profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate travel profile' });
  }
});

/**
 * GET /api/insights/travel-profile/:userId
 * Get another user's travel profile (must be friends)
 */
router.get('/travel-profile/:userId', auth, async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const requesterId = req.user.id;

    // Check friendship
    const friendship = await db.query(
      `SELECT id FROM friendships
       WHERE status = 'accepted' AND (
         (user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1)
       )`,
      [requesterId, targetUserId]
    );

    if (friendship.rows.length === 0 && requesterId !== targetUserId) {
      return res.status(403).json({ success: false, error: 'Must be friends to view travel profile' });
    }

    const profile = await db.query(
      'SELECT * FROM user_travel_profiles WHERE user_id = $1',
      [targetUserId]
    );

    res.json({ success: true, data: profile.rows[0] || null });
  } catch (error) {
    console.error('Get friend travel profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get travel profile' });
  }
});

module.exports = router;
