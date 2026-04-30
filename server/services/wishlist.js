// Shared wishlist mutation helpers. Used by:
//   - routes/pins.js (auto-add when a dream pin's country resolves)
//   - scripts/backfillWishlistFromDreams.js (one-shot bootstrap of
//     existing dream pins into the wishlist)
//
// Centralizing this logic keeps the eligibility rules in one place:
//   1. We must be able to resolve a country_code from the name; the
//      country_wishlist schema requires CHAR(2) NOT NULL.
//   2. Skip when the user has already visited that country — the
//      product contract is that wishlist and visited are disjoint.
//   3. Skip when the row already exists (UNIQUE(user_id, country_code))
//      via ON CONFLICT DO NOTHING — the helper is safe to call any
//      number of times for the same input.

const db = require('../db');
const { lookupCountryCode } = require('../utils/countryCodes');

async function addToWishlistIfEligible(userId, countryName) {
  const code = lookupCountryCode(countryName);
  if (!code) return false;
  const visited = await db.query(
    `SELECT 1 FROM pins
     WHERE user_id = $1 AND pin_type = 'memory' AND archived = false
       AND LOWER(normalized_country) = LOWER($2)
     LIMIT 1`,
    [userId, countryName]
  );
  if (visited.rows.length > 0) return false;
  const result = await db.query(
    `INSERT INTO country_wishlist (user_id, country_code, country_name, interest_level)
     VALUES ($1, $2, $3, 3)
     ON CONFLICT (user_id, country_code) DO NOTHING
     RETURNING id`,
    [userId, code, countryName]
  );
  return result.rows.length > 0;
}

module.exports = { addToWishlistIfEligible };
