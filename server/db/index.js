const { Pool } = require('pg');

// Configure SSL for production (Render requires SSL)
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('render.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/travel_together',
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

pool.on('connect', () => {
  console.log('Connected to database');
});

pool.on('error', (err) => {
  console.error('Database error:', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
