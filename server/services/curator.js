// Curator service — AI-powered travel content curation
//
// Generates curated trip itineraries from travel bloggers and influencers
// for an Explore page. Two modes:
//   1. Tavily (primary)  — web search → OpenAI extraction
//   2. OpenAI-only       — fallback when TAVILY_API_KEY is absent
//
// Env vars:
//   OPENAI_API_KEY   — required (gpt-4o-mini generates itineraries)
//   TAVILY_API_KEY   — optional; enables live web search

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini';
const TAVILY_URL = 'https://api.tavily.com/search';

// Aspirational seed cities — one cluster generated per city per refresh
const SEED_CITIES = [
  { city: 'Tokyo',       country: 'Japan',         region: 'Asia' },
  { city: 'Kyoto',       country: 'Japan',         region: 'Asia' },
  { city: 'Seoul',       country: 'South Korea',   region: 'Asia' },
  { city: 'Chiang Mai',  country: 'Thailand',      region: 'Asia' },
  { city: 'Bali',        country: 'Indonesia',     region: 'Asia' },
  { city: 'Lisbon',      country: 'Portugal',      region: 'Europe' },
  { city: 'Porto',       country: 'Portugal',      region: 'Europe' },
  { city: 'Barcelona',   country: 'Spain',         region: 'Europe' },
  { city: 'Copenhagen',  country: 'Denmark',       region: 'Europe' },
  { city: 'Tbilisi',     country: 'Georgia',       region: 'Europe' },
  { city: 'Istanbul',    country: 'Turkey',        region: 'Europe' },
  { city: 'Marrakech',   country: 'Morocco',       region: 'Africa' },
  { city: 'Cape Town',   country: 'South Africa',  region: 'Africa' },
  { city: 'Mexico City', country: 'Mexico',        region: 'Latin America' },
  { city: 'Oaxaca',      country: 'Mexico',        region: 'Latin America' },
  { city: 'Medellín',    country: 'Colombia',      region: 'Latin America' },
  { city: 'Cartagena',   country: 'Colombia',      region: 'Latin America' },
  { city: 'Nashville',   country: 'United States', region: 'North America' },
  { city: 'New Orleans', country: 'United States', region: 'North America' },
  { city: 'Beirut',      country: 'Lebanon',       region: 'Middle East' },
];

/** Strip markdown code fences that models sometimes wrap JSON in */
function stripFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

/**
 * Call OpenAI to generate or extract structured trip data.
 * Returns parsed JSON or null on failure.
 */
async function callOpenAI(systemPrompt, userPrompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    console.error('[curator] OPENAI_API_KEY not set');
    return null;
  }

  const resp = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error('[curator] OpenAI error:', resp.status, errText.slice(0, 200));
    return null;
  }

  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || '';
  try {
    return JSON.parse(stripFences(raw));
  } catch {
    console.error('[curator] JSON parse error for response:', raw.slice(0, 200));
    return null;
  }
}

const SYSTEM_PROMPT = `You are a travel content curator with deep knowledge of travel blogs, food media, and lifestyle influencers. You specialize in curating authentic, local experiences — not generic tourist fare. You always respond with valid JSON only, no markdown, no explanation.`;

/** Build the generation prompt for a city */
function buildGenerationPrompt(city, country) {
  return `Generate a curated itinerary for ${city}, ${country} that feels authentic and local. Draw from your knowledge of travel influencers like Migrationology (Mark Wiens), Kiona, Adventurous Kate, Nomadic Matt, The Points Guy, and local food writers.

Return a JSON object with this exact structure:
{
  "trip": {
    "title": "X Days in ${city}: [evocative subtitle referencing food/culture/vibe]",
    "description": "2-3 sentences about why ${city} is worth visiting right now and what makes it special",
    "days_suggested": 4,
    "region": "[geographic region like Asia, Europe, Latin America, etc]",
    "tags": ["3-5 vibe tags like food, street art, history, nightlife, nature"]
  },
  "experiences": [
    {
      "title": "Short evocative title",
      "description": "2-3 sentences. Be specific — name the actual street, market stall, dish, or neighbourhood. Explain why it's not to miss.",
      "place_name": "Exact venue or location name (e.g. Nishiki Market, Doi Suthep Temple)",
      "category": "food|culture|nature|nightlife|shopping|adventure|wellness",
      "source_name": "Publication or media type that would cover this (e.g. Eater, Condé Nast Traveler, Atlas Obscura)",
      "influencer_name": "Name of a real influencer or writer associated with this category of travel",
      "quote": "A short evocative first-person quote about why this experience is unmissable",
      "tags": ["1-3 specific tags"],
      "day_number": 1,
      "sort_order": 0
    }
  ]
}

Generate 8-10 experiences spread across 4 days (2-3 per day). Vary categories. Prioritise specific, lesser-known gems and local haunts over obvious tourist traps. day_number goes from 1 to days_suggested. sort_order is 0-indexed within each day.`;
}

/** Build extraction prompt when Tavily content is available */
function buildExtractionPrompt(city, country, searchContent) {
  return `Extract structured travel experiences from the following search results about ${city}, ${country}.

Search content:
${searchContent.slice(0, 6000)}

Return a JSON object with this structure:
{
  "trip": {
    "title": "X Days in ${city}: [subtitle]",
    "description": "2-3 sentences about why ${city} is worth visiting",
    "days_suggested": 4,
    "region": "[geographic region]",
    "tags": ["3-5 tags"]
  },
  "experiences": [
    {
      "title": "Experience title",
      "description": "2-3 sentences with specific details",
      "place_name": "Exact venue name",
      "category": "food|culture|nature|nightlife|shopping|adventure|wellness",
      "source_name": "Source publication if mentioned, otherwise infer",
      "influencer_name": "Influencer or author name if mentioned",
      "quote": "A representative quote about this experience",
      "tags": ["1-3 tags"],
      "day_number": 1,
      "sort_order": 0
    }
  ]
}

Generate 8-10 experiences spread across 4 days. Use information from the search results where available; supplement with your own knowledge where results are thin.`;
}

/** Search Tavily for travel content about a city. Returns combined text or null. */
async function searchTavily(city, country) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;

  const queries = [
    `best things to do in ${city} ${country} food culture travel guide`,
    `${city} hidden gems travel blogger recommendations`,
  ];

  let combined = '';
  for (const query of queries) {
    try {
      const resp = await fetch(TAVILY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: 'advanced',
          include_answer: true,
          max_results: 5,
          include_domains: [
            'cntraveler.com', 'lonelyplanet.com', 'afar.com',
            'theinfatuation.com', 'atlasobscura.com', 'travelandleisure.com',
            'thrillist.com', 'eater.com', 'nomadicmatt.com',
          ],
        }),
      });

      if (resp.status === 429) {
        console.warn('[curator] Tavily rate limited — falling back to OpenAI for', city);
        return null;
      }
      if (!resp.ok) return null;

      const data = await resp.json();
      if (data.answer) combined += data.answer + '\n\n';
      for (const r of (data.results || [])) {
        combined += `Source: ${r.url}\n${r.content}\n\n`;
      }
    } catch (err) {
      console.warn('[curator] Tavily error for', city, err.message);
    }
  }
  return combined || null;
}

/**
 * Fetch curated content for one city.
 * Returns { trip, experiences } or null.
 */
async function curateCity(city, country) {
  // Try Tavily first, fall back to OpenAI-only
  const searchContent = await searchTavily(city, country);

  let result;
  if (searchContent) {
    result = await callOpenAI(SYSTEM_PROMPT, buildExtractionPrompt(city, country, searchContent));
  }
  if (!result) {
    result = await callOpenAI(SYSTEM_PROMPT, buildGenerationPrompt(city, country));
  }
  return result;
}

/**
 * Upsert a trip cluster + its experiences into the DB.
 * Uses ON CONFLICT (city) to update existing trips.
 */
async function upsertTrip(db, seedCity, tripData, experiences) {
  // Upsert trip row
  const tripResult = await db.query(
    `INSERT INTO curated_trips
       (city, country, region, title, description, days_suggested, tags, last_scraped_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (city) DO UPDATE SET
       title           = EXCLUDED.title,
       description     = EXCLUDED.description,
       days_suggested  = EXCLUDED.days_suggested,
       tags            = EXCLUDED.tags,
       last_scraped_at = NOW()
     RETURNING id`,
    [
      seedCity.city,
      seedCity.country,
      tripData.region || seedCity.region,
      tripData.title,
      tripData.description,
      tripData.days_suggested || 4,
      tripData.tags || [],
    ]
  );

  const tripId = tripResult.rows[0].id;

  // Replace experiences entirely on each refresh
  await db.query('DELETE FROM curated_experiences WHERE trip_id = $1', [tripId]);

  for (let i = 0; i < experiences.length; i++) {
    const e = experiences[i];
    const category = ['food','culture','nature','nightlife','shopping','adventure','wellness']
      .includes(e.category) ? e.category : 'culture';

    await db.query(
      `INSERT INTO curated_experiences
         (trip_id, title, description, place_name, category,
          source_name, influencer_name, quote, tags, day_number, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        tripId,
        e.title || '',
        e.description || '',
        e.place_name || '',
        category,
        e.source_name || '',
        e.influencer_name || '',
        e.quote || '',
        e.tags || [],
        e.day_number || 1,
        e.sort_order != null ? e.sort_order : i,
      ]
    );
  }

  return tripId;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

/**
 * Main entry point — loops all seed cities and upserts curated content.
 * Designed to be called from the /api/explore/refresh endpoint (fire-and-forget).
 */
async function runCurator(db) {
  console.log('[curator] Starting refresh for', SEED_CITIES.length, 'cities');
  let success = 0;
  let failed = 0;

  for (const seedCity of SEED_CITIES) {
    try {
      console.log(`[curator] Processing ${seedCity.city}…`);
      const result = await curateCity(seedCity.city, seedCity.country);

      if (!result?.trip || !Array.isArray(result?.experiences)) {
        console.warn(`[curator] No valid data for ${seedCity.city} — skipping`);
        failed++;
      } else {
        await upsertTrip(db, seedCity, result.trip, result.experiences);
        console.log(`[curator] ✓ ${seedCity.city} — ${result.experiences.length} experiences`);
        success++;
      }
    } catch (err) {
      console.error(`[curator] Error for ${seedCity.city}:`, err.message);
      failed++;
    }

    // Small delay between cities to avoid rate limits
    await delay(500);
  }

  console.log(`[curator] Done — ${success} succeeded, ${failed} failed`);
}

module.exports = { runCurator, SEED_CITIES };
