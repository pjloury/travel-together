# Travel Together - App Specification (Phase 1)

## Instructions

Break this spec down into basic components that can be run, verified, and committed to git incrementally. Cut scope to keep things simple. Always choose the vanilla version—reduce internal dependencies that could cause conflicts.

---

## 1. Project Overview

**Name**: Travel Together  
**Tagline**: Explore with Friends

**Core Concept**: Help friends discover places they both want to visit and track their travel history.

---

## 2. User Persona

### Tommy Traveler
- **Age Range**: 27-36 years old
- **Characteristics**: Well-traveled, interested in discovering new travel experiences with friends, has vacation flexibility and can travel anywhere for 7-10 days

### Tommy's Goals
1. Create a goal board for places he's interested in visiting
2. Keep track of which friends he's interested in traveling with
3. Discover which friends have similar interests in experiences and locations
4. See a list of places he's been and articulate the types of travel he's enjoyed

### Tommy's Pain Points
1. Misses his closest friends who are busy and live in other cities—wants to reconnect but struggles to figure out where, when, and what to do
2. Has been to most "obvious" places and wants to discover new experiences, perhaps ones his friends have done

---

## 3. Tech Stack (Vanilla)

### Frontend
- **Framework**: React
- **State**: Context API (built-in)
- **Routing**: React Router
- **Styling**: Plain CSS
- **API**: fetch (built-in)

### Backend
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT + bcrypt

### External APIs
- REST Countries API (country validation)
- Google Maps Places Autocomplete (city input)

---

## 3. Data Models (Phase 1 Only)

### User
```
id: string (uuid)
email: string (unique)
username: string (unique)
displayName: string
passwordHash: string
createdAt: timestamp
```

### Friendship
```
id: string (uuid)
userId1: string (FK → User)
userId2: string (FK → User)
status: enum (pending, accepted)
requestedBy: string (userId)
createdAt: timestamp
acceptedAt: timestamp (nullable)
```

### CountryVisit
```
id: string (uuid)
userId: string (FK → User)
countryCode: string (ISO 3166-1 alpha-2)
countryName: string
createdAt: timestamp

UNIQUE(userId, countryCode)
```

### CityVisit
```
id: string (uuid)
userId: string (FK → User)
countryVisitId: string (FK → CountryVisit)
cityName: string
placeId: string (Google Places ID)
createdAt: timestamp
```

### CountryWishlist
```
id: string (uuid)
userId: string (FK → User)
countryCode: string (ISO 3166-1 alpha-2)
countryName: string
interestLevel: integer (1-5)
specificCities: array of strings (optional - cities you're most interested in)
createdAt: timestamp

UNIQUE(userId, countryCode)
```

**Note on City-Country Relationship:**
- A city visit counts as a country visit for alignment purposes
- A city interest counts as a country interest for alignment purposes
- When Bob visits Rome, he can give advice about Italy
- When Alice wants to visit Rome, she matches with anyone who wants Italy

---

## 4. API Endpoints

All endpoints return: `{ success: boolean, data?: any, error?: string }`

### Auth
```
POST /api/auth/register       - Create account
POST /api/auth/login          - Get JWT token
GET  /api/auth/me             - Get current user (protected)
PUT  /api/auth/me             - Update profile (displayName) (protected)
POST /api/auth/forgot-password - Request password reset email
POST /api/auth/reset-password  - Reset password with token
```

### Countries Visited
```
GET    /api/countries              - List my visited countries
POST   /api/countries              - Add country to visited
DELETE /api/countries/:countryCode - Remove country
```

### Cities Visited
```
GET    /api/countries/:countryCode/cities     - List cities in country
POST   /api/countries/:countryCode/cities     - Add city
DELETE /api/cities/:cityId                    - Remove city
```

### Wishlist
```
GET    /api/wishlist              - List my wishlist with friend annotations
POST   /api/wishlist              - Add country to wishlist (optionally with specific cities)
PUT    /api/wishlist/:countryCode - Update interest level or specific cities
DELETE /api/wishlist/:countryCode - Remove from wishlist
```

Request for `POST /api/wishlist`:
```json
{
  "countryCode": "IT",
  "countryName": "Italy",
  "interestLevel": 5,
  "specificCities": ["Rome", "Amalfi Coast"]  // optional
}
```

Response for `GET /api/wishlist` (includes city-level detail):
```json
{
  "success": true,
  "data": [
    {
      "countryCode": "IT",
      "countryName": "Italy",
      "interestLevel": 5,
      "specificCities": ["Rome", "Amalfi Coast"],
      "friendsWhoHaveBeen": [
        { 
          "id": "...", 
          "displayName": "Alice",
          "citiesVisited": ["Rome", "Venice"]  // Alice has been to Rome!
        }
      ],
      "friendsWhoAlsoWant": [
        { 
          "id": "...", 
          "displayName": "Bob", 
          "interestLevel": 4,
          "specificCities": ["Rome", "Florence"]  // Bob also wants Rome!
        }
      ]
    }
  ]
}
```

### Friends
```
GET    /api/friends                    - List my friends
POST   /api/friends/request            - Send friend request
POST   /api/friends/accept/:friendshipId - Accept request
DELETE /api/friends/:friendshipId      - Remove friend / decline request
GET    /api/friends/pending            - List pending requests
```

### Users & Profiles
```
GET /api/users/search?q=        - Search users by username/email
GET /api/users/:userId/profile  - View user profile (respects privacy)
```

### Alignment (Three Views)

**City-Country Roll-up**: City visits/interests roll up to country level for matching, but we show city detail in results.

```
GET /api/alignment/i-can-help      - Places I've BEEN that friends WANT to go
GET /api/alignment/help-me         - Places I WANT that friends have BEEN  
GET /api/alignment/lets-go         - Places I WANT that friends also WANT
```

**1. Places I've been → Friends want to go** (I can give advice)
```json
GET /api/alignment/i-can-help
{
  "success": true,
  "data": [
    {
      "countryCode": "IT",
      "countryName": "Italy",
      "myCitiesVisited": ["Rome", "Florence"],
      "friendsWhoWant": [
        { 
          "id": "...", 
          "displayName": "Bob", 
          "interestLevel": 5,
          "specificCities": ["Rome"]  // Bob specifically wants Rome - I've been!
        },
        { 
          "id": "...", 
          "displayName": "Alice", 
          "interestLevel": 3,
          "specificCities": []  // Alice wants Italy generally
        }
      ]
    }
  ]
}
```

**2. Places I want → Friends have been** (They can give me advice)
```json
GET /api/alignment/help-me
{
  "success": true,
  "data": [
    {
      "countryCode": "IT",
      "countryName": "Italy",
      "myInterestLevel": 5,
      "mySpecificCities": ["Rome", "Amalfi Coast"],
      "friendsWhoHaveBeen": [
        { 
          "id": "...", 
          "displayName": "Charlie",
          "citiesVisited": ["Rome", "Venice"]  // Charlie's been to Rome - ask him!
        },
        {
          "id": "...",
          "displayName": "Dana",
          "citiesVisited": ["Milan"]  // Dana's been to Italy but different city
        }
      ]
    }
  ]
}
```

**3. Places I want → Friends also want** (Let's plan together!)
```json
GET /api/alignment/lets-go
{
  "success": true,
  "data": [
    {
      "countryCode": "IT",
      "countryName": "Italy",
      "myInterestLevel": 5,
      "mySpecificCities": ["Rome"],
      "friendsWhoAlsoWant": [
        { 
          "id": "...", 
          "displayName": "Bob", 
          "interestLevel": 5,
          "specificCities": ["Rome"]  // Bob also wants Rome! Perfect match!
        },
        { 
          "id": "...", 
          "displayName": "Alice", 
          "interestLevel": 4,
          "specificCities": ["Florence"]  // Alice wants Florence, still Italy
        }
      ]
    }
  ]
}
```

**Note**: `GET /api/alignment/:friendId` (overlap with specific friend) moved to Phase 2.

### Country Detail
```
GET /api/countries/:countryCode/detail - Country info with your visits, friends who've been
```

---

## 5. Build Steps (Incremental Commits)

### Workflow for Each Step

```
1. Read the step requirements
2. Implement the code
3. Run ALL verifications listed
4. Fix any issues until all verifications pass
5. Stage changes: git add .
6. Commit with message: git commit -m "Step X: [description]"
7. Move to next step
```

**Rules:**
- Do NOT move to the next step until all verifications pass
- Each commit should leave the app in a working state
- If a step breaks something from a previous step, fix it before committing

---

### Step 1: Project Setup

**Tasks:**
- [ ] Create `server/` directory
- [ ] Run `npm init -y` in server/
- [ ] Install: `npm install express pg jsonwebtoken bcrypt dotenv cors`
- [ ] Create `server/index.js` with basic Express server
- [ ] Add `GET /health` endpoint that returns `{ status: "ok" }`
- [ ] Create `.env.example` with DATABASE_URL, JWT_SECRET
- [ ] Create `.gitignore` (node_modules, .env)

**Verify:**
```bash
# Start the server
cd server && npm start

# In another terminal, test health endpoint
curl http://localhost:3000/health
# Expected: {"status":"ok"}
```

**Commit:** `git commit -m "Step 1: Project setup with Express server and health check"`

---

### Step 2: Database Setup

**Tasks:**
- [ ] Create PostgreSQL database: `createdb travel_together`
- [ ] Create `server/db/index.js` with pg Pool connection
- [ ] Create `server/db/schema/001_users.sql`:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Log "Connected to database" on successful connection

**Verify:**
```bash
# Create the users table
psql travel_together < server/db/schema/001_users.sql

# Start server
npm start
# Expected in console: "Connected to database"

# Verify table exists
psql travel_together -c "\d users"
# Expected: Shows users table schema
```

**Commit:** `git commit -m "Step 2: Database setup with users table"`

---

### Step 3: User Registration

**Tasks:**
- [ ] Create `server/routes/auth.js`
- [ ] Add `POST /api/auth/register` endpoint
- [ ] Validate: email, username, password (min 8 chars), displayName required
- [ ] Hash password with bcrypt (salt rounds: 10)
- [ ] Insert user, return user object (without passwordHash)
- [ ] Handle duplicate email/username (return 409)

**Verify:**
```bash
# Register a new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123","displayName":"Test User"}'
# Expected: {"success":true,"data":{"id":"...","email":"test@example.com","username":"testuser","displayName":"Test User"}}

# Try duplicate email
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser2","password":"password123","displayName":"Test User 2"}'
# Expected: {"success":false,"error":"Email already exists"} with status 409

# Try short password
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test2@example.com","username":"testuser2","password":"short","displayName":"Test"}'
# Expected: {"success":false,"error":"Password must be at least 8 characters"} with status 400
```

**Commit:** `git commit -m "Step 3: User registration endpoint with validation"`

---

### Step 4: User Login

**Tasks:**
- [ ] Add `POST /api/auth/login` endpoint
- [ ] Accept email and password
- [ ] Verify password with bcrypt.compare()
- [ ] Generate JWT with user id, expires in 7 days
- [ ] Return token on success
- [ ] Return 401 on invalid credentials

**Verify:**
```bash
# Login with valid credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: {"success":true,"data":{"token":"eyJ..."}}
# Save this token for next steps!

# Login with wrong password
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrongpassword"}'
# Expected: {"success":false,"error":"Invalid credentials"} with status 401

# Login with non-existent email
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com","password":"password123"}'
# Expected: {"success":false,"error":"Invalid credentials"} with status 401
```

**Commit:** `git commit -m "Step 4: User login endpoint with JWT generation"`

---

### Step 5: Auth Middleware

**Tasks:**
- [ ] Create `server/middleware/auth.js`
- [ ] Extract token from `Authorization: Bearer <token>` header
- [ ] Verify JWT and attach user to request
- [ ] Return 401 if no token or invalid token
- [ ] Add `GET /api/auth/me` protected endpoint
- [ ] Returns current user's profile

**Verify:**
```bash
# Set your token from Step 4
TOKEN="your-jwt-token-here"

# Access protected route with valid token
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":{"id":"...","email":"test@example.com",...}}

# Access without token
curl http://localhost:3000/api/auth/me
# Expected: {"success":false,"error":"No token provided"} with status 401

# Access with invalid token
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer invalidtoken123"
# Expected: {"success":false,"error":"Invalid token"} with status 401
```

**Commit:** `git commit -m "Step 5: Auth middleware and /me endpoint"`

---

### Step 6: Countries Visited - Schema

**Tasks:**
- [ ] Create `server/db/schema/002_country_visits.sql`:
  ```sql
  CREATE TABLE country_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, country_code)
  );
  CREATE INDEX idx_country_visits_user ON country_visits(user_id);
  ```

**Verify:**
```bash
# Create the country_visits table
psql travel_together < server/db/schema/002_country_visits.sql

# Verify table exists with correct schema
psql travel_together -c "\d country_visits"
# Expected: Shows table with user_id FK, unique constraint

# Verify unique constraint works
psql travel_together -c "INSERT INTO country_visits (user_id, country_code, country_name) VALUES ('some-uuid', 'US', 'United States');"
psql travel_together -c "INSERT INTO country_visits (user_id, country_code, country_name) VALUES ('some-uuid', 'US', 'United States');"
# Expected: Second insert fails with unique constraint violation
```

**Commit:** `git commit -m "Step 6: Country visits table"`

---

### Step 7: Countries Visited - CRUD

**Tasks:**
- [ ] Create `server/routes/countries.js`
- [ ] `GET /api/countries` - list user's visited countries
- [ ] `POST /api/countries` - add country (body: countryCode, countryName)
- [ ] Validate country code against REST Countries API
- [ ] `DELETE /api/countries/:countryCode` - remove country
- [ ] All routes protected by auth middleware

**Verify:**
```bash
TOKEN="your-jwt-token"

# Add a valid country
curl -X POST http://localhost:3000/api/countries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"JP","countryName":"Japan"}'
# Expected: {"success":true,"data":{"id":"...","countryCode":"JP","countryName":"Japan"}}

# Add another country
curl -X POST http://localhost:3000/api/countries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"FR","countryName":"France"}'
# Expected: success

# Try adding duplicate
curl -X POST http://localhost:3000/api/countries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"JP","countryName":"Japan"}'
# Expected: {"success":false,"error":"Country already added"} with status 409

# Try invalid country code
curl -X POST http://localhost:3000/api/countries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"XX","countryName":"Fake Country"}'
# Expected: {"success":false,"error":"Invalid country code"} with status 400

# List countries
curl http://localhost:3000/api/countries \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":[{"countryCode":"JP",...},{"countryCode":"FR",...}]}

# Delete a country
curl -X DELETE http://localhost:3000/api/countries/FR \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true}

# Verify deletion
curl http://localhost:3000/api/countries \
  -H "Authorization: Bearer $TOKEN"
# Expected: Only JP remains
```

**Commit:** `git commit -m "Step 7: Countries visited CRUD endpoints"`

---

### Step 8: Cities Visited - Schema

**Tasks:**
- [ ] Create `server/db/schema/003_city_visits.sql`:
  ```sql
  CREATE TABLE city_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    country_visit_id UUID REFERENCES country_visits(id) ON DELETE CASCADE,
    city_name VARCHAR(200) NOT NULL,
    place_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX idx_city_visits_country ON city_visits(country_visit_id);
  ```

**Verify:**
```bash
# Create the city_visits table
psql travel_together < server/db/schema/003_city_visits.sql

# Verify cascade delete works
# (Add a test country and city, then delete the country - city should be gone)
psql travel_together -c "SELECT * FROM city_visits;"
# After deleting parent country_visit, associated cities should be gone
```

**Commit:** `git commit -m "Step 8: City visits table"`

---

### Step 9: Cities Visited - CRUD

**Tasks:**
- [ ] `GET /api/countries/:countryCode/cities` - list cities in country
- [ ] `POST /api/countries/:countryCode/cities` - add city (body: cityName, placeId optional)
- [ ] `DELETE /api/cities/:cityId` - remove city
- [ ] Verify user owns the country_visit before adding city

**Verify:**
```bash
TOKEN="your-jwt-token"

# Add a city to Japan (must have JP in countries first)
curl -X POST http://localhost:3000/api/countries/JP/cities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cityName":"Tokyo"}'
# Expected: {"success":true,"data":{"id":"...","cityName":"Tokyo"}}

# Add another city
curl -X POST http://localhost:3000/api/countries/JP/cities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cityName":"Kyoto"}'
# Expected: success

# List cities in Japan
curl http://localhost:3000/api/countries/JP/cities \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":[{"cityName":"Tokyo",...},{"cityName":"Kyoto",...}]}

# Try adding city to country user hasn't visited
curl -X POST http://localhost:3000/api/countries/DE/cities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cityName":"Berlin"}'
# Expected: {"success":false,"error":"Country not in your travel history"} with status 404

# Delete a city (use actual city ID from list)
curl -X DELETE http://localhost:3000/api/cities/CITY_ID_HERE \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true}

# Verify cascade: delete country and check cities are gone
curl -X DELETE http://localhost:3000/api/countries/JP \
  -H "Authorization: Bearer $TOKEN"
# Then verify cities table is empty for that country
```

**Commit:** `git commit -m "Step 9: Cities visited CRUD endpoints"`

---

### Step 10: Wishlist - Schema

**Tasks:**
- [ ] Create `server/db/schema/004_country_wishlist.sql`:
  ```sql
  CREATE TABLE country_wishlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    country_code CHAR(2) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    interest_level INTEGER NOT NULL CHECK (interest_level >= 1 AND interest_level <= 5),
    specific_cities TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, country_code)
  );
  CREATE INDEX idx_wishlist_user ON country_wishlist(user_id);
  ```

**Verify:**
```bash
# Create the country_wishlist table
psql travel_together < server/db/schema/004_country_wishlist.sql

# Test check constraint
psql travel_together -c "INSERT INTO country_wishlist (user_id, country_code, country_name, interest_level) VALUES (gen_random_uuid(), 'US', 'United States', 6);"
# Expected: ERROR - check constraint violation (6 > 5)

psql travel_together -c "INSERT INTO country_wishlist (user_id, country_code, country_name, interest_level) VALUES (gen_random_uuid(), 'US', 'United States', 0);"
# Expected: ERROR - check constraint violation (0 < 1)
```

**Commit:** `git commit -m "Step 10: Country wishlist table with interest level constraint"`

---

### Step 11: Wishlist - CRUD

**Tasks:**
- [ ] Create `server/routes/wishlist.js`
- [ ] `GET /api/wishlist` - list user's wishlist with friend annotations
- [ ] For each wishlist item, include:
  - `friendsWhoHaveBeen` - friends who have visited this country OR any city in it
  - `friendsWhoAlsoWant` - friends who also want to visit (country or city match)
  - Show `citiesVisited` for friends who've been
  - Show `specificCities` for friends who want
- [ ] `POST /api/wishlist` - add country with interest level and optional specificCities
- [ ] `PUT /api/wishlist/:countryCode` - update interest level or specificCities
- [ ] `DELETE /api/wishlist/:countryCode` - remove from wishlist
- [ ] Validate country code against REST Countries API

**Verify:**
```bash
TOKEN="your-jwt-token"

# Add to wishlist (country only)
curl -X POST http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"IT","countryName":"Italy","interestLevel":5}'
# Expected: {"success":true,"data":{"id":"...","countryCode":"IT","interestLevel":5,"specificCities":[]}}

# Add with specific cities
curl -X POST http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"countryCode":"JP","countryName":"Japan","interestLevel":4,"specificCities":["Tokyo","Kyoto"]}'
# Expected: {"success":true,"data":{"countryCode":"JP","interestLevel":4,"specificCities":["Tokyo","Kyoto"]}}

# List wishlist (shows city-level friend detail!)
curl http://localhost:3000/api/wishlist \
  -H "Authorization: Bearer $TOKEN"
# Expected: Friend annotations include city detail
# {
#   "countryCode":"IT",
#   "interestLevel":5,
#   "specificCities":["Rome"],
#   "friendsWhoHaveBeen":[{"displayName":"Alice","citiesVisited":["Rome","Venice"]}],
#   "friendsWhoAlsoWant":[{"displayName":"Bob","interestLevel":4,"specificCities":["Rome"]}]
# }

# Update to add specific cities
curl -X PUT http://localhost:3000/api/wishlist/IT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"specificCities":["Rome","Amalfi Coast"]}'
# Expected: {"success":true,"data":{"specificCities":["Rome","Amalfi Coast"]}}

# Remove from wishlist
curl -X DELETE http://localhost:3000/api/wishlist/IT \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true}
```

**Commit:** `git commit -m "Step 11: Wishlist CRUD with city-level friend annotations"`

---

### Step 12: Friendships - Schema

**Tasks:**
- [ ] Create `server/db/schema/005_friendships.sql`:
  ```sql
  CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_1 UUID REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    requested_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    accepted_at TIMESTAMP,
    UNIQUE(user_id_1, user_id_2)
  );
  CREATE INDEX idx_friendships_user1 ON friendships(user_id_1);
  CREATE INDEX idx_friendships_user2 ON friendships(user_id_2);
  ```

**Verify:**
```bash
# Create the friendships table
psql travel_together < server/db/schema/005_friendships.sql

# Verify table exists
psql travel_together -c "\d friendships"
# Expected: Shows table with status check constraint
```

**Commit:** `git commit -m "Step 12: Friendships table"`

---

### Step 13: Friend Requests

**Tasks:**
- [ ] Create `server/routes/friends.js`
- [ ] `POST /api/friends/request` - send friend request (body: userId)
- [ ] `GET /api/friends/pending` - list incoming pending requests
- [ ] Prevent: duplicate requests, self-requests
- [ ] Store with lower userId as user_id_1 for consistent querying

**Verify:**
```bash
# First, create a second user to befriend
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"friend@example.com","username":"frienduser","password":"password123","displayName":"Friend User"}'
# Save this user's ID

TOKEN="your-jwt-token"
FRIEND_ID="friend-user-id-here"

# Send friend request
curl -X POST http://localhost:3000/api/friends/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$FRIEND_ID\"}"
# Expected: {"success":true,"data":{"id":"...","status":"pending"}}

# Try duplicate request
curl -X POST http://localhost:3000/api/friends/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"$FRIEND_ID\"}"
# Expected: {"success":false,"error":"Friend request already exists"} with status 409

# Try self-request (use your own user ID)
curl -X POST http://localhost:3000/api/friends/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"YOUR_OWN_USER_ID"}'
# Expected: {"success":false,"error":"Cannot send friend request to yourself"} with status 400

# Login as friend and check pending requests
FRIEND_TOKEN="login-as-friend-get-token"
curl http://localhost:3000/api/friends/pending \
  -H "Authorization: Bearer $FRIEND_TOKEN"
# Expected: {"success":true,"data":[{"id":"...","requestedBy":"...","status":"pending"}]}
```

**Commit:** `git commit -m "Step 13: Friend request and pending endpoints"`

---

### Step 14: Friend Accept/Decline

**Tasks:**
- [ ] `POST /api/friends/accept/:friendshipId` - accept pending request
- [ ] `DELETE /api/friends/:friendshipId` - decline request or remove friend
- [ ] Only the recipient can accept (not the requester)
- [ ] Set status to 'accepted' and accepted_at timestamp

**Verify:**
```bash
FRIEND_TOKEN="friend-user-token"
FRIENDSHIP_ID="friendship-id-from-pending"

# Accept friend request (as the friend who received it)
curl -X POST http://localhost:3000/api/friends/accept/$FRIENDSHIP_ID \
  -H "Authorization: Bearer $FRIEND_TOKEN"
# Expected: {"success":true,"data":{"status":"accepted","acceptedAt":"..."}}

# Verify original user can't accept their own sent request
TOKEN="original-user-token"
# (Would need to create new pending request to test this)

# Remove/unfriend
curl -X DELETE http://localhost:3000/api/friends/$FRIENDSHIP_ID \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true}
```

**Commit:** `git commit -m "Step 14: Accept and decline friend request endpoints"`

---

### Step 15: Friends List

**Tasks:**
- [ ] `GET /api/friends` - list accepted friends only
- [ ] Include friend's displayName, username, total countries count
- [ ] Query both user_id_1 and user_id_2 to find all friendships

**Verify:**
```bash
TOKEN="your-jwt-token"

# First, ensure you have at least one accepted friend (re-create if needed from previous steps)

# Get friends list
curl http://localhost:3000/api/friends \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":[{"id":"...","displayName":"Friend User","username":"frienduser","totalCountries":0}]}

# Verify pending friends don't appear
# (Create another friend request but don't accept it, then check list again)
```

**Commit:** `git commit -m "Step 15: Friends list endpoint with profile info"`

---

### Step 16: User Search

**Tasks:**
- [ ] `GET /api/users/search?q=searchterm`
- [ ] Search by username OR email (case-insensitive)
- [ ] Use ILIKE for partial matching
- [ ] Return: id, username, displayName (never password)
- [ ] Don't return current user in results

**Verify:**
```bash
TOKEN="your-jwt-token"

# Search by partial username
curl "http://localhost:3000/api/users/search?q=friend" \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":[{"id":"...","username":"frienduser","displayName":"Friend User"}]}

# Search by email
curl "http://localhost:3000/api/users/search?q=friend@" \
  -H "Authorization: Bearer $TOKEN"
# Expected: Same user found

# Case insensitive
curl "http://localhost:3000/api/users/search?q=FRIEND" \
  -H "Authorization: Bearer $TOKEN"
# Expected: Same user found

# Verify current user not in results
curl "http://localhost:3000/api/users/search?q=test" \
  -H "Authorization: Bearer $TOKEN"
# Expected: Your own account should NOT appear

# Verify no password in response (check response has no passwordHash field)
```

**Commit:** `git commit -m "Step 16: User search endpoint"`

---

### Step 17: Profile Visibility

**Tasks:**
- [ ] `GET /api/users/:userId/profile`
- [ ] If viewing friend: return full profile (countries, cities, wishlist)
- [ ] If viewing non-friend: return only displayName, totalCountries
- [ ] If viewing self: return full profile

**Verify:**
```bash
TOKEN="your-jwt-token"
MY_ID="your-user-id"
FRIEND_ID="accepted-friend-id"
STRANGER_ID="user-who-is-not-friend"

# View own profile (full data)
curl http://localhost:3000/api/users/$MY_ID/profile \
  -H "Authorization: Bearer $TOKEN"
# Expected: Full profile with countries, cities, wishlist

# View friend's profile (full data)
curl http://localhost:3000/api/users/$FRIEND_ID/profile \
  -H "Authorization: Bearer $TOKEN"
# Expected: Full profile with countries, cities, wishlist

# View stranger's profile (limited data)
# First create another user who is NOT your friend
curl http://localhost:3000/api/users/$STRANGER_ID/profile \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":{"displayName":"...","totalCountries":0}}
# Should NOT include countries array or wishlist
```

**Commit:** `git commit -m "Step 17: Profile visibility with privacy enforcement"`

---

### Step 18: Travel Alignment (Three Views)

**Tasks:**
- [ ] Create `server/routes/alignment.js`
- [ ] `GET /api/alignment/i-can-help` - Places I've BEEN that friends WANT
- [ ] `GET /api/alignment/help-me` - Places I WANT that friends have BEEN
- [ ] `GET /api/alignment/lets-go` - Places I WANT that friends also WANT
- [ ] **City roll-up logic**: A city visit counts as a country visit for matching
- [ ] **City roll-up logic**: A city interest counts as a country interest for matching
- [ ] Include city-level detail in responses (which cities visited, which cities wanted)
- [ ] Sort each by number of friends, then alphabetically

**Note**: Friend-specific overlap (`GET /api/alignment/:friendId`) moved to Phase 2.

**Verify:**
```bash
TOKEN="your-jwt-token"

# Setup:
# You visited: Tokyo & Kyoto (Japan), Paris (France)
# You want: Italy (Rome, Amalfi), Greece
# Bob visited: Rome (Italy) | Bob wants: Tokyo (Japan), Greece
# Alice visited: Athens (Greece) | Alice wants: Osaka (Japan)

# 1. Places I've been that friends want (I can give advice)
curl http://localhost:3000/api/alignment/i-can-help \
  -H "Authorization: Bearer $TOKEN"
# Expected: Japan - show MY cities visited, and friends' specific interests
# {"success":true,"data":[
#   {
#     "countryCode":"JP",
#     "countryName":"Japan",
#     "myCitiesVisited":["Tokyo","Kyoto"],
#     "friendsWhoWant":[
#       {"displayName":"Bob","interestLevel":5,"specificCities":["Tokyo"]},
#       {"displayName":"Alice","interestLevel":3,"specificCities":["Osaka"]}
#     ]
#   }
# ]}
# Note: I've been to Tokyo, Bob specifically wants Tokyo - great match!

# 2. Places I want that friends have been (they can give me advice)
curl http://localhost:3000/api/alignment/help-me \
  -H "Authorization: Bearer $TOKEN"
# Expected: Italy and Greece - show which CITIES friends visited
# {"success":true,"data":[
#   {
#     "countryCode":"IT",
#     "countryName":"Italy",
#     "myInterestLevel":5,
#     "mySpecificCities":["Rome","Amalfi"],
#     "friendsWhoHaveBeen":[{"displayName":"Bob","citiesVisited":["Rome"]}]
#   },
#   {
#     "countryCode":"GR",
#     "countryName":"Greece",
#     "myInterestLevel":3,
#     "mySpecificCities":[],
#     "friendsWhoHaveBeen":[{"displayName":"Alice","citiesVisited":["Athens"]}]
#   }
# ]}
# Note: I want Rome, Bob's been to Rome - ask him!

# 3. Places I want that friends also want (let's plan together!)
curl http://localhost:3000/api/alignment/lets-go \
  -H "Authorization: Bearer $TOKEN"
# Expected: Greece - show friends' interest levels and specific cities
# {"success":true,"data":[
#   {
#     "countryCode":"GR",
#     "countryName":"Greece",
#     "myInterestLevel":3,
#     "mySpecificCities":[],
#     "friendsWhoAlsoWant":[{"displayName":"Bob","interestLevel":4,"specificCities":[]}]
#   }
# ]}
```

**Commit:** `git commit -m "Step 18: Travel alignment with city-level detail"`

---

### Step 19: Frontend Setup

**Tasks:**
- [ ] Create `client/` directory
- [ ] Initialize React app: `npm create vite@latest client -- --template react`
- [ ] Install: `npm install react-router-dom`
- [ ] Create folder structure: `src/pages/`, `src/components/`, `src/api/`
- [ ] Create `src/api/client.js` - fetch wrapper with auth header
- [ ] Add proxy config to connect to backend

**Verify:**
```bash
# Start frontend
cd client && npm run dev
# Should open browser to localhost:5173 (or similar)

# Verify API client can reach backend
# Add a test in browser console or create a test component that calls /health
# Expected: Should receive {"status":"ok"} from backend
```

**Commit:** `git commit -m "Step 19: Frontend setup with React and API client"`

---

### Step 20: Auth UI

**Tasks:**
- [ ] Create `src/pages/Login.jsx`
- [ ] Create `src/pages/Register.jsx`
- [ ] Create `src/context/AuthContext.jsx` - stores JWT in localStorage
- [ ] Create `src/components/ProtectedRoute.jsx`
- [ ] Add routes in App.jsx
- [ ] Redirect to login if not authenticated

**Verify:**
```
Manual browser testing:

1. Open app - should redirect to /login
2. Click "Register" link - goes to /register
3. Fill out registration form, submit
   - Should create account and redirect to dashboard (or login)
4. Logout (clear localStorage manually if no button yet)
5. Login with created credentials
   - Should store JWT and redirect to protected area
6. Refresh page - should stay logged in (JWT persisted)
7. Clear localStorage, refresh - should redirect to login
```

**Commit:** `git commit -m "Step 20: Auth UI with login, register, and protected routes"`

---

### Step 21: My Travels Page

**Tasks:**
- [ ] Create `src/pages/MyTravels.jsx`
- [ ] List countries visited (from API)
- [ ] Add country form with country name input
- [ ] Click country to expand and see cities
- [ ] Add city form within country
- [ ] Delete buttons for countries and cities

**Verify:**
```
Manual browser testing:

1. Navigate to My Travels page
2. Initially empty - shows "No countries yet"
3. Add a country (e.g., "Japan")
   - Country appears in list
4. Try adding same country again
   - Should show error "Already added"
5. Click country to expand
   - Shows cities list (empty) and add city form
6. Add a city (e.g., "Tokyo")
   - City appears under Japan
7. Delete the city
   - City disappears
8. Delete the country
   - Country and all cities disappear
9. Refresh page - data persists from API
```

**Commit:** `git commit -m "Step 21: My Travels page with country and city management"`

---

### Step 22: Wishlist Page

**Tasks:**
- [ ] Create `src/pages/Wishlist.jsx`
- [ ] List wishlist countries with interest level (stars or 1-5)
- [ ] Show specific cities if user added them
- [ ] For each country, show TWO types of friend info WITH city detail:
  - "Alice has been to Rome, Venice" → click to ask for advice
  - "Bob also wants to visit (Rome)" → click to plan together
- [ ] Add country form with interest level selector
- [ ] Optional: add specific cities field
- [ ] Edit interest level and cities inline
- [ ] Delete button to remove from wishlist

**Verify:**
```
Manual browser testing:

1. Navigate to Wishlist page
2. Initially empty
3. Add "Italy" with interest level 5, specific cities: "Rome, Amalfi"
   - Appears with 5 stars and "Rome, Amalfi Coast" tags
4. Add "Japan" with just interest level (no specific cities)
5. For Italy, if Alice has been to Rome:
   - See "Alice has been to Rome, Venice" (city detail!)
   - I want Rome, she's been to Rome - great match!
6. For Japan, if Bob also wants Tokyo:
   - See "Bob also wants to go (Tokyo)" (his specific interest)
7. Click friend name to go to their profile
8. Edit Italy to add "Florence" to specific cities
9. Delete Japan
10. Refresh - data persists
```

**Commit:** `git commit -m "Step 22: Wishlist page with city-level friend annotations"`

---

### Step 23: Friends Page

**Tasks:**
- [ ] Create `src/pages/Friends.jsx`
- [ ] Search bar that searches users
- [ ] Search results with "Add Friend" button
- [ ] Pending requests section with Accept/Decline buttons
- [ ] Friends list with Remove button

**Verify:**
```
Manual browser testing (need 2 browser windows/accounts):

1. User A: Search for User B by username
   - User B appears in results
2. User A: Click "Add Friend"
   - Button changes to "Request Sent"
3. User B: Go to Friends page
   - See pending request from User A
4. User B: Click "Accept"
   - Request moves to friends list
5. User A: Refresh - User B now in friends list
6. User A: Click "Remove" on User B
   - Friendship removed
7. Both users: Friend lists updated
```

**Commit:** `git commit -m "Step 23: Friends page with search, requests, and friend management"`

---

### Step 24: Profile Page

**Tasks:**
- [ ] Create `src/pages/Profile.jsx`
- [ ] Route: `/profile/:userId`
- [ ] Show displayName, total countries
- [ ] If friend or self: show countries list, cities, wishlist
- [ ] If not friend: show limited info with "Add Friend" button

**Verify:**
```
Manual browser testing:

1. View own profile
   - See full details: countries, cities, wishlist
2. View friend's profile
   - See their full details
3. View non-friend's profile
   - See only displayName and country count
   - See "Add Friend" button
4. Click "Add Friend" on non-friend
   - Sends request, button changes
```

**Commit:** `git commit -m "Step 24: Profile page with privacy-aware display"`

---

### Step 25: Alignment Page (Let's Travel)

**Tasks:**
- [ ] Create `src/pages/LetsTravel.jsx`
- [ ] Three sections showing different types of alignment with CITY detail:

**Section 1: "Let's Go Together!"** (places I want + friends also want)
- Countries from `/api/alignment/lets-go`
- Show my specific cities vs their specific cities
- Highlight city matches (both want Rome!)
- Call-to-action: Plan a trip!

**Section 2: "Get Advice"** (places I want + friends have been)
- Countries from `/api/alignment/help-me`
- Show which CITIES friends visited
- Highlight if friend visited a city I specifically want
- Call-to-action: Ask them about it!

**Section 3: "Share Your Experience"** (places I've been + friends want)
- Countries from `/api/alignment/i-can-help`
- Show MY cities visited
- Show which cities friends specifically want
- Highlight if I've been to a city they want
- Call-to-action: Share tips!

**Verify:**
```
Manual browser testing:

Setup:
- You visited: Tokyo, Kyoto (Japan), Paris (France)
- You want: Italy (Rome, Amalfi), Greece
- Bob visited: Rome (Italy) | Bob wants: Tokyo (Japan), Greece
- Alice visited: Athens (Greece) | Alice wants: Osaka (Japan)

1. Navigate to Let's Travel page

2. See "Let's Go Together!" section:
   - Greece shows "Bob also wants to go!"

3. See "Get Advice" section:
   - Italy shows "Bob has been to Rome" ← I want Rome, perfect!
   - Greece shows "Alice has been to Athens"

4. See "Share Your Experience" section:
   - Japan shows:
     - "You visited: Tokyo, Kyoto"
     - "Bob wants Tokyo" ← highlight, I've been there!
     - "Alice wants Osaka" ← different city

5. Click on any country → country detail page
6. Click on friend name → friend's profile
```

**Commit:** `git commit -m "Step 25: Let's Travel page with city-level alignment"`

---

### Step 26: Profile Editing & Settings

**Tasks:**
- [ ] Add `PUT /api/auth/me` endpoint to update displayName
- [ ] Create `src/pages/Settings.jsx`
- [ ] Form to edit displayName
- [ ] Save changes to backend
- [ ] Add Settings link to navigation

**Verify:**
```bash
TOKEN="your-jwt-token"

# Update display name
curl -X PUT http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"New Display Name"}'
# Expected: {"success":true,"data":{"displayName":"New Display Name"}}
```

```
Manual browser testing:
1. Go to Settings page
2. Change display name
3. Save - should update
4. View profile - name updated
```

**Commit:** `git commit -m "Step 26: Profile editing and settings page"`

---

### Step 27: Friends Who've Been (Wishlist Enhancement)

**Tasks:**
- [ ] Add `GET /api/wishlist/:countryCode/friends` endpoint
- [ ] Returns list of friends who have visited this country
- [ ] Update Wishlist page to show "X friends have been" indicator
- [ ] Click to see which friends

**Verify:**
```bash
TOKEN="your-jwt-token"

# Get friends who've been to Italy (assuming IT is in your wishlist)
curl http://localhost:3000/api/wishlist/IT/friends \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":[{"id":"...","displayName":"Friend User"}]}
```

```
Manual browser testing:
1. Add a country to wishlist that a friend has visited
2. See "2 friends have been" badge on that wishlist item
3. Click to see friend names
```

**Commit:** `git commit -m "Step 27: Show friends who've been to wishlist countries"`

---

### Step 28: Country Detail Page

**Tasks:**
- [ ] Add `GET /api/countries/:countryCode/detail` endpoint
- [ ] Returns: your visits (cities), friends who've been, wishlist status
- [ ] Create `src/pages/CountryDetail.jsx`
- [ ] Route: `/country/:countryCode`
- [ ] Show all info about your relationship with this country
- [ ] Link from My Travels, Wishlist, and alignment pages

**Verify:**
```bash
TOKEN="your-jwt-token"

# Get Japan detail
curl http://localhost:3000/api/countries/JP/detail \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"data":{"countryCode":"JP","countryName":"Japan","visited":true,"cities":[...],"onWishlist":false,"friendsVisited":[...]}}
```

```
Manual browser testing:
1. Click on a country in My Travels
   - Goes to country detail page
2. See your cities visited
3. See which friends have been
4. If on wishlist, see your interest level
5. Click friend name to go to their profile
```

**Commit:** `git commit -m "Step 28: Country detail page"`

---

### Step 29: Password Reset (Optional)

**Tasks:**
- [ ] Create `server/db/schema/006_password_reset.sql`:
  ```sql
  CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);
  ```
- [ ] Run: `psql travel_together < server/db/schema/006_password_reset.sql`
- [ ] Add `POST /api/auth/forgot-password` endpoint
- [ ] Generate reset token (crypto.randomBytes), store with 1-hour expiry
- [ ] For prototype: just log the reset link to console (no email service)
- [ ] Add `POST /api/auth/reset-password` endpoint
- [ ] Verify token not expired/used, update password, mark token used
- [ ] Create `src/pages/ForgotPassword.jsx`
- [ ] Create `src/pages/ResetPassword.jsx`

**Verify:**
```bash
# Request password reset
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
# Expected: {"success":true,"message":"Reset link sent"}
# Check server console for reset link

# Reset password with token
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"reset-token-from-console","password":"newpassword123"}'
# Expected: {"success":true}
# Should be able to login with new password
```

**Commit:** `git commit -m "Step 29: Password reset flow"`

---

## ✅ Phase 1 Complete

After completing all 29 steps, you should have:
- Working backend with all API endpoints
- Working frontend with all pages
- Full user journey: register → add travels → add wishlist → find friends → see alignment
- Profile editing and settings
- Country detail pages
- "Friends who've been" feature on wishlist

Run through the complete flow one more time to verify everything works together.

**Final commit:** `git commit -m "Phase 1 complete: Travel Together MVP"`

---

## 6. Key Screens (Phase 1)

| Screen | Purpose |
|--------|---------|
| Login/Register | Authentication |
| My Travels | Manage visited countries & cities |
| Wishlist | Manage countries I want to visit (shows friend annotations) |
| Friends | Search, request, manage friends |
| Profile | View own or friend's travel info |
| Let's Travel | Three alignment views (default landing page) |
| Country Detail | View country info, your visits, friends who've been |
| Settings | Update profile, account settings |

### Let's Travel Page - Three Sections

| Section | Shows | City Detail |
|---------|-------|-------------|
| "Let's Go Together!" | Places I want + friends also want | Highlight matching cities |
| "Get Advice" | Places I want + friends have been | Show which cities they visited |
| "Share Your Experience" | Places I've been + friends want | Show which cities they want |

**City-Country Roll-up Rule**: 
- Bob visited Rome → Bob can give advice about Italy
- Alice wants Tokyo → Alice matches with anyone who wants Japan

---

## 7. Business Rules

### Privacy
- **Public**: displayName, total countries count
- **Friends only**: Countries visited, cities, wishlist

### Validation
- Countries: Validate against REST Countries API
- Cities: Validate via Google Places Autocomplete
- Interest level: Integer 1-5
- Email: Basic regex
- Password: Minimum 8 characters

### Constraints
- Can't add same country twice to visited
- Can't add same country twice to wishlist
- Can't friend yourself
- Can't send duplicate friend requests

---

## 8. Environment Variables

```
DATABASE_URL=postgresql://user:pass@localhost:5432/travel_together
JWT_SECRET=your-secret-key-here
GOOGLE_MAPS_API_KEY=your-google-api-key
```

---

## 9. Error Responses

| Code | Meaning |
|------|---------|
| 400 | Bad request (validation failed) |
| 401 | Unauthorized (no/invalid token) |
| 403 | Forbidden (e.g., accessing non-friend profile) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 500 | Server error |

---

## 10. UI/UX Design Guidelines

### Design Style
- **Aesthetic**: Modern and clean
- **Theme**: Travel-themed colors and imagery
- **Responsive**: Mobile-first design

### Navigation
- Bottom navigation bar (mobile) or top nav (desktop)
- Key nav items: My Travels, Wishlist, Let's Travel, Friends, Profile
- **Default landing page**: Let's Travel (after login)

### Visual Elements
- Country flags next to country names
- Interest level shown as stars (★★★★☆)
- Progress indicators when loading
- Empty states with helpful prompts ("Add your first country!")

### Onboarding Flow
1. User signs up
2. Prompt to add initial countries visited (optional, can skip)
3. Prompt to add initial wishlist (optional, can skip)
4. Redirect to Let's Travel page

---

## 11. Deployment

### Hosting Options (Pick One)
- **Railway** - Simple, PostgreSQL included
- **Render** - Free tier available
- **Vercel** (frontend) + Railway (backend)

### Deployment Checklist
- [ ] Set environment variables in hosting platform
- [ ] Run all SQL schema files in order
- [ ] Test all endpoints work in production
- [ ] Verify CORS settings for frontend domain

### No CI/CD Required
For prototype, manual deploys via `git push` are fine.

---

## Deferred to Phase 2

See `APP_SPEC_PHASE2.md` for:
- Friend profile overlap view (see overlap when viewing friend's profile)
- Enjoyment ratings on countries/cities
- Travel vibes
- Experience wishlist
- Trip proposals (AI-generated)
- Discover feed
- Reflection questions
- AI recommendations
- Map visualization

---

**Version**: 1.0  
**Last Updated**: February 5, 2026

