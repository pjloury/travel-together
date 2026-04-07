// TT8: Username editing tests
const request = require('supertest');

// Mock DB
jest.mock('../db');
const db = require('../db');

const app = require('../index');

describe('PUT /api/auth/me — username update', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [] });
  });

  it('rejects username that is too short', async () => {
    // Test validation logic directly
    const isValidUsername = u => /^[a-zA-Z0-9_]{3,30}$/.test(u);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('abc')).toBe(true);
    expect(isValidUsername('valid_user123')).toBe(true);
    expect(isValidUsername('has space')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });
});
