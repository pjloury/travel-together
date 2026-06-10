// Batch-populate image_url + image_attribution for seasonal_experiences with no photo.
// Queries Unsplash per experience, triggers the required download event, saves attribution.
//
// Usage: DATABASE_URL=... UNSPLASH_ACCESS_KEY=... node server/scripts/seed-experience-photos.js
// Rate-limited to ~45 req/hr to stay under Unsplash demo key limit (50/hr).

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const UNSPLASH_BASE_URL = 'https://api.unsplash.com';
const DELAY_MS = 1300;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function triggerDownload(downloadLocation, accessKey) {
  // Unsplash requires this call whenever a photo is "used" (saved/displayed)
  try {
    await fetch(`${downloadLocation}?client_id=${accessKey}`);
  } catch (_) {}
}

async function fetchPhoto(name, city, country) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) throw new Error('UNSPLASH_ACCESS_KEY not set');

  const location = [city, country].filter(Boolean).join(', ');
  const query = `${name} ${location} landscape scenery -people -portrait -person -selfie`;

  const url = new URL(`${UNSPLASH_BASE_URL}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '10');
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (res.status === 403) throw new Error('RATE_LIMIT_403');
  if (!res.ok) throw new Error(`Unsplash ${res.status}`);

  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;

  const PEOPLE_RE = /\bpeople\b|\bperson\b|\bwoman\b|\bman\b|\bportrait\b|\bselfie\b|\bcrowd\b|\bcouple\b|\bfamily\b|\btourist\b/i;
  const filtered = data.results.filter(p => {
    const desc = `${p.description || ''} ${p.alt_description || ''}`;
    return !PEOPLE_RE.test(desc);
  });

  const candidates = filtered.length > 0 ? filtered : data.results;
  const photo = candidates.reduce((best, p) =>
    (p.likes || 0) > (best.likes || 0) ? p : best, candidates[0]);

  // Trigger download as required by Unsplash API guidelines
  await triggerDownload(photo.links.download_location, accessKey);

  return {
    imageUrl: photo.urls.regular,
    attribution: {
      photographerName: photo.user.name,
      photographerUrl: photo.user.links.html,
      unsplashUrl: photo.links.html,
    },
  };
}

async function main() {
  const { rows } = await db.query(
    `SELECT id, name, city, country, click_count
     FROM seasonal_experiences
     WHERE image_url IS NULL
     ORDER BY click_count DESC`
  );

  console.log(`Found ${rows.length} experiences without photos. Starting…\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const { id, name, city, country } = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${name} (${city}, ${country}) … `);

    try {
      const result = await fetchPhoto(name, city, country);

      if (!result) {
        console.log('no results');
        skipped++;
      } else {
        await db.query(
          `UPDATE seasonal_experiences SET image_url = $1, image_attribution = $2 WHERE id = $3`,
          [result.imageUrl, JSON.stringify(result.attribution), id]
        );
        console.log(`✓  ${result.attribution.photographerName}`);
        success++;
      }
    } catch (err) {
      if (err.message === 'RATE_LIMIT' || err.message === 'RATE_LIMIT_403') {
        console.log('rate limited — waiting 75s');
        await sleep(75000);
        i--;
        continue;
      }
      console.log(`error: ${err.message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. success=${success} skipped=${skipped} failed=${failed}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
