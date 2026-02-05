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

## Commit Messages

```
git commit -m "Phase 1.5 Step 1: Google OAuth backend setup"
git commit -m "Phase 1.5 Step 2: Google OAuth frontend and callback"
git commit -m "Phase 1.5 Step 3: Country list component with continent grouping"
git commit -m "Phase 1.5 Step 4: Integrate country list into My Travels and Wishlist"
git commit -m "Phase 1.5 Complete: Google OAuth and enhanced country selector"
```

