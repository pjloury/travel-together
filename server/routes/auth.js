const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, displayName } = req.body;

    // Validation
    if (!email || !username || !password || !displayName) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters' 
      });
    }

    // Check for existing email
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Email already exists' 
      });
    }

    // Check for existing username
    const usernameCheck = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (usernameCheck.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: 'Username already exists' 
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await db.query(
      `INSERT INTO users (email, username, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, display_name, created_at`,
      [email, username, displayName, passwordHash]
    );

    const user = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;

