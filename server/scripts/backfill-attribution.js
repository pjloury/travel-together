// Backfill image_attribution for experiences that already have image_url but no attribution.
// Re-fetches Unsplash to get photographer info, triggers download event, saves attribution.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const UNSPLASH_BASE_URL = 'https://api.unsplash.com';
const DELAY_MS = 1300;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAttribution(name, city, country) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const location = [city, country].filter(Boolean).join(', ');
  const query = `${name} ${location} landscape scenery -people -portrait -person -selfie`;

  const url = new URL(`${UNSPLASH_BASE_URL}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '10');
  url.searchParams.set('orientation', 'landscape');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Client-ID ${accessKey}` },
  });

  if (res.status === 429 || res.status === 403) throw new Error('RATE_LIMIT');
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

  // Trigger download as required by Unsplash guidelines
  try { await fetch(`${photo.links.download_location}?client_id=${accessKey}`); } catch (_) {}

  return {
    photographerName: photo.user.name,
    photographerUrl: photo.user.links.html,
    unsplashUrl: photo.links.html,
  };
}

async function main() {
  const { rows } = await db.query(
    `SELECT id, name, city, country FROM seasonal_experiences
     WHERE image_url IS NOT NULL AND image_attribution IS NULL
     ORDER BY click_count DESC`
  );

  console.log(`Backfilling attribution for ${rows.length} experiences…\n`);
  let success = 0, failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const { id, name, city, country } = rows[i];
    process.stdout.write(`[${i + 1}/${rows.length}] ${name} … `);

    try {
      const attr = await fetchAttribution(name, city, country);
      if (!attr) { console.log('no results'); failed++; }
      else {
        await db.query(
          `UPDATE seasonal_experiences SET image_attribution = $1 WHERE id = $2`,
          [JSON.stringify(attr), id]
        );
        console.log(`✓  ${attr.photographerName}`);
        success++;
      }
    } catch (err) {
      if (err.message === 'RATE_LIMIT') {
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

  console.log(`\nDone. success=${success} failed=${failed}`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
