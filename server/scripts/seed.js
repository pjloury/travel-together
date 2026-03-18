#!/usr/bin/env node
/**
 * Seed script for Travel Together
 * 
 * Usage:
 *   node scripts/seed.js              # Seed local database
 *   node scripts/seed.js --prod       # Seed production database
 *   node scripts/seed.js --dry-run    # Preview without inserting
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const TEST_PASSWORD = 'TestPass123!';
const TEST_EMAIL_DOMAIN = 'test.traveltogether.com';

const TEST_USERS = [
  {
    email: `alex@${TEST_EMAIL_DOMAIN}`,
    username: 'alex_adventure',
    displayName: 'Alex Adventure',
    countries: [
      { code: 'JP', name: 'Japan', cities: ['Tokyo', 'Kyoto', 'Osaka'] },
      { code: 'TH', name: 'Thailand', cities: ['Bangkok', 'Chiang Mai', 'Phuket'] },
      { code: 'VN', name: 'Vietnam', cities: ['Hanoi', 'Ho Chi Minh City', 'Da Nang'] },
      { code: 'KH', name: 'Cambodia', cities: ['Siem Reap', 'Phnom Penh'] },
      { code: 'ID', name: 'Indonesia', cities: ['Bali', 'Jakarta', 'Yogyakarta'] },
      { code: 'PH', name: 'Philippines', cities: ['Manila', 'Cebu', 'Palawan'] },
      { code: 'MY', name: 'Malaysia', cities: ['Kuala Lumpur', 'Penang'] },
      { code: 'SG', name: 'Singapore', cities: ['Singapore'] },
      { code: 'KR', name: 'South Korea', cities: ['Seoul', 'Busan'] },
      { code: 'TW', name: 'Taiwan', cities: ['Taipei', 'Kaohsiung'] },
      { code: 'NP', name: 'Nepal', cities: ['Kathmandu', 'Pokhara'] },
      { code: 'IN', name: 'India', cities: ['Delhi', 'Mumbai', 'Goa'] },
    ],
    wishlist: [
      { code: 'PE', name: 'Peru', interest: 5, cities: ['Lima', 'Cusco', 'Machu Picchu'] },
      { code: 'AR', name: 'Argentina', interest: 4, cities: ['Buenos Aires', 'Patagonia'] },
      { code: 'CO', name: 'Colombia', interest: 4, cities: ['Bogota', 'Medellin', 'Cartagena'] },
      { code: 'BR', name: 'Brazil', interest: 3, cities: ['Rio de Janeiro', 'Sao Paulo'] },
    ],
    friendsWith: ['bella_beach', 'diana_digital', 'ethan_explorer']
  },
  {
    email: `bella@${TEST_EMAIL_DOMAIN}`,
    username: 'bella_beach',
    displayName: 'Bella Beach',
    countries: [
      { code: 'MX', name: 'Mexico', cities: ['Cancun', 'Playa del Carmen', 'Tulum'] },
      { code: 'JM', name: 'Jamaica', cities: ['Montego Bay', 'Negril'] },
      { code: 'GR', name: 'Greece', cities: ['Santorini', 'Mykonos', 'Athens'] },
      { code: 'ES', name: 'Spain', cities: ['Barcelona', 'Ibiza', 'Mallorca'] },
      { code: 'IT', name: 'Italy', cities: ['Amalfi Coast', 'Capri', 'Positano'] },
      { code: 'HR', name: 'Croatia', cities: ['Dubrovnik', 'Split', 'Hvar'] },
    ],
    wishlist: [
      { code: 'MV', name: 'Maldives', interest: 5, cities: [] },
      { code: 'ID', name: 'Indonesia', interest: 5, cities: ['Bali', 'Gili Islands'] },
      { code: 'EG', name: 'Egypt', interest: 3, cities: ['Cairo', 'Luxor'] },
      { code: 'TH', name: 'Thailand', interest: 4, cities: ['Phuket', 'Koh Samui'] },
    ],
    friendsWith: ['alex_adventure', 'carlos_culture', 'fiona_foodie']
  },
  {
    email: `carlos@${TEST_EMAIL_DOMAIN}`,
    username: 'carlos_culture',
    displayName: 'Carlos Culture',
    countries: [
      { code: 'IT', name: 'Italy', cities: ['Rome', 'Florence', 'Venice', 'Milan'] },
      { code: 'FR', name: 'France', cities: ['Paris', 'Nice', 'Lyon'] },
      { code: 'ES', name: 'Spain', cities: ['Madrid', 'Barcelona', 'Seville'] },
      { code: 'GB', name: 'United Kingdom', cities: ['London', 'Edinburgh', 'Oxford'] },
      { code: 'DE', name: 'Germany', cities: ['Berlin', 'Munich', 'Hamburg'] },
      { code: 'AT', name: 'Austria', cities: ['Vienna', 'Salzburg'] },
      { code: 'CZ', name: 'Czech Republic', cities: ['Prague'] },
      { code: 'NL', name: 'Netherlands', cities: ['Amsterdam'] },
    ],
    wishlist: [
      { code: 'EG', name: 'Egypt', interest: 5, cities: ['Cairo', 'Luxor', 'Aswan'] },
      { code: 'PE', name: 'Peru', interest: 5, cities: ['Machu Picchu', 'Cusco'] },
      { code: 'JP', name: 'Japan', interest: 4, cities: ['Kyoto', 'Nara'] },
      { code: 'GR', name: 'Greece', interest: 4, cities: ['Athens', 'Delphi'] },
    ],
    friendsWith: ['bella_beach', 'diana_digital', 'george_golfer']
  },
  {
    email: `diana@${TEST_EMAIL_DOMAIN}`,
    username: 'diana_digital',
    displayName: 'Diana Digital',
    countries: [
      { code: 'TH', name: 'Thailand', cities: ['Bangkok', 'Chiang Mai'] },
      { code: 'ID', name: 'Indonesia', cities: ['Bali', 'Canggu'] },
      { code: 'PT', name: 'Portugal', cities: ['Lisbon', 'Porto'] },
      { code: 'ES', name: 'Spain', cities: ['Barcelona', 'Valencia'] },
      { code: 'VN', name: 'Vietnam', cities: ['Ho Chi Minh City', 'Da Nang'] },
      { code: 'JP', name: 'Japan', cities: ['Tokyo', 'Osaka'] },
    ],
    wishlist: [
      { code: 'MX', name: 'Mexico', interest: 5, cities: ['Mexico City', 'Oaxaca', 'Playa del Carmen'] },
      { code: 'CO', name: 'Colombia', interest: 5, cities: ['Medellin', 'Bogota'] },
      { code: 'HR', name: 'Croatia', interest: 3, cities: ['Split', 'Dubrovnik'] },
    ],
    friendsWith: ['alex_adventure', 'carlos_culture', 'ethan_explorer', 'hannah_hiker']
  },
  {
    email: `ethan@${TEST_EMAIL_DOMAIN}`,
    username: 'ethan_explorer',
    displayName: 'Ethan Explorer',
    countries: [
      { code: 'MN', name: 'Mongolia', cities: ['Ulaanbaatar'] },
      { code: 'UZ', name: 'Uzbekistan', cities: ['Samarkand', 'Bukhara'] },
      { code: 'GE', name: 'Georgia', cities: ['Tbilisi'] },
      { code: 'AM', name: 'Armenia', cities: ['Yerevan'] },
      { code: 'MA', name: 'Morocco', cities: ['Marrakech', 'Fez'] },
      { code: 'ET', name: 'Ethiopia', cities: ['Addis Ababa', 'Lalibela'] },
      { code: 'TZ', name: 'Tanzania', cities: ['Dar es Salaam', 'Zanzibar'] },
      { code: 'KE', name: 'Kenya', cities: ['Nairobi'] },
    ],
    wishlist: [
      { code: 'AQ', name: 'Antarctica', interest: 5, cities: [] },
      { code: 'BT', name: 'Bhutan', interest: 5, cities: ['Thimphu', 'Paro'] },
      { code: 'NP', name: 'Nepal', interest: 4, cities: ['Kathmandu', 'Everest Base Camp'] },
      { code: 'PK', name: 'Pakistan', interest: 4, cities: ['Lahore', 'Hunza Valley'] },
    ],
    friendsWith: ['alex_adventure', 'diana_digital', 'fiona_foodie', 'hannah_hiker']
  },
  {
    email: `fiona@${TEST_EMAIL_DOMAIN}`,
    username: 'fiona_foodie',
    displayName: 'Fiona Foodie',
    countries: [
      { code: 'IT', name: 'Italy', cities: ['Rome', 'Bologna', 'Naples', 'Florence'] },
      { code: 'JP', name: 'Japan', cities: ['Tokyo', 'Osaka', 'Kyoto'] },
      { code: 'TH', name: 'Thailand', cities: ['Bangkok', 'Chiang Mai'] },
      { code: 'FR', name: 'France', cities: ['Paris', 'Lyon', 'Bordeaux'] },
      { code: 'ES', name: 'Spain', cities: ['San Sebastian', 'Barcelona'] },
      { code: 'MX', name: 'Mexico', cities: ['Mexico City', 'Oaxaca'] },
    ],
    wishlist: [
      { code: 'PE', name: 'Peru', interest: 5, cities: ['Lima', 'Cusco'] },
      { code: 'IN', name: 'India', interest: 5, cities: ['Delhi', 'Mumbai', 'Kerala'] },
      { code: 'VN', name: 'Vietnam', interest: 4, cities: ['Hanoi', 'Hoi An'] },
      { code: 'KR', name: 'South Korea', interest: 4, cities: ['Seoul'] },
    ],
    friendsWith: ['bella_beach', 'ethan_explorer', 'george_golfer', 'ivan_islander']
  },
  {
    email: `george@${TEST_EMAIL_DOMAIN}`,
    username: 'george_golfer',
    displayName: 'George Golfer',
    countries: [
      { code: 'GB', name: 'United Kingdom', cities: ['St Andrews', 'Edinburgh'] },
      { code: 'IE', name: 'Ireland', cities: ['Dublin', 'Ballybunion'] },
      { code: 'ES', name: 'Spain', cities: ['Marbella', 'Sotogrande'] },
      { code: 'PT', name: 'Portugal', cities: ['Algarve', 'Lisbon'] },
      { code: 'US', name: 'United States', cities: ['Pebble Beach', 'Scottsdale', 'Augusta'] },
      { code: 'AE', name: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi'] },
    ],
    wishlist: [
      { code: 'NZ', name: 'New Zealand', interest: 5, cities: ['Queenstown'] },
      { code: 'ZA', name: 'South Africa', interest: 5, cities: ['Cape Town'] },
      { code: 'AU', name: 'Australia', interest: 4, cities: ['Melbourne', 'Sydney'] },
      { code: 'JP', name: 'Japan', interest: 3, cities: ['Tokyo'] },
    ],
    friendsWith: ['carlos_culture', 'fiona_foodie', 'hannah_hiker', 'julia_jetsetter']
  },
  {
    email: `hannah@${TEST_EMAIL_DOMAIN}`,
    username: 'hannah_hiker',
    displayName: 'Hannah Hiker',
    countries: [
      { code: 'NP', name: 'Nepal', cities: ['Kathmandu', 'Pokhara', 'Everest Base Camp'] },
      { code: 'PE', name: 'Peru', cities: ['Cusco', 'Machu Picchu', 'Sacred Valley'] },
      { code: 'CH', name: 'Switzerland', cities: ['Zermatt', 'Interlaken', 'Grindelwald'] },
      { code: 'NZ', name: 'New Zealand', cities: ['Queenstown', 'Milford Sound'] },
      { code: 'CA', name: 'Canada', cities: ['Banff', 'Vancouver', 'Whistler'] },
      { code: 'NO', name: 'Norway', cities: ['Bergen', 'Tromsø'] },
    ],
    wishlist: [
      { code: 'AR', name: 'Argentina', interest: 5, cities: ['Patagonia', 'El Chalten'] },
      { code: 'CL', name: 'Chile', interest: 5, cities: ['Torres del Paine', 'Atacama'] },
      { code: 'IS', name: 'Iceland', interest: 4, cities: ['Reykjavik'] },
      { code: 'TZ', name: 'Tanzania', interest: 4, cities: ['Kilimanjaro'] },
    ],
    friendsWith: ['diana_digital', 'ethan_explorer', 'george_golfer', 'ivan_islander']
  },
  {
    email: `ivan@${TEST_EMAIL_DOMAIN}`,
    username: 'ivan_islander',
    displayName: 'Ivan Islander',
    countries: [
      { code: 'ID', name: 'Indonesia', cities: ['Bali', 'Lombok', 'Raja Ampat', 'Komodo'] },
      { code: 'PH', name: 'Philippines', cities: ['Palawan', 'Siargao', 'Boracay'] },
      { code: 'GR', name: 'Greece', cities: ['Santorini', 'Mykonos', 'Crete', 'Rhodes'] },
      { code: 'TH', name: 'Thailand', cities: ['Phuket', 'Koh Phi Phi', 'Koh Samui'] },
      { code: 'MV', name: 'Maldives', cities: ['Male'] },
      { code: 'HR', name: 'Croatia', cities: ['Hvar', 'Korcula'] },
    ],
    wishlist: [
      { code: 'FJ', name: 'Fiji', interest: 5, cities: [] },
      { code: 'SC', name: 'Seychelles', interest: 5, cities: [] },
      { code: 'MU', name: 'Mauritius', interest: 4, cities: [] },
      { code: 'PF', name: 'French Polynesia', interest: 5, cities: ['Bora Bora', 'Tahiti'] },
    ],
    friendsWith: ['fiona_foodie', 'hannah_hiker', 'julia_jetsetter', 'kevin_camper']
  },
  {
    email: `julia@${TEST_EMAIL_DOMAIN}`,
    username: 'julia_jetsetter',
    displayName: 'Julia Jetsetter',
    countries: [
      { code: 'FR', name: 'France', cities: ['Paris', 'Monaco', 'Nice', 'Cannes'] },
      { code: 'AE', name: 'United Arab Emirates', cities: ['Dubai', 'Abu Dhabi'] },
      { code: 'SG', name: 'Singapore', cities: ['Singapore'] },
      { code: 'CH', name: 'Switzerland', cities: ['Zurich', 'Geneva', 'St. Moritz'] },
      { code: 'IT', name: 'Italy', cities: ['Milan', 'Lake Como', 'Venice'] },
      { code: 'JP', name: 'Japan', cities: ['Tokyo', 'Kyoto'] },
      { code: 'HK', name: 'Hong Kong', cities: ['Hong Kong'] },
    ],
    wishlist: [
      { code: 'MC', name: 'Monaco', interest: 5, cities: ['Monte Carlo'] },
      { code: 'BL', name: 'Saint Barthélemy', interest: 5, cities: [] },
      { code: 'AU', name: 'Australia', interest: 4, cities: ['Sydney', 'Melbourne'] },
      { code: 'MV', name: 'Maldives', interest: 4, cities: [] },
    ],
    friendsWith: ['george_golfer', 'ivan_islander', 'kevin_camper', 'luna_local']
  },
  {
    email: `kevin@${TEST_EMAIL_DOMAIN}`,
    username: 'kevin_camper',
    displayName: 'Kevin Camper',
    countries: [
      { code: 'US', name: 'United States', cities: ['Yellowstone', 'Grand Canyon', 'Yosemite', 'Zion'] },
      { code: 'CA', name: 'Canada', cities: ['Banff', 'Jasper', 'Vancouver Island'] },
      { code: 'AU', name: 'Australia', cities: ['Sydney', 'Melbourne', 'Great Ocean Road', 'Uluru'] },
      { code: 'NZ', name: 'New Zealand', cities: ['Queenstown', 'Rotorua', 'Auckland'] },
      { code: 'ZA', name: 'South Africa', cities: ['Cape Town', 'Kruger National Park'] },
    ],
    wishlist: [
      { code: 'NO', name: 'Norway', interest: 5, cities: ['Bergen', 'Lofoten', 'Tromsø'] },
      { code: 'IS', name: 'Iceland', interest: 5, cities: ['Reykjavik', 'Ring Road'] },
      { code: 'SE', name: 'Sweden', interest: 4, cities: ['Stockholm', 'Swedish Lapland'] },
      { code: 'FI', name: 'Finland', interest: 4, cities: ['Helsinki', 'Lapland'] },
    ],
    friendsWith: ['ivan_islander', 'julia_jetsetter', 'luna_local']
  },
  {
    email: `luna@${TEST_EMAIL_DOMAIN}`,
    username: 'luna_local',
    displayName: 'Luna Local',
    countries: [
      { code: 'MX', name: 'Mexico', cities: ['Mexico City', 'Oaxaca', 'San Miguel de Allende', 'Guanajuato'] },
      { code: 'ES', name: 'Spain', cities: ['Barcelona', 'Madrid', 'Seville', 'Granada'] },
      { code: 'VN', name: 'Vietnam', cities: ['Hanoi', 'Hoi An', 'Ho Chi Minh City'] },
      { code: 'IT', name: 'Italy', cities: ['Rome', 'Florence', 'Bologna', 'Sicily'] },
      { code: 'FR', name: 'France', cities: ['Paris', 'Provence', 'Bordeaux'] },
    ],
    wishlist: [
      { code: 'PT', name: 'Portugal', interest: 5, cities: ['Lisbon', 'Porto', 'Algarve'] },
      { code: 'TH', name: 'Thailand', interest: 4, cities: ['Chiang Mai', 'Bangkok'] },
      { code: 'JP', name: 'Japan', interest: 4, cities: ['Kyoto', 'Tokyo'] },
      { code: 'CO', name: 'Colombia', interest: 4, cities: ['Cartagena', 'Medellin'] },
    ],
    friendsWith: ['julia_jetsetter', 'kevin_camper', 'alex_adventure']
  }
];

async function seed(options = {}) {
  const isProd = options.prod || process.argv.includes('--prod');
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  
  const connectionString = isProd 
    ? process.env.DATABASE_URL 
    : (process.env.DATABASE_URL_LOCAL || 'postgresql://localhost:5432/travel_together');
  
  console.log(`\n🌱 Seeding ${isProd ? 'PRODUCTION' : 'LOCAL'} database...`);
  console.log(`   Connection: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  if (isDryRun) console.log('   (DRY RUN - no data will be inserted)\n');
  
  const pool = new Pool({ 
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : false
  });

  try {
    // Hash password once
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    
    // Create users
    console.log('\n📝 Creating users...');
    const userIds = {};
    
    for (const user of TEST_USERS) {
      console.log(`   + ${user.displayName} (${user.username})`);
      
      if (!isDryRun) {
        // Check if user exists
        const existing = await pool.query(
          'SELECT id FROM users WHERE email = $1',
          [user.email]
        );
        
        if (existing.rows.length > 0) {
          userIds[user.username] = existing.rows[0].id;
          console.log(`     (already exists)`);
        } else {
          const result = await pool.query(
            `INSERT INTO users (email, username, display_name, password_hash)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [user.email, user.username, user.displayName, passwordHash]
          );
          userIds[user.username] = result.rows[0].id;
        }
      }
    }

    // Add countries and cities
    console.log('\n🌍 Adding travel history...');
    for (const user of TEST_USERS) {
      const userId = userIds[user.username];
      if (!userId && !isDryRun) continue;
      
      for (const country of user.countries) {
        if (!isDryRun) {
          // Check if country visit exists
          const existing = await pool.query(
            'SELECT id FROM country_visits WHERE user_id = $1 AND country_code = $2',
            [userId, country.code]
          );
          
          let countryVisitId;
          if (existing.rows.length > 0) {
            countryVisitId = existing.rows[0].id;
          } else {
            const countryResult = await pool.query(
              `INSERT INTO country_visits (user_id, country_code, country_name)
               VALUES ($1, $2, $3)
               RETURNING id`,
              [userId, country.code, country.name]
            );
            countryVisitId = countryResult.rows[0].id;
          }
          
          // Add cities
          for (const city of country.cities) {
            const cityExists = await pool.query(
              'SELECT id FROM city_visits WHERE country_visit_id = $1 AND city_name = $2',
              [countryVisitId, city]
            );
            
            if (cityExists.rows.length === 0) {
              await pool.query(
                `INSERT INTO city_visits (user_id, country_visit_id, city_name)
                 VALUES ($1, $2, $3)`,
                [userId, countryVisitId, city]
              );
            }
          }
        }
      }
      console.log(`   + ${user.username}: ${user.countries.length} countries`);
    }

    // Add wishlists
    console.log('\n💫 Adding wishlists...');
    for (const user of TEST_USERS) {
      const userId = userIds[user.username];
      if (!userId && !isDryRun) continue;
      
      for (const wish of user.wishlist) {
        if (!isDryRun) {
          const existing = await pool.query(
            'SELECT id FROM country_wishlist WHERE user_id = $1 AND country_code = $2',
            [userId, wish.code]
          );
          
          if (existing.rows.length === 0) {
            await pool.query(
              `INSERT INTO country_wishlist (user_id, country_code, country_name, interest_level, specific_cities)
               VALUES ($1, $2, $3, $4, $5)`,
              [userId, wish.code, wish.name, wish.interest, wish.cities]
            );
          }
        }
      }
      console.log(`   + ${user.username}: ${user.wishlist.length} wishlist items`);
    }

    // Create friendships
    console.log('\n👥 Creating friendships...');
    const createdFriendships = new Set();
    
    for (const user of TEST_USERS) {
      const userId = userIds[user.username];
      if (!userId && !isDryRun) continue;
      
      for (const friendUsername of user.friendsWith || []) {
        const friendId = userIds[friendUsername];
        if (!friendId && !isDryRun) continue;
        
        // Create unique key for friendship (sorted to avoid duplicates)
        const key = [user.username, friendUsername].sort().join('|');
        
        if (!createdFriendships.has(key)) {
          createdFriendships.add(key);
          
          if (!isDryRun) {
            const [id1, id2] = [userId, friendId].sort();
            
            const existing = await pool.query(
              'SELECT id FROM friendships WHERE user_id_1 = $1 AND user_id_2 = $2',
              [id1, id2]
            );
            
            if (existing.rows.length === 0) {
              await pool.query(
                `INSERT INTO friendships (user_id_1, user_id_2, status, requested_by, accepted_at)
                 VALUES ($1, $2, 'accepted', $1, NOW())`,
                [id1, id2]
              );
              console.log(`   + ${user.username} ↔ ${friendUsername}`);
            }
          } else {
            console.log(`   + ${user.username} ↔ ${friendUsername}`);
          }
        }
      }
    }

    // Summary
    const totalCountries = TEST_USERS.reduce((sum, u) => sum + u.countries.length, 0);
    const totalCities = TEST_USERS.reduce((sum, u) => 
      sum + u.countries.reduce((s, c) => s + c.cities.length, 0), 0);
    const totalWishlist = TEST_USERS.reduce((sum, u) => sum + u.wishlist.length, 0);
    
    console.log('\n✅ Seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${TEST_USERS.length}`);
    console.log(`   Countries visited: ${totalCountries}`);
    console.log(`   Cities visited: ${totalCities}`);
    console.log(`   Wishlist items: ${totalWishlist}`);
    console.log(`   Friendships: ${createdFriendships.size}`);
    console.log(`\n🔑 All test users use password: ${TEST_PASSWORD}\n`);
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seed();
}

module.exports = { seed, TEST_USERS, TEST_PASSWORD, TEST_EMAIL_DOMAIN };

