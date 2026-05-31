// One-time seed: loads server/data/experiences/seed_v1.json into seasonal_experiences table.
// Usage: node server/scripts/seedSeasonalExperiences.js
// Safe to re-run — uses INSERT ... ON CONFLICT DO NOTHING.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const db = require('../db');
const data = require('../data/experiences/seed_v1.json');

const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

// Extract month numbers from a free-text "when" string.
function parseMonthsFromText(text) {
  if (!text) return [];
  const lower = text.toLowerCase();
  const found = new Set();
  for (const [name, num] of Object.entries(MONTH_MAP)) {
    if (lower.includes(name)) found.add(num);
  }
  // Handle "easter" → March/April
  if (lower.includes('easter')) { found.add(3); found.add(4); }
  // Handle "lent" → February/March
  if (lower.includes('lent')) { found.add(2); found.add(3); }
  return [...found].sort((a, b) => a - b);
}

async function seed() {
  let inserted = 0;
  let skipped = 0;

  for (const e of data) {
    const months = e.months
      ? e.months.map(Number)
      : parseMonthsFromText(e.when);

    const whySpecial = e.why_special || e.tips || null;
    const bestFor = Array.isArray(e.best_for) ? e.best_for : [];
    const categories = Array.isArray(e.categories) ? e.categories : [];
    const vibeTags = Array.isArray(e.vibe_tags) ? e.vibe_tags : [];

    // Generate a stable id for entries that don't have one
    const id = e.id || `exp_gen_${e.name.replace(/\s+/g, '_').toLowerCase().slice(0, 40)}`;

    try {
      const result = await db.query(
        `INSERT INTO seasonal_experiences
           (id, name, city, country, months, when_text, categories, vibe_tags,
            description, why_special, best_for, source_dataset, source_url, accessibility)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         ON CONFLICT (id) DO NOTHING`,
        [
          id,
          e.name,
          e.city || '',
          e.country || '',
          months,
          e.when || null,
          categories,
          vibeTags,
          e.description || null,
          whySpecial,
          bestFor,
          e.source_dataset || null,
          e.source_url || null,
          e.accessibility || null,
        ]
      );
      if (result.rowCount > 0) inserted++;
      else skipped++;
    } catch (err) {
      console.error(`Failed on ${id}:`, err.message);
    }
  }

  console.log(`Done. Inserted: ${inserted}, skipped (already exists): ${skipped}`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
