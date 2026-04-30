// Test: GET /api/pins/board returns each pin's `locations` array so the
// client can derive country flags for multi-stop trips. Previously the
// /board endpoint omitted pin_locations, which made trips like "Around
// the World 2018" show only 1-2 flags despite having 5+ stops.

jest.mock('../db');
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.user = { id: 'owner-user-id' };
  next();
});
jest.mock('../services/claude', () => ({
  normalizeLocation: jest.fn(),
  structureMemoryFromTranscript: jest.fn(),
  structureDreamFromText: jest.fn(),
  getDreamInsights: jest.fn(),
}));
jest.mock('../services/imagegen', () => ({ generatePinImage: jest.fn() }));

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

describe('GET /api/pins/board — locations on multi-stop pins', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('returns pin.locations populated from pin_locations', async () => {
    const ownerId = 'owner-user-id';
    const pinId = 'pin-multi-stop';

    db.query.mockImplementation((sql, params) => {
      // Pins + top join
      if (/FROM pins p\s+LEFT JOIN top_pins tp/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: pinId, user_id: ownerId, pin_type: 'memory',
          place_name: 'Around the World 2018',
          normalized_country: null, latitude: 0, longitude: 0,
          countries: ['Tanzania'], archived: false,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          top8_order: null,
        }] });
      }
      // Top pins
      if (/FROM top_pins tp JOIN pins p/i.test(sql)) {
        return Promise.resolve({ rows: [] });
      }
      // batchGetTagsForPins
      if (/FROM pin_tags pt/i.test(sql)) return Promise.resolve({ rows: [] });
      // batchGetResourcesForPins
      if (/FROM pin_resources/i.test(sql)) return Promise.resolve({ rows: [] });
      // batchGetLocationsForPins — what we're testing
      if (/FROM pin_locations\s+WHERE pin_id = ANY/i.test(sql)) {
        expect(params[0]).toEqual([pinId]);
        return Promise.resolve({ rows: [
          { pin_id: pinId, place_name: 'Arusha', normalized_country: 'Tanzania', latitude: -3.4, longitude: 36.7, sort_order: 0 },
          { pin_id: pinId, place_name: 'Bangkok', normalized_country: 'Thailand', latitude: 13.8, longitude: 100.5, sort_order: 1 },
          { pin_id: pinId, place_name: 'Siem Reap', normalized_country: 'Cambodia', latitude: 13.4, longitude: 103.8, sort_order: 2 },
        ] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(makeApp()).get('/api/pins/board?tab=memory');
    expect(res.status).toBe(200);
    expect(res.body.pins).toHaveLength(1);
    const [pin] = res.body.pins;
    expect(pin.locations).toHaveLength(3);
    expect(pin.locations.map(l => l.normalizedCountry)).toEqual([
      'Tanzania', 'Thailand', 'Cambodia',
    ]);
    expect(pin.locations[0]).toMatchObject({
      placeName: 'Arusha', latitude: -3.4, longitude: 36.7, sortOrder: 0,
    });
  });

  test('returns empty locations array when pin has no stops', async () => {
    const ownerId = 'owner-user-id';
    const pinId = 'pin-single';

    db.query.mockImplementation((sql) => {
      if (/FROM pins p\s+LEFT JOIN top_pins tp/i.test(sql)) {
        return Promise.resolve({ rows: [{
          id: pinId, user_id: ownerId, pin_type: 'memory',
          place_name: 'Tokyo', normalized_country: 'Japan',
          latitude: 35.6, longitude: 139.6, countries: [],
          archived: false,
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          top8_order: null,
        }] });
      }
      if (/FROM top_pins tp JOIN pins p/i.test(sql)) return Promise.resolve({ rows: [] });
      if (/FROM pin_tags pt/i.test(sql)) return Promise.resolve({ rows: [] });
      if (/FROM pin_resources/i.test(sql)) return Promise.resolve({ rows: [] });
      if (/FROM pin_locations\s+WHERE pin_id = ANY/i.test(sql)) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(makeApp()).get('/api/pins/board?tab=memory');
    expect(res.status).toBe(200);
    expect(res.body.pins[0].locations).toEqual([]);
  });
});
