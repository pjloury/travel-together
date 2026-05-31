// Batch-populate image_url for seasonal_experiences using Wikipedia page images.
// Uses UNSPLASH_ACCESS_KEY when available (better quality), falls back to Wikipedia.
// Run: node server/scripts/fetchSeasonalImages.js [--limit N] [--overwrite]
//
// Wikipedia API: free, no key needed, returns main article thumbnail.
// Searches by experience name first, then falls back to city name.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const DELAY_MS = 300; // rate-limit — Wikipedia asks for ≥100ms between requests
const sleep = ms => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const LIMIT = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1]) : 9999; })();
const OVERWRITE = args.includes('--overwrite');

async function wikiImage(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&format=json&pithumbsize=800&redirects=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TravelTogether/1.0 (contact@traveltogether.app)' } });
    const json = await res.json();
    const pages = Object.values(json.query?.pages || {});
    return pages[0]?.thumbnail?.source || null;
  } catch {
    return null;
  }
}

async function unsplashImage(name, city, country) {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  const query = `${name} ${city} ${country} landscape scenery`;
  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    const json = await res.json();
    const photo = (json.results || []).sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
    return photo?.urls?.regular || null;
  } catch {
    return null;
  }
}

async function main() {
  const where = OVERWRITE ? '' : 'WHERE image_url IS NULL';
  const result = await db.query(
    `SELECT id, name, city, country FROM seasonal_experiences ${where} ORDER BY id LIMIT $1`,
    [LIMIT]
  );
  const rows = result.rows;
  console.log(`Fetching images for ${rows.length} experiences…`);

  let done = 0, failed = 0;
  const cityCache = {};

  for (const row of rows) {
    // 1. Try Unsplash (best quality, requires key)
    let url = await unsplashImage(row.name, row.city, row.country);

    // 2. Try Wikipedia by experience name
    if (!url) url = await wikiImage(row.name);

    // 3. Try Wikipedia by city (cached)
    if (!url) {
      const cacheKey = `${row.city},${row.country}`;
      if (cityCache[cacheKey] === undefined) {
        cityCache[cacheKey] = await wikiImage(`${row.city}`) || await wikiImage(`${row.city} ${row.country}`) || null;
      }
      url = cityCache[cacheKey];
    }

    if (url) {
      await db.query('UPDATE seasonal_experiences SET image_url = $1 WHERE id = $2', [url, row.id]);
      done++;
      process.stdout.write(`\r  ${done + failed}/${rows.length} — ${done} images found`);
    } else {
      failed++;
      process.stdout.write(`\r  ${done + failed}/${rows.length} — ${done} images found (${failed} failed)`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ${done} updated, ${failed} no image found.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
