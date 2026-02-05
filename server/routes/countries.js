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

module.exports = router;

