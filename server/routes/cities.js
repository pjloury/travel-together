const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// DELETE /api/cities/:cityId - remove city
router.delete('/:cityId', async (req, res) => {
  try {
    const { cityId } = req.params;

    const result = await db.query(
      'DELETE FROM city_visits WHERE id = $1 AND user_id = $2 RETURNING id',
      [cityId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'City not found' 
      });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete city error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;

