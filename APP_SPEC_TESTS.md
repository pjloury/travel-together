# Travel Together - Test Specifications

This document contains test specifications for both Phase 1 and Phase 2 features.

---

## Phase 1 Tests

### Authentication & Authorization Tests

| Test | Description | Expected |
|------|-------------|----------|
| User Registration - Valid | Register with valid email/password | User created, returns user object |
| User Registration - Duplicate Email | Register with existing email | 409 error, "Email already exists" |
| User Registration - Duplicate Username | Register with existing username | 409 error, "Username already exists" |
| User Registration - Short Password | Password < 8 characters | 400 error, validation message |
| User Login - Valid | Login with correct credentials | Returns JWT token |
| User Login - Wrong Password | Login with incorrect password | 401 error, "Invalid credentials" |
| User Login - Non-existent User | Login with non-existent email | 401 error, "Invalid credentials" |
| JWT Validation - Valid Token | Access protected route with valid JWT | Request succeeds |
| JWT Validation - Expired Token | Access with expired JWT | 401 error, "Token expired" |
| JWT Validation - Invalid Token | Access with malformed JWT | 401 error, "Invalid token" |
| JWT Validation - No Token | Access protected route without token | 401 error, "No token provided" |
| Profile Privacy - Self | View own profile | Full profile data returned |
| Profile Privacy - Friend | View friend's profile | Full profile data returned |
| Profile Privacy - Non-friend | View stranger's profile | Limited data (name, country count only) |

### Friend System Tests

| Test | Description | Expected |
|------|-------------|----------|
| Friend Request - Send | Send request to valid user | Request created, status: pending |
| Friend Request - Duplicate | Send request to same user twice | 409 error, "Request already exists" |
| Friend Request - Self | Send request to yourself | 400 error, "Cannot friend yourself" |
| Friend Request - Non-existent User | Send request to invalid userId | 404 error, "User not found" |
| Friend Accept - Valid | Accept pending request as recipient | Status: accepted, acceptedAt set |
| Friend Accept - Own Request | Sender tries to accept their own request | 403 error, "Cannot accept own request" |
| Friend Accept - Already Accepted | Accept already accepted request | 400 error, "Already accepted" |
| Friend Decline | Decline pending request | Friendship record deleted |
| Friend Remove | Remove accepted friend | Friendship record deleted |
| Friend Search - Username | Search by partial username | Matching users returned |
| Friend Search - Email | Search by partial email | Matching users returned |
| Friend Search - Case Insensitive | Search with different case | Same results regardless of case |
| Friend Search - Excludes Self | Search term matches own username | Own account not in results |
| Friends List | Get friends list | Only accepted friendships returned |

### Travel Tracking Tests

| Test | Description | Expected |
|------|-------------|----------|
| Add Country - Valid | Add valid country code | Country added to user's visits |
| Add Country - Invalid Code | Add non-existent country code | 400 error, "Invalid country code" |
| Add Country - Duplicate | Add same country twice | 409 error, "Country already added" |
| Remove Country | Delete country from visits | Country removed |
| Remove Country - Cascade | Delete country with cities | Country and all cities removed |
| Add City - Valid | Add city to visited country | City added |
| Add City - Invalid Country | Add city to non-visited country | 404 error, "Country not in travel history" |
| Remove City | Delete city | City removed |
| List Countries | Get all visited countries | Array of countries returned |
| List Cities | Get cities for a country | Array of cities returned |

### Wishlist Tests

| Test | Description | Expected |
|------|-------------|----------|
| Add to Wishlist - Valid | Add country with interest 1-5 | Item added to wishlist |
| Add to Wishlist - With Cities | Add with specificCities array | Cities saved |
| Add to Wishlist - Invalid Interest | Interest level 0 or 6 | 400 error, "Interest must be 1-5" |
| Add to Wishlist - Duplicate | Add same country twice | 409 error, "Already on wishlist" |
| Update Interest Level | Change interest from 3 to 5 | Interest updated |
| Update Specific Cities | Add/change specificCities | Cities updated |
| Remove from Wishlist | Delete wishlist item | Item removed |
| List Wishlist | Get all wishlist items | Array with friend annotations |
| Wishlist - Friends Who've Been | Friend visited wishlist country | friendsWhoHaveBeen with citiesVisited |
| Wishlist - City Roll-up | Friend visited Rome | Friend appears for Italy wishlist |
| Wishlist - Friends Who Also Want | Friend also wants country | friendsWhoAlsoWant with specificCities |
| Wishlist Visibility - Friend | View friend's wishlist | Wishlist visible |
| Wishlist Visibility - Non-friend | View stranger's wishlist | Wishlist hidden |

### Travel Alignment Tests

| Test | Description | Expected |
|------|-------------|----------|
| I Can Help | Get places I've been that friends want | Countries with friendsWhoWant array |
| Help Me | Get places I want that friends have been | Countries with friendsWhoHaveBeen array |
| Let's Go | Get places I want that friends also want | Countries with friendsWhoAlsoWant array |
| I Can Help - City Detail | My cities visited shown | myCitiesVisited populated |
| Help Me - City Detail | Friend's cities visited shown | citiesVisited in friendsWhoHaveBeen |
| Let's Go - City Detail | Friend's specific cities shown | specificCities in friendsWhoAlsoWant |
| City Roll-up - Visit | Friend visited Rome | Friend appears for Italy matches |
| City Roll-up - Want | Friend wants Tokyo | Friend appears for Japan matches |
| I Can Help - No Overlap | No friends want places I've been | Empty array returned |
| Help Me - No Overlap | No friends have been to places I want | Empty array returned |
| Let's Go - No Overlap | No friends want same places I want | Empty array returned |
| Alignment Sorting | Multiple friends interested | Sorted by friend count DESC |

### Data Integrity Tests

| Test | Description | Expected |
|------|-------------|----------|
| Unique Constraint - Countries | Same user + country | Only one record allowed |
| Unique Constraint - Wishlist | Same user + country | Only one record allowed |
| Unique Constraint - Friendship | Same two users | Only one friendship record |
| Foreign Key - User Delete | Delete user with data | All related data cascade deleted |
| Foreign Key - Country Delete | Delete country visit | Cities cascade deleted |
| Check Constraint - Interest | Insert interest level 0 | Database rejects |

### Error Handling Tests

| Test | Description | Expected |
|------|-------------|----------|
| 400 Bad Request | Invalid input data | 400 with error message |
| 401 Unauthorized | Missing/invalid auth | 401 with error message |
| 403 Forbidden | Access denied | 403 with error message |
| 404 Not Found | Resource doesn't exist | 404 with error message |
| 409 Conflict | Duplicate creation | 409 with error message |
| 500 Server Error | Database failure | 500 with generic message |

### Integration Tests (Critical Flows)

| Test | Description | Steps |
|------|-------------|-------|
| User Journey | Complete user flow | Register → Login → Add travel → Add wishlist → View profile |
| Friend Flow | Complete friend flow | Search → Request → Accept → View profile → See alignment |
| Data Persistence | Verify data saves | Add data → Logout → Login → Verify data exists |

---

## Phase 2 Tests

### Trip Proposal Tests

| Test | Description | Expected |
|------|-------------|----------|
| Create Proposal - Manual | Create without AI | Proposal created, isAIGenerated: false |
| Create Proposal - AI | Generate with AI | Proposal created with mood, activities, description |
| Share Proposal | Share with friends | sharedWith updated, friends can view |
| Proposal Access - Creator | Creator views proposal | Full access |
| Proposal Access - Shared | Shared friend views | Full access |
| Proposal Access - Not Shared | Non-shared user views | 403 error |
| Submit Feedback | Add feedback to proposal | Feedback saved, linked to proposal |
| AI Refinement | Feedback triggers regeneration | Proposal updated with improvements |
| Feedback History | Get all feedback for proposal | Array of feedback returned |

### Recommendations Tests

| Test | Description | Expected |
|------|-------------|----------|
| Discover Feed - Generate | Get feed items | 10 items with mix of types |
| Discover Feed - Personalized | Feed matches preferences | High relevance scores for matching items |
| City Profile - Generate | Get city profile | Experiences, neighborhoods, tips |
| City Profile - Personalized | Profile for specific user | Recommendations match user profile |
| Country Profile | Get country profile | Best times, facts, tips |
| Caching - Hit | Request cached content | Returns cached, faster response |
| Caching - Miss | Request new content | Generates and caches |
| Cache Invalidation | User data changes | Related cache cleared |

### LLM Integration Tests

| Test | Description | Expected |
|------|-------------|----------|
| OpenAI API - Success | Valid API call | JSON response in expected format |
| OpenAI API - Rate Limit | Too many requests | Graceful retry or error |
| OpenAI API - Timeout | Slow response | Timeout handled, error returned |
| OpenAI API - Invalid Response | Malformed JSON | Error handled, fallback used |
| Prompt Injection | Malicious input | Sanitized, no injection |

### Reflection Questions Tests

| Test | Description | Expected |
|------|-------------|----------|
| Question Generation | Generate for new user | 3 relevant questions returned |
| Question Generation - Gaps | Generate based on gaps | Questions target unknown preferences |
| Question Answering | Submit answer | Answer saved, question status: answered |
| Question Skipping | Skip a question | Status: skipped, doesn't reappear immediately |
| Question Priority | Get questions ordered | Highest priority first |
| Profile Summary - Generate | First answers submitted | Summary created |
| Profile Summary - Update | More answers added | Summary updated, version increments |
| Knowledge Gaps | Analyze profile | Gaps identified for question targeting |

### User Travel Profile Tests

| Test | Description | Expected |
|------|-------------|----------|
| Profile Creation | First answers | Profile created with summary |
| Profile Update | Additional answers | Summary regenerated |
| Key Insights | Extract from answers | Array of insights returned |
| Preference Vectors | Structure preferences | Budget, pacing, environments extracted |

### Enhanced Travel Tracking Tests

| Test | Description | Expected |
|------|-------------|----------|
| Add Year Visited | Set year on country | Year saved |
| Add Rating | Set enjoyment rating | Rating saved (1-5) |
| Rating Validation | Rating outside 1-5 | 400 error |
| Favorite Ranking | Countries with ratings | Sorted by rating DESC |

### Experience Tracking Tests

| Test | Description | Expected |
|------|-------------|----------|
| Add Experience | Add to city | Experience saved |
| Experience Autocomplete | Type partial name | Matching types suggested |
| Custom Experience | Add non-standard type | isCustom: true |
| Experience by City | Get experiences | Grouped by city |

### Map Visualization Tests

| Test | Description | Expected |
|------|-------------|----------|
| Get Map Data | Request country statuses | Array with visited/wishlist status |
| Friend Overlay | Request with friend filter | Shows friend's countries |

---

## Running Tests

### Backend Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.js

# Run with coverage
npm test -- --coverage
```

### Frontend Tests

```bash
# Run all tests
npm test

# Run specific component
npm test -- Profile.test.jsx
```

### E2E Tests (Optional)

```bash
# Using Playwright or Cypress
npm run test:e2e
```

---

## Test Data Setup

### Seed Users
```javascript
const testUsers = [
  { email: 'alice@test.com', username: 'alice', displayName: 'Alice' },
  { email: 'bob@test.com', username: 'bob', displayName: 'Bob' },
  { email: 'charlie@test.com', username: 'charlie', displayName: 'Charlie' }
];
```

### Seed Countries & Cities
```javascript
const testCountries = [
  { code: 'JP', name: 'Japan' },
  { code: 'IT', name: 'Italy' },
  { code: 'FR', name: 'France' },
  { code: 'GR', name: 'Greece' }
];

const testCities = [
  { country: 'JP', name: 'Tokyo' },
  { country: 'JP', name: 'Kyoto' },
  { country: 'IT', name: 'Rome' },
  { country: 'IT', name: 'Florence' },
  { country: 'GR', name: 'Athens' }
];
```

### Seed Relationships
- Alice and Bob are friends
- Alice and Charlie are NOT friends

### Seed Travel Data
```
Alice visited: Tokyo, Kyoto (Japan), Rome (Italy)
Bob visited: Tokyo (Japan), Paris (France)

Alice wishlist: Greece (5), France (3), Japan (4) - specificCities: ["Osaka"]
Bob wishlist: Greece (4) - specificCities: ["Athens"], Italy (5) - specificCities: ["Rome"]
```

### Expected Alignment Results

**Alice's perspective:**

```
Alice's "I Can Help" (places Alice has been → Bob wants):
  - Italy: Bob wants Rome specifically, Alice has been to Rome! ✓ Perfect match

Alice's "Help Me" (places Alice wants → Bob has been):
  - France: Bob has been to Paris
  - Japan: Bob has been to Tokyo (Alice wants Osaka - different city, same country)
  - Greece: No friends have been

Alice's "Let's Go" (places Alice wants → Bob also wants):
  - Greece: Both want it! Bob wants Athens specifically
```

**Bob's perspective:**

```
Bob's "I Can Help" (places Bob has been → Alice wants):
  - Japan: Alice wants Japan (Osaka), Bob has been to Tokyo
  - France: Alice wants France, Bob has been to Paris

Bob's "Help Me" (places Bob wants → Alice has been):
  - Italy: Bob wants Rome, Alice has been to Rome! ✓ Perfect match
  - Greece: No friends have been

Bob's "Let's Go" (places Bob wants → Alice also wants):
  - Greece: Both want it!
```

---

**Version**: 1.0  
**Last Updated**: February 5, 2026

