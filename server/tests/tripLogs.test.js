// Tests for trip log routes
jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'user-1', displayName: 'PJ' };
  next();
});
jest.mock('../services/claude', () => ({
  normalizeLocation: jest.fn().mockResolvedValue({
    normalized_city: 'San Diego',
    normalized_country: 'United States',
    normalized_region: 'California',
    latitude: 32.7157,
    longitude: -117.1611,
    confidence: 'high',
  }),
}));

const request = require('supertest');
const express = require('express');
const db = require('../db');
const tripLogsRoutes = require('../routes/tripLogs');

const app = express();
app.use(express.json());
app.use('/api/trip-logs', tripLogsRoutes);

beforeEach(() => {
  db.query.mockReset();
});

const mockLog = {
  id: 'pin-1',
  pin_type: 'memory',
  place_name: 'San Diego, CA',
  normalized_city: 'San Diego',
  normalized_country: 'United States',
  normalized_region: 'California',
  latitude: 32.7157,
  longitude: -117.1611,
  ai_summary: null,
  note: 'Great weekend',
  photo_url: null,
  unsplash_image_url: null,
  unsplash_attribution: null,
  visit_year: 2026,
  visit_month: 5,
  rating: 4,
  companions: [],
  countries: [],
  is_trip_log: true,
  would_go_back: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-01T00:00:00Z',
};

describe('GET /api/trip-logs', () => {
  it('returns trip log entries for the current user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [mockLog] })    // main query
      .mockResolvedValueOnce({ rows: [] });           // batchGetTagsForPins

    const res = await request(app).get('/api/trip-logs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].placeName).toBe('San Diego, CA');
    expect(res.body.data[0].visitMonth).toBe(5);
    expect(res.body.data[0].visitMonthName).toBe('May');
    expect(res.body.data[0].isTripLog).toBe(true);
  });

  it('returns empty array when no logs exist', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/trip-logs');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});

describe('POST /api/trip-logs', () => {
  it('creates a new trip log entry', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'pin-1' }] })  // INSERT
      .mockResolvedValueOnce({ rows: [mockLog] })           // SELECT after insert
      .mockResolvedValueOnce({ rows: [] })                   // getTagsForPin
      .mockResolvedValueOnce({ rows: [] });                  // background UPDATE normalization

    const res = await request(app).post('/api/trip-logs').send({
      placeName: 'San Diego, CA',
      visitYear: 2026,
      visitMonth: 5,
      note: 'Great weekend',
      rating: 4,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.placeName).toBe('San Diego, CA');
    expect(res.body.data.visitMonth).toBe(5);
  });

  it('returns 400 when placeName is missing', async () => {
    const res = await request(app).post('/api/trip-logs').send({ visitYear: 2026 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid visitMonth', async () => {
    const res = await request(app).post('/api/trip-logs').send({
      placeName: 'Tokyo',
      visitMonth: 13,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/visitMonth/);
  });
});

describe('PATCH /api/trip-logs/:id', () => {
  it('updates a trip log entry', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'pin-1' }] })  // ownership check
      .mockResolvedValueOnce({ rows: [] })                   // UPDATE
      .mockResolvedValueOnce({ rows: [{ ...mockLog, note: 'Updated note' }] })  // SELECT
      .mockResolvedValueOnce({ rows: [] });                   // getTagsForPin

    const res = await request(app).patch('/api/trip-logs/pin-1').send({ note: 'Updated note' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when log not found or not owned', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).patch('/api/trip-logs/not-mine').send({ note: 'x' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/trip-logs/:id', () => {
  it('deletes a trip log entry', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'pin-1' }] })  // ownership check
      .mockResolvedValueOnce({ rows: [] })                   // DELETE pin_tags
      .mockResolvedValueOnce({ rows: [] });                  // DELETE pins

    const res = await request(app).delete('/api/trip-logs/pin-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 when log not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).delete('/api/trip-logs/not-mine');
    expect(res.status).toBe(404);
  });
});
