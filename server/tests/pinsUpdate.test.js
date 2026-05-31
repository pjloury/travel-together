// Tests for PUT /api/pins/:id — focus on the is_trip_log (show-as-memory) field.
jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user-1', displayName: 'PJ' };
  next();
});
jest.mock('../services/claude', () => ({ normalizeLocation: jest.fn() }));
jest.mock('../services/imagegen', () => ({ generatePinImage: jest.fn() }));
jest.mock('../services/notifications', () => ({ notifyFriendsOfActivity: jest.fn() }));
jest.mock('../services/wishlist', () => ({ addToWishlistIfEligible: jest.fn() }));

const request = require('supertest');
const express = require('express');
const db = require('../db');
const pinsRoutes = require('../routes/pins');

const app = express();
app.use(express.json());
app.use('/api/pins', pinsRoutes);

const pinRow = {
  id: 'pin-1',
  user_id: 'user-1',
  pin_type: 'memory',
  place_name: 'San Diego, CA',
  is_trip_log: true,
  visit_year: 2026,
  visit_month: 5,
  rating: 4,
  companions: [],
  countries: [],
};

beforeEach(() => {
  db.query.mockReset();
  // Generic implementation: SELECTs on pins return the row; everything else empty.
  db.query.mockImplementation((sql) => {
    if (/top_pins/.test(sql)) return Promise.resolve({ rows: [] });
    if (/^\s*SELECT \* FROM pins/.test(sql)) return Promise.resolve({ rows: [pinRow] });
    return Promise.resolve({ rows: [] });
  });
});

describe('PUT /api/pins/:id — show-as-memory toggle', () => {
  it('persists isTripLog=false to the is_trip_log column', async () => {
    const res = await request(app).put('/api/pins/pin-1').send({ isTripLog: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updateCall = db.query.mock.calls.find(
      ([sql]) => /UPDATE pins SET/.test(sql) && /is_trip_log = \$/.test(sql)
    );
    expect(updateCall).toBeTruthy();
    expect(updateCall[1]).toContain(false); // value bound for is_trip_log
  });

  it('does not touch is_trip_log when isTripLog is omitted', async () => {
    await request(app).put('/api/pins/pin-1').send({ rating: 5 });

    const updateCall = db.query.mock.calls.find(([sql]) => /UPDATE pins SET/.test(sql));
    expect(updateCall).toBeTruthy();
    expect(/is_trip_log/.test(updateCall[0])).toBe(false);
  });

  it('returns 403 when editing a pin owned by another user', async () => {
    db.query.mockImplementation((sql) => {
      if (/^\s*SELECT \* FROM pins/.test(sql)) {
        return Promise.resolve({ rows: [{ ...pinRow, user_id: 'someone-else' }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app).put('/api/pins/pin-1').send({ isTripLog: false });
    expect(res.status).toBe(403);
  });
});
