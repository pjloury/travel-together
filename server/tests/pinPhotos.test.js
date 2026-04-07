// Tests for POST/DELETE/GET /api/pins/:id/photos
// Mocks DB, auth, and multer

jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'owner-user-id' };
  next();
});

// Mock multer so upload.array() injects req.files from req._mockFiles
jest.mock('multer', () => {
  const multerMock = () => ({
    array: (_field, _max) => (req, _res, next) => {
      req.files = req._mockFiles || [];
      next();
    },
    single: () => (_req, _res, next) => next(),
  });
  multerMock.memoryStorage = () => ({});
  return multerMock;
});

jest.mock('../services/claude', () => ({
  normalizeLocation: jest.fn().mockResolvedValue({
    normalized_city: 'Tokyo', normalized_country: 'Japan',
    normalized_region: 'Asia', latitude: 35.6, longitude: 139.6,
    confidence: 'high', multiple_countries: false, detected_locations: [],
  }),
  structureMemoryFromTranscript: jest.fn(),
  structureDreamFromText: jest.fn(),
  getDreamInsights: jest.fn(),
}));

jest.mock('../services/imagegen', () => ({ generatePinImage: jest.fn() }));

const request = require('supertest');
const express = require('express');
const db = require('../db');
const pinsRoutes = require('../routes/pins');

// Build a test app with a file-injection middleware for upload tests
const app = express();
app.use(express.json());
// inject mock files when X-Test-Files header is present (unit test only)
app.use((req, _res, next) => {
  const header = req.headers['x-test-files'];
  if (header) {
    try {
      const specs = JSON.parse(header);
      req._mockFiles = specs.map(s => ({
        fieldname: 'photos',
        originalname: s.name,
        mimetype: s.mimetype,
        buffer: Buffer.from(s.data || 'fake'),
      }));
    } catch { req._mockFiles = []; }
  }
  next();
});
app.use('/api/pins', pinsRoutes);

const OWNER_ID = 'owner-user-id';
const OTHER_ID = 'other-user-id';
const PIN_ID = 'pin-uuid-001';
const PHOTO_ID = 'photo-uuid-001';

const MOCK_PHOTO_ROW = {
  id: PHOTO_ID,
  photo_url: 'data:image/jpeg;base64,abc123',
  photo_source: 'upload',
  sort_order: 0,
  created_at: new Date().toISOString(),
};

// ---- POST /api/pins/:id/photos ----

describe('POST /api/pins/:id/photos', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns 404 when pin not found', async () => {
    // Query 1: SELECT user_id FROM pins → not found
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/api/pins/${PIN_ID}/photos`)
      .attach('photos', Buffer.from('fake-image-data'), 'test.jpg');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 403 when caller does not own the pin', async () => {
    // Query 1: SELECT user_id FROM pins → owned by OTHER_ID
    db.query.mockResolvedValueOnce({ rows: [{ user_id: OTHER_ID }] });

    const res = await request(app)
      .post(`/api/pins/${PIN_ID}/photos`)
      .attach('photos', Buffer.from('fake-image-data'), 'test.jpg');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  it('returns 400 when no files are attached', async () => {
    // Query 1: SELECT user_id FROM pins → owned by OWNER_ID
    db.query.mockResolvedValueOnce({ rows: [{ user_id: OWNER_ID }] });

    // No files attached (no .attach())
    const res = await request(app)
      .post(`/api/pins/${PIN_ID}/photos`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/no files/i);
  });

  it('uploads files and returns photos array on success', async () => {
    // Inject a mock file via header (multer is mocked; reads req._mockFiles)
    const testFiles = JSON.stringify([{ name: 'test.jpg', mimetype: 'image/jpeg', data: 'ZmFrZQ==' }]);

    // Query 1: SELECT user_id FROM pins → owned by OWNER_ID
    db.query.mockResolvedValueOnce({ rows: [{ user_id: OWNER_ID }] });
    // Query 2: SELECT COALESCE(MAX(sort_order)...) → next = 0
    db.query.mockResolvedValueOnce({ rows: [{ next: 0 }] });
    // Query 3: INSERT INTO pin_photos → insert succeeds
    db.query.mockResolvedValueOnce({ rows: [] });
    // Query 4: SELECT from pin_photos (getPhotosForPin) → returns photo
    db.query.mockResolvedValueOnce({ rows: [MOCK_PHOTO_ROW] });

    const res = await request(app)
      .post(`/api/pins/${PIN_ID}/photos`)
      .set('x-test-files', testFiles);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.photos)).toBe(true);
    expect(res.body.data.photos[0].photoUrl).toBe(MOCK_PHOTO_ROW.photo_url);
    expect(res.body.data.photos[0].photoSource).toBe('upload');
  });
});

// ---- DELETE /api/pins/:id/photos/:photoId ----

describe('DELETE /api/pins/:id/photos/:photoId', () => {
  beforeEach(() => jest.resetAllMocks());

  it('deletes photo and returns updated photos list', async () => {
    // Query 1: SELECT user_id FROM pins → OWNER_ID
    db.query.mockResolvedValueOnce({ rows: [{ user_id: OWNER_ID }] });
    // Query 2: DELETE FROM pin_photos
    db.query.mockResolvedValueOnce({ rows: [] });
    // Query 3: getPhotosForPin → empty now
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/api/pins/${PIN_ID}/photos/${PHOTO_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.photos).toEqual([]);
  });

  it('returns 404 when pin not found', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/api/pins/${PIN_ID}/photos/${PHOTO_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when caller does not own the pin', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ user_id: OTHER_ID }] });

    const res = await request(app)
      .delete(`/api/pins/${PIN_ID}/photos/${PHOTO_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ---- GET /api/pins/:id/photos ----

describe('GET /api/pins/:id/photos', () => {
  beforeEach(() => jest.resetAllMocks());

  it('returns photos list for a pin', async () => {
    // getPhotosForPin query
    db.query.mockResolvedValueOnce({ rows: [MOCK_PHOTO_ROW] });

    const res = await request(app)
      .get(`/api/pins/${PIN_ID}/photos`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.photos)).toBe(true);
    expect(res.body.data.photos[0].photoUrl).toBe(MOCK_PHOTO_ROW.photo_url);
  });

  it('returns empty array when pin has no photos', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/api/pins/${PIN_ID}/photos`);

    expect(res.status).toBe(200);
    expect(res.body.data.photos).toEqual([]);
  });
});
