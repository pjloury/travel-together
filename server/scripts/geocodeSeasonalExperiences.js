// Geocode seasonal_experiences by city+country using OSM Nominatim (free, no key).
// Caches by city so each city is only looked up once.
// Run: node server/scripts/geocodeSeasonalExperiences.js [--overwrite]

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const DELAY_MS = 1100; // Nominatim rate limit: max 1 req/sec
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OVERWRITE = process.argv.includes('--overwrite');

async function geocode(city, country) {
  const q = encodeURIComponent(`${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TravelTogether/1.0 (pjloury@gmail.com)' }
    });
    const json = await res.json();
    if (json[0]) return { lat: parseFloat(json[0].lat), lon: parseFloat(json[0].lon) };
  } catch { /* silent */ }
  return null;
}

async function main() {
  const where = OVERWRITE ? '' : 'WHERE lat IS NULL';
  const result = await db.query(
    `SELECT id, city, country FROM seasonal_experiences ${where} ORDER BY city, country`
  );
  const rows = result.rows;
  console.log(`Geocoding ${rows.length} experiences…`);

  const cache = {};
  let done = 0, failed = 0;

  for (const row of rows) {
    const key = `${row.city}||${row.country}`;
    if (cache[key] === undefined) {
      cache[key] = await geocode(row.city, row.country);
      await sleep(DELAY_MS);
    }
    const coords = cache[key];
    if (coords) {
      await db.query(
        'UPDATE seasonal_experiences SET lat = $1, lon = $2 WHERE id = $3',
        [coords.lat, coords.lon, row.id]
      );
      done++;
    } else {
      failed++;
    }
    process.stdout.write(`\r  ${done + failed}/${rows.length} — ${done} geocoded, ${failed} failed`);
  }

  console.log(`\nDone. ${done} updated, ${failed} no coords found.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
