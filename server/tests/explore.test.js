// Tests for GET /api/explore/trips and related endpoints
// Mocks DB and auth so no real credentials are needed

jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user-test-id' };
  next();
});
jest.mock('../services/curator', () => ({
  runCurator: jest.fn().mockResolvedValue(undefined),
  SEED_CITIES: [],
}));

const request = require('supertest');
const express = require('express');
const db = require('../db');
const exploreRoutes = require('../routes/explore');

const app = express();
app.use(express.json());
app.use('/api/explore', exploreRoutes);

const TRIP = {
  id: 'trip-1',
  city: 'Kyoto',
  country: 'Japan',
  region: 'Asia',
  title: '4 Days in Kyoto',
  description: 'Ancient temples and modern eats.',
  image_url: null,
  days_suggested: 4,
  tags: ['culture', 'food'],
  last_scraped_at: new Date().toISOString(),
  experience_count: 2,
};

const EXPERIENCES = [
  {
    id: 'exp-1', trip_id: 'trip-1', title: 'Nishiki Market', description: 'Local market.',
    place_name: 'Nishiki Market', category: 'food', source_name: 'Eater',
    influencer_name: 'Mark Wiens', quote: 'A must-visit.', tags: ['food', 'local'],
    day_number: 1, sort_order: 0,
  },
  {
    id: 'exp-2', trip_id: 'trip-1', title: 'Fushimi Inari', description: 'Iconic shrine gates.',
    place_name: 'Fushimi Inari Taisha', category: 'culture', source_name: 'Lonely Planet',
    influencer_name: 'Adventurous Kate', quote: 'Go at dawn.', tags: ['culture', 'hiking'],
    day_number: 2, sort_order: 0,
  },
];

describe('GET /api/explore/trips', () => {
  it('returns 200 with trips array', async () => {
    db.query.mockResolvedValueOnce({ rows: [TRIP] });
    const res = await request(app).get('/api/explore/trips');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.trips)).toBe(true);
    expect(res.body.trips[0].city).toBe('Kyoto');
  });

  it('returns 500 on DB error', async () => {
    db.query.mockRejectedValueOnce(new Error('DB down'));
    const res = await request(app).get('/api/explore/trips');
    expect(res.status).toBe(500);
  });
});

describe('GET /api/explore/trips/:id', () => {
  it('returns trip with experiences', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [TRIP] })
      .mockResolvedValueOnce({ rows: EXPERIENCES });
    const res = await request(app).get('/api/explore/trips/trip-1');
    expect(res.status).toBe(200);
    expect(res.body.trip.city).toBe('Kyoto');
    expect(res.body.experiences).toHaveLength(2);
  });

  it('returns 404 for unknown trip id', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/explore/trips/does-not-exist');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/explore/refresh', () => {
  it('returns 401 with no secret', async () => {
    const res = await request(app).post('/api/explore/refresh');
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    process.env.CURATOR_SECRET = 'real-secret';
    const res = await request(app)
      .post('/api/explore/refresh')
      .set('x-curator-secret', 'wrong-secret');
    expect(res.status).toBe(401);
  });

  it('returns 200 with correct secret and fires curator', async () => {
    process.env.CURATOR_SECRET = 'real-secret';
    const { runCurator } = require('../services/curator');
    const res = await request(app)
      .post('/api/explore/refresh')
      .set('x-curator-secret', 'real-secret');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/started/i);
    // Give the fire-and-forget a tick to register
    await new Promise(r => setTimeout(r, 10));
    expect(runCurator).toHaveBeenCalled();
  });
});
