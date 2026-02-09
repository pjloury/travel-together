# Travel Together - Phase 1.5 Specification

UX enhancements to improve the core experience before adding Phase 2 features.

---

## Prerequisites

- Phase 1 complete and deployed
- Production URLs working

---

## 1. Google Sign-In (OAuth)

### Goal
Allow users to sign in with their Google account for persistent, seamless authentication.

### Benefits
- No password to remember
- Stays signed in across sessions
- Faster onboarding
- More secure (Google handles auth)

### Backend Changes

#### New Dependencies
```bash
cd server && npm install passport passport-google-oauth20
```

#### Database Schema
```sql
-- server/db/schema/007_oauth.sql
ALTER TABLE users 
  ADD COLUMN google_id VARCHAR(255) UNIQUE,
  ADD COLUMN avatar_url TEXT,
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX idx_users_google_id ON users(google_id);
```

#### New Environment Variables
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://travel-together-jsgy.onrender.com/api/auth/google/callback
```

#### New Endpoints
```
GET  /api/auth/google          - Initiates Google OAuth flow
GET  /api/auth/google/callback - Handles Google callback, creates/finds user, returns JWT
POST /api/auth/link-google     - Links Google account to existing email/password user
```

#### Auth Flow
```
1. User clicks "Continue with Google"
2. Frontend redirects to: /api/auth/google
3. Backend redirects to Google consent screen
4. User approves
5. Google redirects to: /api/auth/google/callback?code=...
6. Backend exchanges code for user info
7. Backend finds/creates user, generates JWT
8. Backend redirects to: {FRONTEND_URL}/auth/callback?token=...
9. Frontend stores JWT, redirects to dashboard
```

#### Implementation: `server/routes/auth.js` additions
```javascript
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Find or create user
      let user = await db.query(
        'SELECT * FROM users WHERE google_id = $1',
        [profile.id]
      );
      
      if (user.rows.length === 0) {
        // Check if email exists (link accounts)
        const email = profile.emails[0].value;
        user = await db.query(
          'SELECT * FROM users WHERE email = $1',
          [email]
        );
        
        if (user.rows.length > 0) {
          // Link Google to existing account
          await db.query(
            'UPDATE users SET google_id = $1, avatar_url = $2 WHERE id = $3',
            [profile.id, profile.photos[0]?.value, user.rows[0].id]
          );
        } else {
          // Create new user
          user = await db.query(
            `INSERT INTO users (email, username, display_name, google_id, avatar_url)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [email, email.split('@')[0], profile.displayName, profile.id, profile.photos[0]?.value]
          );
        }
      }
      
      done(null, user.rows[0]);
    } catch (error) {
      done(error, null);
    }
  }
));

// GET /api/auth/google
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false 
}));

// GET /api/auth/google/callback
router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }  // Longer expiry for OAuth users
    );
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);
```

### Frontend Changes

#### New Page: `src/pages/AuthCallback.jsx`
```jsx
// Handles OAuth redirect, stores token, redirects to dashboard
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      navigate('/');
    } else {
      navigate('/login');
    }
  }, []);

  return <div className="loading">Signing you in...</div>;
}
```

#### Update Login Page
Add "Continue with Google" button:
```jsx
<button 
  type="button" 
  className="google-btn"
  onClick={() => window.location.href = `${API_BASE}/auth/google`}
>
  <GoogleIcon /> Continue with Google
</button>
```

### Google Cloud Console Setup
1. Go to https://console.cloud.google.com
2. Create new project or select existing
3. Enable "Google+ API" and "Google Identity"
4. Go to Credentials → Create OAuth Client ID
5. Application type: Web application
6. Authorized redirect URIs: 
   - `https://travel-together-jsgy.onrender.com/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback` (for dev)
7. Copy Client ID and Client Secret

### Verify
```
1. Click "Continue with Google" on login page
2. Select Google account
3. Approve permissions
4. Redirected to dashboard, logged in
5. Refresh page - still logged in
6. Check profile - shows Google avatar
```

---

## 2. Enhanced Country Selector

### Goal
Replace autocomplete dropdown with a full, scrollable list of countries organized by continent.

### Design
```
┌─────────────────────────────────────────────┐
│ 🔍 Filter countries...                      │
├─────────────────────────────────────────────┤
│                                             │
│ 🌍 AFRICA                                   │
│   □ Algeria                                 │
│   □ Angola                                  │
│   □ Benin                                   │
│   ...                                       │
│                                             │
│ 🌎 AMERICAS                                 │
│   □ Argentina                               │
│   □ Bolivia                                 │
│   □ Brazil                                  │
│   ...                                       │
│                                             │
│ 🌏 ASIA                                     │
│   ✓ Japan (already added)                   │
│   □ South Korea                             │
│   □ Thailand                                │
│   ...                                       │
│                                             │
│ 🌍 EUROPE                                   │
│   □ France                                  │
│   □ Germany                                 │
│   ✓ Italy (already added)                   │
│   ...                                       │
│                                             │
│ 🌏 OCEANIA                                  │
│   □ Australia                               │
│   □ Fiji                                    │
│   □ New Zealand                             │
│   ...                                       │
│                                             │
└─────────────────────────────────────────────┘
```

### Features
- Full list always visible (scrollable container)
- Grouped by continent with headers
- Alphabetized within each continent
- Filter input at top (filters across all continents)
- Checkmarks on already-added countries
- Click to add/select
- Smooth scroll to continent on header click

### Data Source
REST Countries API provides continent data:
```javascript
// Fetch and organize countries
const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,region');
const countries = await response.json();

// Group by continent (region field)
const byContinent = countries.reduce((acc, country) => {
  const continent = country.region || 'Other';
  if (!acc[continent]) acc[continent] = [];
  acc[continent].push({
    code: country.cca2,
    name: country.name.common
  });
  return acc;
}, {});

// Sort each continent alphabetically
Object.keys(byContinent).forEach(continent => {
  byContinent[continent].sort((a, b) => a.name.localeCompare(b.name));
});
```

### Continent Order
1. Africa
2. Americas
3. Asia
4. Europe
5. Oceania
6. Antarctic (optional, few countries)

### Component: `src/components/CountryList.jsx`
```jsx
import { useState, useEffect, useMemo } from 'react';

const CONTINENT_ORDER = ['Africa', 'Americas', 'Asia', 'Europe', 'Oceania'];
const CONTINENT_EMOJI = {
  'Africa': '🌍',
  'Americas': '🌎',
  'Asia': '🌏',
  'Europe': '🌍',
  'Oceania': '🌏'
};

export default function CountryList({ onSelect, selectedCountries = [], mode = 'single' }) {
  const [countries, setCountries] = useState({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCountries();
  }, []);

  async function fetchCountries() {
    const cached = localStorage.getItem('countriesByContinent');
    if (cached) {
      setCountries(JSON.parse(cached));
      setLoading(false);
      return;
    }

    const response = await fetch('https://restcountries.com/v3.1/all?fields=name,cca2,region');
    const data = await response.json();
    
    const byContinent = {};
    data.forEach(country => {
      const continent = country.region || 'Other';
      if (!byContinent[continent]) byContinent[continent] = [];
      byContinent[continent].push({
        code: country.cca2,
        name: country.name.common
      });
    });

    Object.keys(byContinent).forEach(continent => {
      byContinent[continent].sort((a, b) => a.name.localeCompare(b.name));
    });

    localStorage.setItem('countriesByContinent', JSON.stringify(byContinent));
    setCountries(byContinent);
    setLoading(false);
  }

  const filteredCountries = useMemo(() => {
    if (!filter) return countries;
    
    const lower = filter.toLowerCase();
    const filtered = {};
    
    Object.entries(countries).forEach(([continent, list]) => {
      const matches = list.filter(c => c.name.toLowerCase().includes(lower));
      if (matches.length > 0) {
        filtered[continent] = matches;
      }
    });
    
    return filtered;
  }, [countries, filter]);

  function isSelected(code) {
    return selectedCountries.some(c => c.countryCode === code);
  }

  function handleSelect(country) {
    if (!isSelected(country.code)) {
      onSelect({ countryCode: country.code, countryName: country.name });
    }
  }

  if (loading) return <div className="loading-countries">Loading countries...</div>;

  return (
    <div className="country-list-container">
      <div className="country-filter">
        <input
          type="text"
          placeholder="🔍 Filter countries..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      
      <div className="country-list-scroll">
        {CONTINENT_ORDER.map(continent => {
          const list = filteredCountries[continent];
          if (!list || list.length === 0) return null;
          
          return (
            <div key={continent} className="continent-section">
              <h3 className="continent-header">
                {CONTINENT_EMOJI[continent]} {continent.toUpperCase()}
              </h3>
              <div className="country-grid">
                {list.map(country => (
                  <button
                    key={country.code}
                    className={`country-item ${isSelected(country.code) ? 'selected' : ''}`}
                    onClick={() => handleSelect(country)}
                    disabled={isSelected(country.code)}
                  >
                    <span className="country-flag">{getFlagEmoji(country.code)}</span>
                    <span className="country-name">{country.name}</span>
                    {isSelected(country.code) && <span className="check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getFlagEmoji(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}
```

### CSS
```css
.country-list-container {
  background: var(--bg-card);
  border-radius: 12px;
  overflow: hidden;
}

.country-filter {
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 16px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.country-filter input {
  width: 100%;
  padding: 12px 16px;
  background: var(--bg-dark);
  border: 2px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 16px;
}

.country-list-scroll {
  max-height: 500px;
  overflow-y: auto;
  padding: 16px;
}

.continent-section {
  margin-bottom: 24px;
}

.continent-header {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  letter-spacing: 1px;
}

.country-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}

.country-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  transition: all 0.15s;
}

.country-item:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--accent);
}

.country-item.selected {
  background: rgba(0, 212, 170, 0.1);
  border-color: var(--accent);
  cursor: default;
}

.country-item .country-flag {
  font-size: 20px;
}

.country-item .country-name {
  flex: 1;
  font-size: 14px;
}

.country-item .check {
  color: var(--accent);
  font-weight: bold;
}

.country-item:disabled {
  opacity: 0.7;
}
```

### Integration Points
- Replace `CountryAutocomplete` in:
  - `MyTravels.jsx` - for adding visited countries
  - `Wishlist.jsx` - for adding wishlist countries
- Can be used as modal or inline component

### Verify
```
1. Go to My Travels
2. See full country list organized by continent
3. Scroll through - see all countries
4. Type "jap" - list filters to show Japan
5. Clear filter - full list returns
6. Click Japan - adds to travels
7. Japan now shows checkmark, disabled
8. Add another country from different continent
```

---

## Build Steps

### Step 1: Google OAuth Backend
- [ ] Add database migration for google_id column
- [ ] Install passport and passport-google-oauth20
- [ ] Implement Google OAuth endpoints
- [ ] Test with Postman/curl

### Step 2: Google OAuth Frontend
- [ ] Create AuthCallback page
- [ ] Add Google button to Login/Register pages
- [ ] Add route for /auth/callback
- [ ] Test full flow

### Step 3: Google Cloud Setup
- [ ] Create OAuth credentials
- [ ] Add environment variables to Render
- [ ] Test in production

### Step 4: Country List Component
- [ ] Create CountryList component
- [ ] Add continent grouping logic
- [ ] Add filter functionality
- [ ] Style the component

### Step 5: Integration
- [ ] Replace CountryAutocomplete in MyTravels
- [ ] Replace CountryAutocomplete in Wishlist
- [ ] Test both pages

### Step 6: Polish
- [ ] Smooth scroll to continent headers
- [ ] Loading states
- [ ] Empty filter states
- [ ] Mobile responsiveness

---

## 3. Test Data Seeding & Simulation

### Goal
Create scripts to populate the app with realistic fake users and travel data for:
- Stress testing the social network features
- Demonstrating the app with rich, diverse data
- Testing edge cases in alignment algorithms
- QA and demo purposes

### Scripts Location
```
server/scripts/
├── seed.js           # Main seeding script
├── teardown.js       # Clean up all test data
├── testUsers.json    # User definitions
└── README.md         # Usage instructions
```

### Test User Personas (12 users)

| User | Display Name | Travel Style | Countries Visited | Wishlist |
|------|--------------|--------------|-------------------|----------|
| 1 | Alex Adventure | Backpacker | 25+ countries, Asia-heavy | South America |
| 2 | Bella Beach | Resort lover | Caribbean, Mediterranean | Maldives, Bali |
| 3 | Carlos Culture | History buff | Europe museums | Egypt, Peru, Japan |
| 4 | Diana Digital | Digital nomad | SE Asia, Portugal | Mexico, Colombia |
| 5 | Ethan Explorer | Off-beaten-path | Central Asia, Africa | Antarctica, Mongolia |
| 6 | Fiona Foodie | Culinary tourism | Italy, Japan, Thailand | Peru, India, Vietnam |
| 7 | George Golfer | Golf resorts | Scotland, USA, Spain | New Zealand, South Africa |
| 8 | Hannah Hiker | Trekking | Nepal, Peru, Switzerland | Patagonia, New Zealand |
| 9 | Ivan Islander | Island hopping | Indonesia, Philippines, Greece | Fiji, Seychelles |
| 10 | Julia Jetsetter | Luxury travel | France, UAE, Singapore | Monaco, St. Barts |
| 11 | Kevin Camper | Road trips | USA, Canada, Australia | Scandinavia, Iceland |
| 12 | Luna Local | Slow travel | Mexico, Spain, Vietnam | Portugal, Thailand |

### Friendship Network
```
       Alex ─── Bella ─── Carlos
        │         │         │
      Diana ─── Ethan ─── Fiona
        │         │         │
      George ── Hannah ─── Ivan
        │         │         │
      Julia ─── Kevin ─── Luna
        │                   │
        └───────────────────┘
```
- Each user has 3-4 friends
- Creates overlapping social circles
- Tests friend-of-friend scenarios (Phase 2)

### Edge Cases to Cover

| Edge Case | Test Setup |
|-----------|------------|
| No friends | User with 0 accepted friendships |
| No travel data | User with account but no countries/wishlist |
| Same country, different cities | Alex & Diana both visited Japan (Tokyo vs Osaka) |
| Mutual wishlist | Fiona & Carlos both want Peru |
| I've been, they want | Hannah visited Nepal, Ethan wants Nepal |
| They've been, I want | Carlos visited Egypt, Bella wants Egypt |
| Complete overlap | Two users with identical travel history |
| No overlap | Two friends with zero countries in common |
| High volume | Alex with 25+ countries tests performance |
| Pending requests | Unaccepted friend requests in queue |
| Long city lists | User with 10+ cities in one country |
| All continents | User who's visited all 6 continents |

### Seed Script: `server/scripts/seed.js`

```javascript
#!/usr/bin/env node
/**
 * Seed script for Travel Together
 * 
 * Usage:
 *   node scripts/seed.js              # Seed local database
 *   node scripts/seed.js --prod       # Seed production database
 *   node scripts/seed.js --dry-run    # Preview without inserting
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const TEST_USERS = [
  {
    email: 'alex@test.traveltogether.com',
    username: 'alex_adventure',
    displayName: 'Alex Adventure',
    password: 'TestPass123!',
    countries: [
      { code: 'JP', name: 'Japan', cities: ['Tokyo', 'Kyoto', 'Osaka'] },
      { code: 'TH', name: 'Thailand', cities: ['Bangkok', 'Chiang Mai'] },
      { code: 'VN', name: 'Vietnam', cities: ['Hanoi', 'Ho Chi Minh City'] },
      { code: 'KH', name: 'Cambodia', cities: ['Siem Reap'] },
      { code: 'ID', name: 'Indonesia', cities: ['Bali', 'Jakarta'] },
      { code: 'PH', name: 'Philippines', cities: ['Manila', 'Cebu'] },
      { code: 'MY', name: 'Malaysia', cities: ['Kuala Lumpur'] },
      { code: 'SG', name: 'Singapore', cities: ['Singapore'] },
      { code: 'KR', name: 'South Korea', cities: ['Seoul', 'Busan'] },
      { code: 'TW', name: 'Taiwan', cities: ['Taipei'] },
      // ... more countries
    ],
    wishlist: [
      { code: 'PE', name: 'Peru', interest: 5, cities: ['Lima', 'Cusco', 'Machu Picchu'] },
      { code: 'AR', name: 'Argentina', interest: 4, cities: ['Buenos Aires', 'Patagonia'] },
      { code: 'CO', name: 'Colombia', interest: 4, cities: ['Bogota', 'Medellin'] },
    ],
    friendsWith: ['bella_beach', 'diana_digital', 'ethan_explorer']
  },
  {
    email: 'bella@test.traveltogether.com',
    username: 'bella_beach',
    displayName: 'Bella Beach',
    password: 'TestPass123!',
    countries: [
      { code: 'MX', name: 'Mexico', cities: ['Cancun', 'Playa del Carmen'] },
      { code: 'JM', name: 'Jamaica', cities: ['Montego Bay'] },
      { code: 'GR', name: 'Greece', cities: ['Santorini', 'Mykonos'] },
      { code: 'ES', name: 'Spain', cities: ['Barcelona', 'Ibiza'] },
      { code: 'IT', name: 'Italy', cities: ['Amalfi Coast', 'Capri'] },
    ],
    wishlist: [
      { code: 'MV', name: 'Maldives', interest: 5, cities: [] },
      { code: 'ID', name: 'Indonesia', interest: 5, cities: ['Bali'] },
      { code: 'EG', name: 'Egypt', interest: 3, cities: ['Cairo'] },
    ],
    friendsWith: ['alex_adventure', 'carlos_culture', 'ethan_explorer']
  },
  // ... 10 more users with similar structure
];

async function seed(options = {}) {
  const isProd = options.prod || process.argv.includes('--prod');
  const isDryRun = options.dryRun || process.argv.includes('--dry-run');
  
  const connectionString = isProd 
    ? process.env.DATABASE_URL 
    : process.env.DATABASE_URL_LOCAL || 'postgresql://localhost:5432/travel_together';
  
  console.log(`\n🌱 Seeding ${isProd ? 'PRODUCTION' : 'LOCAL'} database...`);
  if (isDryRun) console.log('(DRY RUN - no data will be inserted)\n');
  
  const pool = new Pool({ 
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : false
  });

  try {
    // Create users
    const userIds = {};
    for (const user of TEST_USERS) {
      console.log(`  Creating user: ${user.displayName}`);
      
      if (!isDryRun) {
        const hash = await bcrypt.hash(user.password, 10);
        const result = await pool.query(
          `INSERT INTO users (email, username, display_name, password_hash)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (email) DO UPDATE SET display_name = $3
           RETURNING id`,
          [user.email, user.username, user.displayName, hash]
        );
        userIds[user.username] = result.rows[0].id;
      }
    }

    // Add countries and cities
    for (const user of TEST_USERS) {
      const userId = userIds[user.username];
      
      for (const country of user.countries) {
        console.log(`    + ${user.username}: visited ${country.name}`);
        
        if (!isDryRun) {
          const countryResult = await pool.query(
            `INSERT INTO country_visits (user_id, country_code, country_name)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, country_code) DO NOTHING
             RETURNING id`,
            [userId, country.code, country.name]
          );
          
          if (countryResult.rows.length > 0) {
            for (const city of country.cities) {
              await pool.query(
                `INSERT INTO city_visits (user_id, country_visit_id, city_name)
                 VALUES ($1, $2, $3)`,
                [userId, countryResult.rows[0].id, city]
              );
            }
          }
        }
      }

      // Add wishlist
      for (const wish of user.wishlist) {
        console.log(`    ♡ ${user.username}: wants ${wish.name}`);
        
        if (!isDryRun) {
          await pool.query(
            `INSERT INTO country_wishlist (user_id, country_code, country_name, interest_level, specific_cities)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, country_code) DO NOTHING`,
            [userId, wish.code, wish.name, wish.interest, wish.cities]
          );
        }
      }
    }

    // Create friendships
    console.log('\n  Creating friendships...');
    for (const user of TEST_USERS) {
      const userId = userIds[user.username];
      
      for (const friendUsername of user.friendsWith || []) {
        const friendId = userIds[friendUsername];
        if (!friendId) continue;
        
        // Only create if this user's username comes first alphabetically (avoid duplicates)
        if (user.username < friendUsername) {
          console.log(`    👥 ${user.username} ↔ ${friendUsername}`);
          
          if (!isDryRun) {
            const [id1, id2] = [userId, friendId].sort();
            await pool.query(
              `INSERT INTO friendships (user_id_1, user_id_2, status, requested_by, accepted_at)
               VALUES ($1, $2, 'accepted', $1, NOW())
               ON CONFLICT (user_id_1, user_id_2) DO NOTHING`,
              [id1, id2]
            );
          }
        }
      }
    }

    console.log('\n✅ Seeding complete!\n');
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   Users created: ${TEST_USERS.length}`);
    console.log(`   Countries added: ${TEST_USERS.reduce((sum, u) => sum + u.countries.length, 0)}`);
    console.log(`   Wishlist items: ${TEST_USERS.reduce((sum, u) => sum + u.wishlist.length, 0)}`);
    console.log(`   Friendships: ${TEST_USERS.reduce((sum, u) => sum + (u.friendsWith?.length || 0), 0) / 2}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  seed();
}

module.exports = { seed, TEST_USERS };
```

### Teardown Script: `server/scripts/teardown.js`

```javascript
#!/usr/bin/env node
/**
 * Teardown script - removes all test data
 * 
 * Usage:
 *   node scripts/teardown.js              # Clean local database
 *   node scripts/teardown.js --prod       # Clean production (requires confirmation)
 *   node scripts/teardown.js --all        # Remove ALL data (not just test users)
 */

require('dotenv').config();
const { Pool } = require('pg');
const readline = require('readline');

const TEST_EMAIL_DOMAIN = 'test.traveltogether.com';

async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(`${message} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

async function teardown(options = {}) {
  const isProd = options.prod || process.argv.includes('--prod');
  const removeAll = options.all || process.argv.includes('--all');
  
  if (isProd) {
    console.log('\n⚠️  WARNING: You are about to modify PRODUCTION database!\n');
    const confirmed = await confirm('Are you absolutely sure?');
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }
  
  const connectionString = isProd 
    ? process.env.DATABASE_URL 
    : process.env.DATABASE_URL_LOCAL || 'postgresql://localhost:5432/travel_together';
  
  console.log(`\n🧹 Cleaning ${isProd ? 'PRODUCTION' : 'LOCAL'} database...`);
  
  const pool = new Pool({ 
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : false
  });

  try {
    if (removeAll) {
      console.log('  Removing ALL data...');
      
      await pool.query('DELETE FROM city_visits');
      await pool.query('DELETE FROM country_visits');
      await pool.query('DELETE FROM country_wishlist');
      await pool.query('DELETE FROM friendships');
      await pool.query('DELETE FROM password_reset_tokens');
      await pool.query('DELETE FROM users');
      
      console.log('  ✓ All tables cleared');
    } else {
      console.log(`  Removing test users (${TEST_EMAIL_DOMAIN})...`);
      
      // Get test user IDs
      const testUsers = await pool.query(
        'SELECT id FROM users WHERE email LIKE $1',
        [`%@${TEST_EMAIL_DOMAIN}`]
      );
      
      const testUserIds = testUsers.rows.map(r => r.id);
      
      if (testUserIds.length === 0) {
        console.log('  No test users found.');
      } else {
        // Delete in order (foreign keys)
        await pool.query(
          'DELETE FROM city_visits WHERE user_id = ANY($1)',
          [testUserIds]
        );
        await pool.query(
          'DELETE FROM country_visits WHERE user_id = ANY($1)',
          [testUserIds]
        );
        await pool.query(
          'DELETE FROM country_wishlist WHERE user_id = ANY($1)',
          [testUserIds]
        );
        await pool.query(
          'DELETE FROM friendships WHERE user_id_1 = ANY($1) OR user_id_2 = ANY($1)',
          [testUserIds]
        );
        await pool.query(
          'DELETE FROM password_reset_tokens WHERE user_id = ANY($1)',
          [testUserIds]
        );
        await pool.query(
          'DELETE FROM users WHERE id = ANY($1)',
          [testUserIds]
        );
        
        console.log(`  ✓ Removed ${testUserIds.length} test users and their data`);
      }
    }

    console.log('\n✅ Teardown complete!\n');
    
  } catch (error) {
    console.error('❌ Teardown failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  teardown();
}

module.exports = { teardown };
```

### NPM Scripts

Add to `server/package.json`:
```json
{
  "scripts": {
    "seed": "node scripts/seed.js",
    "seed:prod": "node scripts/seed.js --prod",
    "seed:dry": "node scripts/seed.js --dry-run",
    "teardown": "node scripts/teardown.js",
    "teardown:prod": "node scripts/teardown.js --prod",
    "teardown:all": "node scripts/teardown.js --all"
  }
}
```

### Usage

```bash
# Local development
cd server
npm run seed              # Populate with test data
npm run teardown          # Remove test data only
npm run teardown:all      # Remove ALL data

# Production (use with caution!)
npm run seed:prod         # Populate production with test data
npm run teardown:prod     # Remove test data from production

# Preview what would be seeded
npm run seed:dry
```

### Test User Login Credentials

All test users use the same password for easy testing:

| Username | Email | Password |
|----------|-------|----------|
| alex_adventure | alex@test.traveltogether.com | TestPass123! |
| bella_beach | bella@test.traveltogether.com | TestPass123! |
| carlos_culture | carlos@test.traveltogether.com | TestPass123! |
| diana_digital | diana@test.traveltogether.com | TestPass123! |
| ethan_explorer | ethan@test.traveltogether.com | TestPass123! |
| fiona_foodie | fiona@test.traveltogether.com | TestPass123! |
| george_golfer | george@test.traveltogether.com | TestPass123! |
| hannah_hiker | hannah@test.traveltogether.com | TestPass123! |
| ivan_islander | ivan@test.traveltogether.com | TestPass123! |
| julia_jetsetter | julia@test.traveltogether.com | TestPass123! |
| kevin_camper | kevin@test.traveltogether.com | TestPass123! |
| luna_local | luna@test.traveltogether.com | TestPass123! |

### Verify Seed Works

```bash
# After seeding, test:
npm run seed

# Login as Alex
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alex@test.traveltogether.com","password":"TestPass123!"}'

# Check Alex's friends
curl http://localhost:3000/api/friends \
  -H "Authorization: Bearer $TOKEN"

# Check Alex's alignment
curl http://localhost:3000/api/alignment/help-me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Build Steps (Updated)

### Step 1-6: Google OAuth & Country List
(as defined above)

### Step 7: Seed Scripts
- [ ] Create `server/scripts/` directory
- [ ] Implement `seed.js` with all 12 test users
- [ ] Implement `teardown.js` with safety checks
- [ ] Add npm scripts to package.json
- [ ] Test locally
- [ ] Document in README

### Step 8: Production Seeding
- [ ] Run seed on production
- [ ] Verify all test users can login
- [ ] Verify friendships work
- [ ] Verify alignment shows data
- [ ] Screenshot for demo purposes

---

## Commit Messages

```
git commit -m "Phase 1.5 Step 1: Google OAuth backend setup"
git commit -m "Phase 1.5 Step 2: Google OAuth frontend and callback"
git commit -m "Phase 1.5 Step 3: Country list component with continent grouping"
git commit -m "Phase 1.5 Step 4: Integrate country list into My Travels and Wishlist"
git commit -m "Phase 1.5 Step 5: Test data seeding and teardown scripts"
git commit -m "Phase 1.5 Complete: Google OAuth, enhanced country selector, and test data"
```

