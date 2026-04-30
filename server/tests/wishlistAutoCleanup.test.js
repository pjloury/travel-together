// Auto-removal contract: when a memory pin is created with a normalized
// country, that country drops out of the user's wishlist. Mirrors the
// product rule "you can't wishlist a country you've already been to".

jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user-A' };
  next();
});

// Stub claude.normalizeLocation so the post-response background work
// runs synchronously enough for us to assert on the cleanup query.
// Variable name must start with `mock` per Jest's hoisting rules.
const mockNormalizeLocation = jest.fn();
jest.mock('../services/claude', () => ({
  normalizeLocation: (...args) => mockNormalizeLocation(...args),
  structureMemoryFromTranscript: jest.fn(),
  structureDreamFromText: jest.fn(),
  getDreamInsights: jest.fn(),
}));
jest.mock('../services/imagegen', () => ({ generatePinImage: jest.fn() }));
jest.mock('../services/notifications', () => ({
  notifyFriendsOfActivity: jest.fn(),
}));

const request = require('supertest');
const express = require('express');
const db = require('../db');
const pinsRoutes = require('../routes/pins');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/pins', pinsRoutes);
  return app;
}

function flushMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

describe('Wishlist auto-cleanup on memory pin creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNormalizeLocation.mockResolvedValue({
      normalized_city: null,
      normalized_country: 'Japan',
      normalized_region: 'Asia',
      latitude: 35.6, longitude: 139.6,
      confidence: 'high',
      multiple_countries: false,
      detected_locations: [],
    });
  });

  test('memory pin → wishlist row for the same country gets DELETEd', async () => {
    const queries = [];
    db.query.mockImplementation((sql) => {
      queries.push(sql);
      // INSERT pin
      if (/^INSERT INTO pins/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: 'pin-1', user_id: 'user-A', pin_type: 'memory',
          place_name: 'Japan', archived: false, country_only: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }] });
      }
      // getFullPin's SELECT
      if (/SELECT \* FROM pins WHERE id = \$1/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: 'pin-1', user_id: 'user-A', pin_type: 'memory',
          place_name: 'Japan', archived: false, country_only: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(makeApp())
      .post('/api/pins')
      .send({ pinType: 'memory', placeName: 'Japan', countryOnly: true });
    expect(res.status).toBe(201);

    // Background work: normalizeAndUpdatePin runs after the response.
    // Wait for the queued task to drain.
    await new Promise(r => setTimeout(r, 10));
    await flushMicrotasks();

    const cleanupQuery = queries.find(q =>
      /DELETE FROM country_wishlist[\s\S]*country_name/i.test(q)
    );
    expect(cleanupQuery).toBeTruthy();
  });

  test('dream pin (FUTURE) does NOT trigger wishlist cleanup', async () => {
    const queries = [];
    db.query.mockImplementation((sql) => {
      queries.push(sql);
      if (/^INSERT INTO pins/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: 'pin-2', user_id: 'user-A', pin_type: 'dream',
          place_name: 'Japan', archived: false, country_only: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }] });
      }
      if (/SELECT \* FROM pins WHERE id = \$1/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: 'pin-2', user_id: 'user-A', pin_type: 'dream',
          place_name: 'Japan', archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(makeApp())
      .post('/api/pins')
      .send({ pinType: 'dream', placeName: 'Japan' });
    expect(res.status).toBe(201);

    await new Promise(r => setTimeout(r, 10));
    await flushMicrotasks();

    const cleanupQuery = queries.find(q =>
      /DELETE FROM country_wishlist/i.test(q)
    );
    expect(cleanupQuery).toBeFalsy();
  });
});
