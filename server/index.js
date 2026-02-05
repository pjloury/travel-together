const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db');
const authRoutes = require('./routes/auth');
const countriesRoutes = require('./routes/countries');
const citiesRoutes = require('./routes/cities');
const wishlistRoutes = require('./routes/wishlist');
const friendsRoutes = require('./routes/friends');
const usersRoutes = require('./routes/users');
const alignmentRoutes = require('./routes/alignment');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/countries', countriesRoutes);
app.use('/api/cities', citiesRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/alignment', alignmentRoutes);

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Test database connection
  try {
    await db.query('SELECT NOW()');
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
  }
});

