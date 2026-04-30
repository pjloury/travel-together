#!/usr/bin/env node
/**
 * One-shot bootstrap: every existing dream pin's normalized_country is
 * inserted into that user's country_wishlist (interest_level=3) unless
 * the user has already visited that country.
 *
 * Idempotent — re-runs are safe thanks to ON CONFLICT DO NOTHING and
 * the visited-country guard inside addToWishlistIfEligible.
 *
 * Usage:
 *   # Local
 *   node server/scripts/backfillWishlistFromDreams.js
 *
 *   # Render production (run from a worker shell or via psql tunneling
 *   # `DATABASE_URL`):
 *   DATABASE_URL=$RENDER_DATABASE_URL node server/scripts/backfillWishlistFromDreams.js
 *
 *   # Dry run — prints planned inserts but doesn't write
 *   node server/scripts/backfillWishlistFromDreams.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('../db');
const { lookupCountryCode } = require('../utils/countryCodes');
const { addToWishlistIfEligible } = require('../services/wishlist');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '🟡 DRY RUN — no writes will happen' : '🟢 LIVE RUN');

  // Distinct (user_id, country) pairs from active dream pins. Multi-stop
  // dream trips also contribute their `countries[]` array so a "Trip:
  // Tokyo + Seoul" dream backfills both Japan AND South Korea.
  const dreamCountries = await db.query(`
    SELECT DISTINCT user_id, country
    FROM (
      SELECT user_id, normalized_country AS country
      FROM pins
      WHERE pin_type = 'dream' AND archived = false
        AND normalized_country IS NOT NULL
      UNION
      SELECT user_id, UNNEST(countries) AS country
      FROM pins
      WHERE pin_type = 'dream' AND archived = false
        AND array_length(countries, 1) > 0
    ) AS t
    WHERE country IS NOT NULL AND TRIM(country) <> ''
    ORDER BY user_id, country
  `);
  console.log(`Found ${dreamCountries.rows.length} (user, country) candidate pairs from dream pins.`);

  let inserted = 0;
  let skippedVisited = 0;
  let skippedExisting = 0;
  let skippedNoCode = 0;

  for (const { user_id, country } of dreamCountries.rows) {
    const code = lookupCountryCode(country);
    if (!code) {
      skippedNoCode += 1;
      console.log(`  ⚠ no ISO code for "${country}" — user ${user_id}`);
      continue;
    }

    if (DRY_RUN) {
      // Replicate the eligibility checks without writing — keeps the
      // dry-run summary honest.
      const visited = await db.query(
        `SELECT 1 FROM pins
         WHERE user_id = $1 AND pin_type = 'memory' AND archived = false
           AND LOWER(normalized_country) = LOWER($2)
         LIMIT 1`,
        [user_id, country]
      );
      if (visited.rows.length > 0) { skippedVisited += 1; continue; }
      const existing = await db.query(
        `SELECT 1 FROM country_wishlist WHERE user_id = $1 AND country_code = $2`,
        [user_id, code]
      );
      if (existing.rows.length > 0) { skippedExisting += 1; continue; }
      console.log(`  + ${user_id}: ${country} (${code})`);
      inserted += 1;
      continue;
    }

    const did = await addToWishlistIfEligible(user_id, country);
    if (did) {
      inserted += 1;
      console.log(`  + ${user_id}: ${country} (${code})`);
    } else {
      // Could be either visited or already-on-wishlist. Re-check so the
      // summary distinguishes the two cases (useful for spotting bugs).
      const visited = await db.query(
        `SELECT 1 FROM pins
         WHERE user_id = $1 AND pin_type = 'memory' AND archived = false
           AND LOWER(normalized_country) = LOWER($2)
         LIMIT 1`,
        [user_id, country]
      );
      if (visited.rows.length > 0) skippedVisited += 1;
      else skippedExisting += 1;
    }
  }

  console.log('');
  console.log('Backfill summary:');
  console.log(`  inserted:          ${inserted}`);
  console.log(`  skipped (visited): ${skippedVisited}`);
  console.log(`  skipped (existing): ${skippedExisting}`);
  console.log(`  skipped (no code): ${skippedNoCode}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
