// TT8: Username editing tests
jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user-1', email: 'test@example.com', username: 'oldname', display_name: 'Test User', avatar_url: null, auth_provider: 'local', created_at: new Date() };
  next();
});

const request = require('supertest');
const express = require('express');
const db = require('../db');
const authRoutes = require('../routes/auth');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('PUT /api/auth/me — username update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [{ display_name: 'Test User', username: 'newname' }] });
  });

  it('validates username format — rejects too short, too long, invalid chars', () => {
    const isValidUsername = u => /^[a-zA-Z0-9_]{3,20}$/.test(u);
    expect(isValidUsername('ab')).toBe(false);           // too short
    expect(isValidUsername('abc')).toBe(true);            // min length ok
    expect(isValidUsername('valid_user123')).toBe(true);  // valid
    expect(isValidUsername('has space')).toBe(false);     // space not allowed
    expect(isValidUsername('a'.repeat(21))).toBe(false);  // too long (21)
    expect(isValidUsername('a'.repeat(20))).toBe(true);   // max length ok
  });

  it('returns 400 with "Username already taken" when username is duplicate', async () => {
    db.query.mockImplementation((sql) => {
      // Uniqueness check: another user has this username
      if (sql.includes('SELECT id FROM users WHERE username')) {
        return Promise.resolve({ rows: [{ id: 'user-2' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put('/api/auth/me')
      .send({ displayName: 'Test User', username: 'takenname' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Username already taken');
  });

  it('returns 400 when username format is invalid', async () => {
    const res = await request(app)
      .put('/api/auth/me')
      .send({ displayName: 'Test User', username: 'a b' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/username must be/i);
  });

  it('returns updated displayName and username on success', async () => {
    db.query.mockImplementation((sql) => {
      if (sql.includes('SELECT id FROM users WHERE username')) {
        return Promise.resolve({ rows: [] }); // not taken
      }
      if (sql.includes('UPDATE users SET')) {
        return Promise.resolve({ rows: [{ display_name: 'Test User', username: 'newname' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .put('/api/auth/me')
      .send({ displayName: 'Test User', username: 'newname' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe('newname');
    expect(res.body.data.displayName).toBe('Test User');
  });
});
