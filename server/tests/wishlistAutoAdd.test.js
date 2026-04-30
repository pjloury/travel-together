// addToWishlistIfEligible — symmetric counterpart to the auto-cleanup
// hook. Used by both the dream-pin path inside normalizeAndUpdatePin
// and the bootstrap script that backfills existing dream pins.
//
// Eligibility rules under test:
//   1. Drops the call when the country name has no ISO mapping.
//   2. Drops the call when the user already has a memory pin for that
//      country (visited and wishlist must stay disjoint).
//   3. Inserts otherwise; ON CONFLICT keeps repeat calls idempotent.

jest.mock('../db');

const db = require('../db');
const { addToWishlistIfEligible } = require('../services/wishlist');

describe('addToWishlistIfEligible', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('inserts when not visited and not already on the wishlist', async () => {
    db.query.mockImplementation((sql) => {
      if (/SELECT 1 FROM pins/i.test(sql)) {
        return Promise.resolve({ rows: [] }); // not visited
      }
      if (/INSERT INTO country_wishlist/i.test(sql)) {
        return Promise.resolve({ rows: [{ id: 'cw-1' }] });
      }
      return Promise.resolve({ rows: [] });
    });
    const did = await addToWishlistIfEligible('user-A', 'Japan');
    expect(did).toBe(true);
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO country_wishlist/i.test(c[0]));
    expect(insertCall).toBeTruthy();
    expect(insertCall[1]).toEqual(['user-A', 'JP', 'Japan']);
  });

  test('skips when the user has already visited the country', async () => {
    db.query.mockImplementation((sql) => {
      if (/SELECT 1 FROM pins/i.test(sql)) {
        return Promise.resolve({ rows: [{ '?column?': 1 }] }); // visited
      }
      throw new Error(`unexpected query: ${sql}`);
    });
    const did = await addToWishlistIfEligible('user-A', 'Japan');
    expect(did).toBe(false);
    const insertCall = db.query.mock.calls.find(c => /INSERT INTO country_wishlist/i.test(c[0]));
    expect(insertCall).toBeUndefined();
  });

  test('returns false when ON CONFLICT swallowed the row', async () => {
    db.query.mockImplementation((sql) => {
      if (/SELECT 1 FROM pins/i.test(sql)) return Promise.resolve({ rows: [] });
      if (/INSERT INTO country_wishlist/i.test(sql)) {
        return Promise.resolve({ rows: [] }); // ON CONFLICT DO NOTHING
      }
      return Promise.resolve({ rows: [] });
    });
    const did = await addToWishlistIfEligible('user-A', 'Japan');
    expect(did).toBe(false);
  });

  test('drops countries we cannot map to an ISO code', async () => {
    const did = await addToWishlistIfEligible('user-A', 'Atlantis');
    expect(did).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });
});
