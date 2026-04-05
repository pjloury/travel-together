#!/usr/bin/env node
// Seed gallery with 500 stunning travel photos from Unsplash
// Usage: UNSPLASH_ACCESS_KEY=xxx DATABASE_URL=xxx node server/scripts/seed-gallery.js

const { Pool } = require('pg');

const UNSPLASH_BASE = 'https://api.unsplash.com';
const KEY = process.env.UNSPLASH_ACCESS_KEY;
const DB_URL = process.env.DATABASE_URL;

if (!KEY || !DB_URL) {
  console.error('Set UNSPLASH_ACCESS_KEY and DATABASE_URL');
  process.exit(1);
}

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

// 100 iconic destinations × 5 photos each = 500
const DESTINATIONS = [
  // Asia
  { query: 'Bali rice terraces', location: 'Bali', country: 'Indonesia', region: 'Asia' },
  { query: 'Tokyo Shibuya neon', location: 'Tokyo', country: 'Japan', region: 'Asia' },
  { query: 'Kyoto bamboo grove', location: 'Kyoto', country: 'Japan', region: 'Asia' },
  { query: 'Angkor Wat sunrise', location: 'Angkor Wat', country: 'Cambodia', region: 'Asia' },
  { query: 'Ha Long Bay Vietnam', location: 'Ha Long Bay', country: 'Vietnam', region: 'Asia' },
  { query: 'Taj Mahal sunrise', location: 'Agra', country: 'India', region: 'Asia' },
  { query: 'Great Wall China', location: 'Great Wall', country: 'China', region: 'Asia' },
  { query: 'Mount Fuji Japan', location: 'Mount Fuji', country: 'Japan', region: 'Asia' },
  { query: 'Maldives overwater bungalow', location: 'Maldives', country: 'Maldives', region: 'Asia' },
  { query: 'Zhangjiajie China pillars', location: 'Zhangjiajie', country: 'China', region: 'Asia' },
  { query: 'Kerala backwaters India', location: 'Kerala', country: 'India', region: 'Asia' },
  { query: 'Luang Prabang monks sunrise', location: 'Luang Prabang', country: 'Laos', region: 'Asia' },
  // Europe
  { query: 'Santorini blue dome sunset', location: 'Santorini', country: 'Greece', region: 'Europe' },
  { query: 'Amalfi Coast Italy aerial', location: 'Amalfi Coast', country: 'Italy', region: 'Europe' },
  { query: 'Swiss Alps Matterhorn', location: 'Matterhorn', country: 'Switzerland', region: 'Europe' },
  { query: 'Northern Lights Iceland', location: 'Iceland', country: 'Iceland', region: 'Europe' },
  { query: 'Cinque Terre Italy colorful', location: 'Cinque Terre', country: 'Italy', region: 'Europe' },
  { query: 'Norwegian fjords scenic', location: 'Norwegian Fjords', country: 'Norway', region: 'Europe' },
  { query: 'Plitvice Lakes Croatia', location: 'Plitvice Lakes', country: 'Croatia', region: 'Europe' },
  { query: 'Hallstatt Austria lake', location: 'Hallstatt', country: 'Austria', region: 'Europe' },
  { query: 'Tuscany Italy rolling hills', location: 'Tuscany', country: 'Italy', region: 'Europe' },
  { query: 'Lofoten Islands Norway', location: 'Lofoten', country: 'Norway', region: 'Europe' },
  { query: 'Dubrovnik old town aerial', location: 'Dubrovnik', country: 'Croatia', region: 'Europe' },
  { query: 'Edinburgh castle Scotland', location: 'Edinburgh', country: 'United Kingdom', region: 'Europe' },
  { query: 'Paris Eiffel Tower sunset', location: 'Paris', country: 'France', region: 'Europe' },
  { query: 'Prague Charles Bridge sunrise', location: 'Prague', country: 'Czech Republic', region: 'Europe' },
  { query: 'Venice Grand Canal sunset', location: 'Venice', country: 'Italy', region: 'Europe' },
  { query: 'Meteora monasteries Greece', location: 'Meteora', country: 'Greece', region: 'Europe' },
  { query: 'Dolomites Italy mountain', location: 'Dolomites', country: 'Italy', region: 'Europe' },
  { query: 'Lake Bled Slovenia', location: 'Lake Bled', country: 'Slovenia', region: 'Europe' },
  // Africa
  { query: 'Serengeti migration safari', location: 'Serengeti', country: 'Tanzania', region: 'Africa' },
  { query: 'Table Mountain Cape Town', location: 'Cape Town', country: 'South Africa', region: 'Africa' },
  { query: 'Sahara Desert dunes', location: 'Sahara Desert', country: 'Morocco', region: 'Africa' },
  { query: 'Victoria Falls Zimbabwe', location: 'Victoria Falls', country: 'Zimbabwe', region: 'Africa' },
  { query: 'Zanzibar beach turquoise', location: 'Zanzibar', country: 'Tanzania', region: 'Africa' },
  { query: 'Marrakech Jardin Majorelle', location: 'Marrakech', country: 'Morocco', region: 'Africa' },
  { query: 'Namib desert Sossusvlei', location: 'Sossusvlei', country: 'Namibia', region: 'Africa' },
  { query: 'Kilimanjaro sunrise', location: 'Mount Kilimanjaro', country: 'Tanzania', region: 'Africa' },
  // South America
  { query: 'Machu Picchu Peru sunrise', location: 'Machu Picchu', country: 'Peru', region: 'South America' },
  { query: 'Patagonia Torres del Paine', location: 'Torres del Paine', country: 'Chile', region: 'South America' },
  { query: 'Iguazu Falls aerial', location: 'Iguazu Falls', country: 'Argentina', region: 'South America' },
  { query: 'Salar de Uyuni Bolivia mirror', location: 'Salar de Uyuni', country: 'Bolivia', region: 'South America' },
  { query: 'Galapagos Islands wildlife', location: 'Galapagos', country: 'Ecuador', region: 'South America' },
  { query: 'Rio de Janeiro Sugarloaf sunset', location: 'Rio de Janeiro', country: 'Brazil', region: 'South America' },
  { query: 'Amazon rainforest river', location: 'Amazon Rainforest', country: 'Brazil', region: 'South America' },
  { query: 'Atacama Desert Chile stars', location: 'Atacama Desert', country: 'Chile', region: 'South America' },
  // North America
  { query: 'Grand Canyon aerial sunset', location: 'Grand Canyon', country: 'United States', region: 'North America' },
  { query: 'Yosemite Valley El Capitan', location: 'Yosemite', country: 'United States', region: 'North America' },
  { query: 'Banff Lake Louise turquoise', location: 'Banff', country: 'Canada', region: 'North America' },
  { query: 'Antelope Canyon light beam', location: 'Antelope Canyon', country: 'United States', region: 'North America' },
  { query: 'Hawaii Na Pali Coast aerial', location: 'Na Pali Coast', country: 'United States', region: 'North America' },
  { query: 'Tulum ruins beach Mexico', location: 'Tulum', country: 'Mexico', region: 'North America' },
  { query: 'Yellowstone Grand Prismatic', location: 'Yellowstone', country: 'United States', region: 'North America' },
  { query: 'Monument Valley Utah', location: 'Monument Valley', country: 'United States', region: 'North America' },
  { query: 'Niagara Falls rainbow', location: 'Niagara Falls', country: 'Canada', region: 'North America' },
  { query: 'Glacier National Park Montana', location: 'Glacier NP', country: 'United States', region: 'North America' },
  // Oceania
  { query: 'Great Barrier Reef aerial', location: 'Great Barrier Reef', country: 'Australia', region: 'Oceania' },
  { query: 'Milford Sound New Zealand', location: 'Milford Sound', country: 'New Zealand', region: 'Oceania' },
  { query: 'Bora Bora lagoon aerial', location: 'Bora Bora', country: 'French Polynesia', region: 'Oceania' },
  { query: 'Uluru Ayers Rock sunset', location: 'Uluru', country: 'Australia', region: 'Oceania' },
  { query: 'Queenstown New Zealand lake', location: 'Queenstown', country: 'New Zealand', region: 'Oceania' },
  { query: 'Sydney Opera House harbour', location: 'Sydney', country: 'Australia', region: 'Oceania' },
  { query: 'Twelve Apostles Australia', location: 'Twelve Apostles', country: 'Australia', region: 'Oceania' },
  { query: 'Tongariro Crossing volcano', location: 'Tongariro', country: 'New Zealand', region: 'Oceania' },
  // Middle East
  { query: 'Petra Treasury Jordan', location: 'Petra', country: 'Jordan', region: 'Middle East' },
  { query: 'Cappadocia hot air balloons', location: 'Cappadocia', country: 'Turkey', region: 'Middle East' },
  { query: 'Wadi Rum desert Jordan', location: 'Wadi Rum', country: 'Jordan', region: 'Middle East' },
  { query: 'Dubai skyline sunset', location: 'Dubai', country: 'UAE', region: 'Middle East' },
  { query: 'Dead Sea Israel', location: 'Dead Sea', country: 'Israel', region: 'Middle East' },
  { query: 'Pamukkale Turkey travertine', location: 'Pamukkale', country: 'Turkey', region: 'Middle East' },
  // Additional iconic spots
  { query: 'Moraine Lake Canada turquoise', location: 'Moraine Lake', country: 'Canada', region: 'North America' },
  { query: 'Lake Como Italy villas', location: 'Lake Como', country: 'Italy', region: 'Europe' },
  { query: 'Phi Phi Islands Thailand', location: 'Phi Phi Islands', country: 'Thailand', region: 'Asia' },
  { query: 'Faroe Islands dramatic', location: 'Faroe Islands', country: 'Denmark', region: 'Europe' },
  { query: 'Zhangjiajie glass bridge', location: 'Zhangjiajie', country: 'China', region: 'Asia' },
  { query: 'Lake Tahoe California winter', location: 'Lake Tahoe', country: 'United States', region: 'North America' },
  { query: 'Neuschwanstein Castle Germany', location: 'Neuschwanstein', country: 'Germany', region: 'Europe' },
  { query: 'Chefchaouen Morocco blue city', location: 'Chefchaouen', country: 'Morocco', region: 'Africa' },
  { query: 'Jiuzhaigou Valley China', location: 'Jiuzhaigou', country: 'China', region: 'Asia' },
  { query: 'Preikestolen Norway cliff', location: 'Preikestolen', country: 'Norway', region: 'Europe' },
  { query: 'Blue Lagoon Iceland', location: 'Blue Lagoon', country: 'Iceland', region: 'Europe' },
  { query: 'Kotor Bay Montenegro', location: 'Kotor', country: 'Montenegro', region: 'Europe' },
  { query: 'Havana Cuba vintage cars', location: 'Havana', country: 'Cuba', region: 'Latin America' },
  { query: 'Rainbow Mountain Peru', location: 'Rainbow Mountain', country: 'Peru', region: 'South America' },
  { query: 'Cliffs of Moher Ireland', location: 'Cliffs of Moher', country: 'Ireland', region: 'Europe' },
  { query: 'Positano Italy village coast', location: 'Positano', country: 'Italy', region: 'Europe' },
  { query: 'Petra monastery Jordan', location: 'Petra Monastery', country: 'Jordan', region: 'Middle East' },
  { query: 'Oia Santorini windmill sunset', location: 'Oia', country: 'Greece', region: 'Europe' },
  { query: 'El Nido Palawan Philippines', location: 'El Nido', country: 'Philippines', region: 'Asia' },
  { query: 'Bruges Belgium canal medieval', location: 'Bruges', country: 'Belgium', region: 'Europe' },
  { query: 'Trolltunga Norway cliff', location: 'Trolltunga', country: 'Norway', region: 'Europe' },
  { query: 'Petra Siq canyon Jordan', location: 'Petra Siq', country: 'Jordan', region: 'Middle East' },
  { query: 'Mount Rainier wildflowers', location: 'Mount Rainier', country: 'United States', region: 'North America' },
  { query: 'Zion National Park narrows', location: 'Zion', country: 'United States', region: 'North America' },
  { query: 'Colosseum Rome golden hour', location: 'Rome', country: 'Italy', region: 'Europe' },
  { query: 'Whitsunday Islands Australia aerial', location: 'Whitsundays', country: 'Australia', region: 'Oceania' },
  { query: 'Huacachina oasis Peru', location: 'Huacachina', country: 'Peru', region: 'South America' },
  { query: 'Jokulsarlon glacier lagoon Iceland', location: 'Jokulsarlon', country: 'Iceland', region: 'Europe' },
  { query: 'Svalbard Arctic landscape', location: 'Svalbard', country: 'Norway', region: 'Europe' },
];

const PEOPLE_RE = /\bpeople\b|\bperson\b|\bwoman\b|\bman\b|\bportrait\b|\bselfie\b|\bcrowd\b|\bcouple\b|\btourist\b/i;

async function fetchPhotos(dest) {
  const q = `${dest.query} landscape scenery -people -portrait`;
  const url = `${UNSPLASH_BASE}/search/photos?query=${encodeURIComponent(q)}&per_page=8&orientation=landscape&order_by=relevant`;

  const res = await fetch(url, { headers: { Authorization: `Client-ID ${KEY}` } });
  if (!res.ok) {
    console.error(`  API error ${res.status} for ${dest.location}`);
    return [];
  }

  const data = await res.json();
  const results = data.results || [];

  // Filter out people, sort by likes
  const filtered = results.filter(p => {
    const desc = `${p.description || ''} ${p.alt_description || ''}`;
    return !PEOPLE_RE.test(desc);
  });

  const candidates = filtered.length >= 5 ? filtered : results;
  return candidates
    .sort((a, b) => (b.likes || 0) - (a.likes || 0))
    .slice(0, 5)
    .map(p => ({
      image_url: p.urls.regular,
      thumb_url: p.urls.small,
      photographer_name: p.user.name,
      photographer_url: p.user.links.html,
      unsplash_url: p.links.html,
      location_name: dest.location,
      country: dest.country,
      region: dest.region,
      latitude: p.location?.position?.latitude || null,
      longitude: p.location?.position?.longitude || null,
      description: p.alt_description || p.description || '',
      likes: p.likes || 0,
      tags: [dest.region?.toLowerCase(), dest.country?.toLowerCase()].filter(Boolean),
    }));
}

async function run() {
  console.log(`Seeding gallery with ${DESTINATIONS.length} destinations × 5 photos...`);
  let total = 0;

  for (let i = 0; i < DESTINATIONS.length; i++) {
    const dest = DESTINATIONS[i];
    process.stdout.write(`[${i + 1}/${DESTINATIONS.length}] ${dest.location}... `);

    try {
      const photos = await fetchPhotos(dest);

      for (const p of photos) {
        await pool.query(
          `INSERT INTO gallery_photos
             (image_url, thumb_url, photographer_name, photographer_url, unsplash_url,
              location_name, country, region, latitude, longitude, description, likes, tags)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT DO NOTHING`,
          [p.image_url, p.thumb_url, p.photographer_name, p.photographer_url, p.unsplash_url,
           p.location_name, p.country, p.region, p.latitude, p.longitude,
           p.description, p.likes, p.tags]
        );
      }

      console.log(`${photos.length} photos`);
      total += photos.length;
    } catch (err) {
      console.log(`error: ${err.message}`);
    }

    // Respect rate limits (50 req/hr for demo apps)
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`\nDone: ${total} photos seeded`);
  const count = await pool.query('SELECT COUNT(*) FROM gallery_photos');
  console.log(`Total in DB: ${count.rows[0].count}`);
  pool.end();
}

run().catch(err => { console.error(err); pool.end(); process.exit(1); });
