#!/usr/bin/env node
/**
 * Backfill pins where the post-create normalization never landed.
 *
 * The normal flow is: POST /api/pins fires `normalizeAndUpdatePin` as
 * a fire-and-forget after the response. If Claude was unreachable
 * (rate limit, missing ANTHROPIC_API_KEY, transient network), the
 * UPDATE never runs and the pin stays with `location_confidence IS
 * NULL` forever — no normalized_country, no flag emoji on the card.
 *
 * That's the loophole: there's no retry path. This script closes it
 * by walking every pin with null/low confidence and re-running the
 * same normalize+UPDATE we use on create. Idempotent — re-runs are
 * safe; pins that already normalized are skipped.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node server/scripts/backfillMissingNormalization.js
 *   ANTHROPIC_API_KEY=... node server/scripts/backfillMissingNormalization.js --dry-run
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('../db');
const { normalizeLocation } = require('../services/claude');
const { addToWishlistIfEligible } = require('../services/wishlist');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(DRY_RUN ? '🟡 DRY RUN — no writes' : '🟢 LIVE RUN');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set — normalization will fail. Aborting.');
    process.exit(1);
  }

  // Pull every pin that's missing normalization. Confidence='low' is
  // also re-tried because in practice those rows usually paired with
  // bad / null place data.
  const result = await db.query(`
    SELECT id, user_id, pin_type, place_name
    FROM pins
    WHERE archived = false
      AND (location_confidence IS NULL OR location_confidence = 'low')
    ORDER BY created_at
  `);
  console.log(`Found ${result.rows.length} pins to re-normalize.`);

  let succeeded = 0;
  let failed = 0;
  let unchanged = 0;

  for (const row of result.rows) {
    const { id, user_id, pin_type, place_name } = row;
    if (!place_name) { unchanged += 1; continue; }
    try {
      const norm = await normalizeLocation(place_name);
      const verified = norm.confidence !== 'low';
      const detectedCountries = norm.multiple_countries && norm.detected_locations.length > 1
        ? norm.detected_locations.map(l => l.normalized_country).filter(Boolean)
        : [];

      if (DRY_RUN) {
        console.log(`  ~ ${place_name} → ${norm.normalized_country || '(null)'} (${norm.confidence})`);
        succeeded += 1;
        continue;
      }

      await db.query(
        `UPDATE pins SET
           normalized_city = $1,
           normalized_country = $2,
           normalized_region = $3,
           latitude = $4,
           longitude = $5,
           location_confidence = $6,
           location_verified = $7,
           countries = $8,
           updated_at = NOW()
         WHERE id = $9`,
        [
          norm.normalized_city,
          norm.normalized_country,
          norm.normalized_region,
          norm.latitude,
          norm.longitude,
          norm.confidence,
          verified,
          detectedCountries,
          id,
        ]
      );

      // Mirror the live POST hooks so the wishlist invariant holds
      // after backfill too.
      if (pin_type === 'memory' && norm.normalized_country) {
        await db.query(
          `DELETE FROM country_wishlist
           WHERE user_id = $1 AND LOWER(country_name) = LOWER($2)`,
          [user_id, norm.normalized_country]
        );
      }
      if (pin_type === 'dream' && norm.normalized_country) {
        await addToWishlistIfEligible(user_id, norm.normalized_country);
      }

      console.log(`  ✓ ${place_name} → ${norm.normalized_country || '(null)'} (${norm.confidence})`);
      succeeded += 1;
    } catch (err) {
      console.error(`  ✗ ${place_name} (${id}): ${err.message}`);
      failed += 1;
    }
  }

  console.log('');
  console.log('Backfill summary:');
  console.log(`  succeeded: ${succeeded}`);
  console.log(`  failed:    ${failed}`);
  console.log(`  unchanged: ${unchanged}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
