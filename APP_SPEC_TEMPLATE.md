# Travel Together - App Specification Template

## 1. Project Overview

### App Name
- **Name**: Travel Together
- **Tagline**: Explore with Friends

### Core Concept
Travel Together helps friends discover places and types of trips that they both want to go on and helps them zero in on a travel plan, clarifying who, where, when, and what types of activities
---

## 2. User Personas

### Primary User
- **Name**: Tommy Traveler
- **Age Range**: 27 to 36 years old
- **Characteristics**: Well traveled, interested in discovering new travel experiences with friends, has vacation flexibility and the ability to go anywhere in the world for 7-10 days with friends for a meaningful experience together
- **Goals**: 
1. To create a goal board for places that he's interested in visiting
2. To keep track of which friends he's interested in traveling with and what types of experiences he thinks they would both enjoy
3. To keep track of times during the year that he would ideally want to travel
4. To discover which friends have similar interests in experiences, times of year, locations to travel to
5. To see a list of the places he's been and to help him articulate the types of travel that he's enjoyed the most in the past
- **Pain Points**: [What problems does this solve for them]
1. Tommy misses his closest friends, all of whom are busy and live in others cities. He wants to reconnect with a select group of friends but is struggling to figure out where, when, and what to do that would appeal to his friends
2. Tommy has been to a lot of the more "obvious" places in global travel and so is looking to discover new places and experiences that he hasn't done yet, but perhaps some of his friends have done. Whenever he learns about a place of an experience that appeals to him, he struggles to keep track of and remember this information

---

## 3. Core Features

### 3.1 Authentication & User Management
- [ ] User registration (email/password)
- [ ] User login/logout
- [ ] Password reset
- [ ] Profile creation/editing
- [ ] Full profiles can only be viewed by friends

### 3.2 Friend System
- [ ] Search to find friends
- [ ] Send friend requests
- [ ] Accept/decline friend requests
- [ ] View friends list
- [ ] Remove friends

### 3.3 Travel Tracking
- [ ] Add countries visited (need to make this super easy for people to fill out)
- [ ] Add cities visited (within countries)
- [ ] Remove countries/cities
- [ ] Optional ability to put the year that you traveled to that country/city
- [ ] Optional ability to rate how much you enjoyed your time in that country/city
- [ ] Show a ranking of the favorite places that you've traveled
- [ ] Total countries traveled displayed on public profile preview
- [ ] **Phase 2**: Dynamic and intelligent reflection questions that adapt based on user's travel history and previous answers to help the AI better understand their travel preferences


### 3.4 Wishlist & Interest Tracking
- [ ] Add countries to "Want to Visit" list
- [ ] Add experiences I want to have list (have a autocomplete from a list of potential activities, plus ability to add custom ones)
- [ ] Add travel "vibes" I'm interested in– describing the essence of the type of trip I want to have (in terms of the mood, the pacing, urban, rural, beach, mountains)
- [ ] Set interest level for experiences, and places you want to visit (1-5 scale)
- [ ] Remove from wishlist
- [ ] Can see which of your friends have been to the countries on your wishlist
- [ ] All list items are visible to friends on your profile

### 3.5 Travel Alignment and Discovery
- [ ] See a view that shows the most popular places that have mutual interest amongst your friends
- [ ] **Phase 2**: Ability to build a Trip Proposal (a place, a mood, example activities, appealing itinerary description)– AI generated based on:
  - [ ] Your friend's common interests
  - [ ] Past travel history and patterns
  - [ ] Wishlist alignments
  - [ ] Travel preference profiles of all participants (from reflection questions)
  - [ ] You can override the AI chosen parameters
  - [ ] Have the ability to give feedback on the proposal to further customize it with the help of AI

### 3.6 Recommendations 
- [ ] **Phase 2**: Scroll through a discover feed that shares travel inspiration that is seasonal and is based on:
  - [ ] User's travel preference profile (from reflection questions)
  - [ ] Known user interests and preferences
  - [ ] Travel history and patterns
  - [ ] Popular destinations
  - [ ] Friend's experiences
- [ ] **Phase 2**: View individual city profiles with experience and neighborhood recommendations that are personalized to the user based on their travel profile
- [ ] **Phase 2**: AI uses comprehensive understanding from reflection questions to provide highly personalized recommendations

---

## 4. User Flows

### 4.1 Onboarding Flow
- [ ] 1. User signs up
- [ ] 2. User adds initial countries visited (optional)
- [ ] 3. User adds initial wishlist (optional)

### 4.2 Adding Travel History
- [ ] 1. User navigates to "My Travels" or profile
- [ ] 2. Clicks on "Add Country" text input to start typing country name
- [ ] 3. User can use arrows and return key to quickly add a country
- [ ] 4. Profile auto saves and updates
- [ ] 5. Once Countries are added, the user can scroll through the countries they've been to and add cities within the country that they've been to (using Google Maps Places Autocomplete API)
- [ ] 6. Within the city, the user can add experiences they've had in that city

### 4.3 Let's Travel View
- [ ] 1. Shows a list of friends with a synopsis of their wishlist
- [ ] 2. Provides a summary of the top areas of alignment amongst your friends
- [ ] 3. **Phase 2**: View trip proposals created by yourself or by others
- [ ] 4. **Phase 2**: Create new trip proposals
- [ ] 5. **Phase 2**: Scroll through discover carousel

### 4.4 Country Detail view
- [ ] 1. Managed info about whether you've been, to which cities and what related experiences
- [ ] 2. Which friends have been
- [ ] 3. **Phase 2**: Best times to visit, based on interesting festivals or local traditions
- [ ] 4. **Phase 2**: Personalized Recommended experiences & neighborhoods 
- [ ] 5. **Phase 2**: General tips and cultural fun facts

---

## 5. Example Data Model

### User
```
- id: string
- email: string
- username: string
- displayName: string
- avatar: string (URL, optional - can be added later)
- totalCountriesVisited: number (computed/cached)
- createdAt: timestamp
- updatedAt: timestamp
```
<｜tool▁call▁begin｜>
read_lints

### Friendship
```
- id: string
- userId1: string (reference to User)
- userId2: string (reference to User)
- status: enum (pending, accepted, blocked)
- requestedBy: string (userId)
- createdAt: timestamp
- acceptedAt: timestamp
```

### Country Visit
```
- id: string
- userId: string (reference to User)
- countryCode: string (ISO code)
- countryName: string
- visitedYear: number (optional)
- enjoymentRating: number (1-5, optional)
- rank: number (optional, for favorite places ranking)
- createdAt: timestamp
- updatedAt: timestamp
```

### City Visit
```
- id: string
- countryVisitId: string (reference to CountryVisit)
- cityName: string
- visitedYear: number (optional)
- enjoymentRating: number (1-5, optional)
- createdAt: timestamp
```

### City Experience
```
- id: string
- cityVisitId: string (reference to CityVisit)
- experienceName: string
- experienceType: string (category)
- notes: string (optional)
- createdAt: timestamp
```

### Travel Preference Question
```
- id: string
- userId: string (reference to User)
- questionText: string (the actual question asked)
- questionType: enum (travel_style, preferences, past_experience, future_goals, values, constraints)
- questionCategory: string (e.g., "budget", "pacing", "accommodation", "activities")
- isAIGenerated: boolean (true if generated dynamically, false if from template)
- generationContext: string (optional, why this question was selected/generated)
- priority: number (1-5, how important this question is for understanding the user)
- status: enum (pending, answered, skipped, dismissed)
- suggestedBy: string (optional, "ai", "template", "user_profile_gap")
- createdAt: timestamp
- answeredAt: timestamp (optional)
```

### Travel Preference Answer
```
- id: string
- questionId: string (reference to Travel Preference Question)
- userId: string (reference to User)
- answer: string (text response)
- answerMetadata: object (optional, structured data extracted from answer)
- createdAt: timestamp
- updatedAt: timestamp
```

### User Travel Profile (AI Context Summary)
```
- id: string
- userId: string (reference to User)
- profileSummary: string (AI-generated summary of user's travel preferences)
- keyInsights: array of string (extracted insights from answers)
- preferenceVectors: object (structured preferences: budget, pacing, environments, etc.)
- knowledgeGaps: array of string (areas where more info would help)
- lastUpdated: timestamp
- version: number (tracks updates as more data is collected)
```

### Question Template (Base Question Library)
```
- id: string
- questionText: string
- questionType: enum (travel_style, preferences, past_experience, future_goals, values, constraints)
- questionCategory: string
- conditions: object (optional, when this question should be suggested)
- priority: number (1-5)
- isActive: boolean
- createdAt: timestamp
```

### Country Wishlist Item
```
- id: string
- userId: string (reference to User)
- countryCode: string (ISO code)
- countryName: string
- interestLevel: number (1-5)
- notes: string (optional)
- addedAt: timestamp
```

### Experience Wishlist Item
```
- id: string
- userId: string (reference to User)
- experienceName: string
- experienceType: string (category, from autocomplete list or custom)
- isCustom: boolean
- interestLevel: number (1-5)
- notes: string (optional)
- addedAt: timestamp
```

### Travel Vibe
```
- id: string
- userId: string (reference to User)
- mood: string (e.g., "relaxed", "adventurous", "cultural")
- pacing: string (e.g., "slow", "moderate", "fast-paced")
- environment: array of strings (e.g., ["urban", "rural", "beach", "mountains"])
- description: string (optional, free-form)
- createdAt: timestamp
- updatedAt: timestamp
```

### Trip Proposal
```
- id: string
- createdBy: string (reference to User)
- countryCode: string (ISO code)
- countryName: string
- mood: string
- exampleActivities: array of strings
- itineraryDescription: string
- isAIGenerated: boolean
- aiPrompt: string (optional, if AI-generated)
- status: enum (draft, shared, accepted)
- sharedWith: array of string (userIds)
- createdAt: timestamp
- updatedAt: timestamp
```

### Trip Proposal Feedback
```
- id: string
- tripProposalId: string (reference to Trip Proposal)
- userId: string (reference to User)
- feedback: string (text feedback for AI)
- createdAt: timestamp
```

### Discover Feed Item
```
- id: string
- type: enum (seasonal_inspiration, friend_experience, popular_destination, personalized_recommendation)
- title: string
- description: string
- countryCode: string (optional)
- countryName: string (optional)
- cityName: string (optional)
- imageUrl: string (optional)
- season: string (optional, for seasonal items)
- relevanceScore: number (for personalization)
- createdAt: timestamp
```

### City Profile
```
- id: string
- cityName: string
- countryCode: string (ISO code)
- countryName: string
- recommendedExperiences: array of ExperienceRecommendation
- recommendedNeighborhoods: array of NeighborhoodRecommendation
- bestTimesToVisit: array of BestTimeEntry
- culturalFacts: array of string
- generalTips: array of string
- createdAt: timestamp
- updatedAt: timestamp
```

### Experience Recommendation
```
- id: string
- cityProfileId: string (reference to CityProfile)
- name: string
- description: string
- category: string
- neighborhood: string (optional)
- personalizedFor: string (optional, userId if personalized)
- createdAt: timestamp
```

### Neighborhood Recommendation
```
- id: string
- cityProfileId: string (reference to CityProfile)
- name: string
- description: string
- highlights: array of string
- personalizedFor: string (optional, userId if personalized)
- createdAt: timestamp
```

### Best Time to Visit
```
- id: string
- cityProfileId: string (reference to CityProfile) or countryCode: string
- months: array of numbers (1-12)
- reason: string (e.g., "Cherry Blossom Festival", "Best Weather", "Cultural Celebration", "Peak Hiking Season")
- reasonType: enum (festival, weather, seasonal_activity, cultural_event, natural_phenomenon, other)
- description: string (optional, detailed explanation)
- createdAt: timestamp
```

### Country Profile (System-generated)
```
- id: string
- countryCode: string (ISO code)
- countryName: string
- bestTimesToVisit: array of BestTimeToVisit
- seasonalReasons: array of SeasonalReason
- culturalFacts: array of string
- generalTips: array of string
- region: string
- createdAt: timestamp
- updatedAt: timestamp
```

### Seasonal Reason (Reasons to Visit at Specific Times)
```
- id: string
- countryProfileId: string (reference to CountryProfile) or cityProfileId: string (reference to CityProfile)
- name: string (e.g., "Cherry Blossom Season", "Monsoon Season", "Ski Season")
- description: string
- months: array of numbers (1-12)
- reasonType: enum (festival, weather, seasonal_activity, cultural_event, natural_phenomenon, local_tradition, other)
- location: string (city/region, optional)
- highlights: array of string (optional, key points about this reason)
- createdAt: timestamp
```

---

## 6. UI/UX Considerations

### Design Style
- Modern and clean
- Travel-themed (colors, imagery)
- Mobile-first responsive design

### Key Pages/Screens
- [ ] Landing Page
- [ ] Login / Register
- [ ] Dashboard / Home
- [ ] Profile (wishlist, friends' view) - Phase 2: reflection questions, profile summary
- [ ] My Travels (countries/cities visited, add history, see travel stats)
- [ ] Wishlist (countries & experiences wishlist, set interest level, see friends with mutual interests)
- [ ] Discover / Alignments (common interests among friends) - Phase 2: discover feed, AI recommendations
- [ ] **Phase 2**: Trip Proposals (create, view, give feedback on trip proposals)
- [ ] Country Detail (visited and wishlist info, cities, experiences, friends' travel) - Phase 2: best times to visit, cultural info
- [ ] **Phase 2**: City Detail (experiences, neighborhoods, tips, friends who've been)
- [ ] Friends List / Search (manage friend requests and view friends)
- [ ] Settings (account, privacy, preferences)

### Navigation
- [ ] Navigation structure (top nav, sidebar, bottom nav?)
- [ ] Key navigation items

### Visual Elements
- [ ] Map integration? (show countries on map)
- [ ] Country flags/icons
- [ ] Travel photos
- [ ] Progress indicators
- [ ] Statistics/charts

---

## 7. Technical Requirements (What We're Using)

### Frontend (Vanilla Stack)
- **Framework**: React
- **State Management**: Context API (built-in, no extra dependencies)
- **Routing**: React Router (minimal dependency, essential for multi-page app)
- **Styling**: Plain CSS or inline styles (no CSS framework needed for prototype)
- **Form Handling**: Controlled inputs with useState (built-in, no form library)
- **API Client**: fetch API (built-in, no axios or React Query needed)

**Removed Dependencies**: Zustand, React Hook Form, React Query/TanStack Query, Axios, Tailwind CSS, Chakra UI

### Backend (Vanilla Stack)
- **Backend Type**: Node.js/Express
- **Database**: PostgreSQL
- **Authentication**: Simple JWT with bcrypt (vanilla approach, no Supabase dependency)
- **File Storage**: None for Phase 1 (avatars can be added later if needed)

**Removed Dependencies**: Supabase Auth, Cloudinary

**Core Dependencies Needed**: 
- `express` - web framework
- `pg` or `pg-promise` - PostgreSQL client
- `jsonwebtoken` - JWT tokens
- `bcrypt` - password hashing
- `dotenv` - environment variables

### Third-Party Services
- REST Countries API for countries list
- Google Maps Places Autocomplete API for city input
- **Phase 2**: OpenAI LLM API for discovery recommendations and personalized recommendations


---

## 8. MVP Features (Minimum Viable Product)

### Phase 1 - Core Functionality (5 Checkpoints)

#### Checkpoint 1: Authentication & User Setup
**Goal**: Users can register, login, and have a basic profile
- [ ] User registration (email/password)
- [ ] User login/logout
- [ ] JWT authentication middleware
- [ ] Basic user model (email, username, displayName, password hash)
- [ ] Protected route middleware
- [ ] Get own profile endpoint
- **Tests**: Registration creates user, login returns JWT, invalid credentials rejected, protected routes require auth, can view own profile

#### Checkpoint 2: Travel History - Countries
**Goal**: Users can add and view countries they've visited
- [ ] Add country to travel history (with REST Countries API validation)
- [ ] View list of countries visited
- [ ] Remove country from travel history
- [ ] Country validation (must exist in REST Countries API)
- [ ] Duplicate prevention (can't add same country twice)
- [ ] Total countries count calculation
- **Tests**: Add country succeeds, duplicate prevented, invalid country rejected, remove country works, total count updates

#### Checkpoint 3: Travel History - Cities & Experiences
**Goal**: Users can add cities and experiences to their travel history
- [ ] Add city to a country (using Google Maps Places Autocomplete API)
- [ ] Add experience to a city
- [ ] Optional: Add year visited and enjoyment rating (1-5)
- [ ] View cities and experiences for each country
- [ ] Remove cities/experiences
- [ ] Cascade delete (removing country removes cities/experiences)
- **Tests**: Add city to country, add experience to city, optional fields work, cascade delete works, view nested structure

#### Checkpoint 4: Wishlist
**Goal**: Users can create and manage their travel wishlist
- [ ] Add country to wishlist with interest level (1-5)
- [ ] Add experience to wishlist with interest level (1-5)
- [ ] View own wishlist (countries and experiences)
- [ ] Remove items from wishlist
- [ ] Interest level validation
- **Tests**: Add wishlist items, interest level validated, view wishlist, remove items, duplicates prevented

#### Checkpoint 5: Friend System & Travel Alignment
**Goal**: Users can friend each other and see mutual travel interests
- [ ] Search for users (by username or email)
- [ ] Send friend request
- [ ] Accept/decline friend request
- [ ] View friends list
- [ ] Remove friend
- [ ] View friend's profile (countries visited, wishlist)
- [ ] Basic travel alignment: find countries in both users' wishlists
- [ ] Privacy: non-friends see only public info (name, total countries)
- **Tests**: Search finds users, friend request works, acceptance creates friendship, privacy enforced, alignment calculation works

### Phase 2 - AI-Powered Features

#### Reflection Questions & Answers
- [ ] Dynamic and intelligent reflection questions that adapt based on user's travel history and previous answers
- [ ] Questions are generated/selected by AI based on gaps in understanding, travel patterns, and what would be most valuable to learn next
- [ ] Questions can be answered over time (not all at once) and the system learns progressively
- [ ] User Travel Profile: AI-generated profile summary based on reflection question answers

#### Trip Proposals
- [ ] Ability to build a Trip Proposal (a place, a mood, example activities, appealing itinerary description) - AI generated based on:
  - [ ] Your friend's common interests
  - [ ] Past travel history and patterns
  - [ ] Wishlist alignments
  - [ ] Travel preference profiles of all participants (from reflection questions)
  - [ ] You can override the AI chosen parameters
- [ ] Ability to give feedback on the proposal to further customize it with the help of AI

#### Discovery & Recommendations
- [ ] Scroll through a discover feed that shares travel inspiration that is seasonal and is based on:
  - [ ] User's travel preference profile (from reflection questions)
  - [ ] Known user interests and preferences
  - [ ] Travel history and patterns
  - [ ] Popular destinations
  - [ ] Friend's experiences
- [ ] View individual city profiles with experience and neighborhood recommendations that are personalized to the user based on their travel profile
- [ ] Personalized AI generated information about best times to visit and why
- [ ] AI uses comprehensive understanding from reflection questions to provide highly personalized recommendations

#### Technical Enhancements
- [ ] AI Response Caching (cache AI-generated content in database, 7 day TTL)



---

## 9. Open Questions / Decisions Needed

### Data & Content
- Use Google Maps Places Autocomplete API for city input
- No timeline, but allow users to indicate what year they went to the place
- **Phase 2**: Will populate best times to visit using LLM API call
- **Phase 2**: AI generated experience recommendations
- No limit on # of countries/cities added

### Social Features
- Profiles should be private by default, only thing public is person's first name and last name initial and total number of countries traveled
- No messaging/chat functionality?
- No groups functionality
- No following model, only friending model

### Recommendations (Phase 2)
- Recommendations should not be editable by users, but the user should be able to give feedback on the types of recommendations they get overall
- All personalization should be based on Gen-AI

### UI/UX
- Yes there should there be a map view showing visited countries?
- The default landing page should be the Let's Travel page

---

## 10. Success Metrics

### User Engagement
-  Number of active users
-  Number of countries tracked per user
-  Number of wishlist items per user
-  Number of friend connections
-  Frequency of app usage

### Feature Usage
- [ ] Number of trip proposals created created

---

## 11. Implementation Decisions (How We're Building It)

### API & Integration Details
- **Country/City Data Source**: REST Countries API (free, simple) for countries. For cities, Google Maps Places Autocomplete API
- **OpenAI API Details (Phase 2)**: 
  - Model: GPT-3.5-turbo (cheaper, fast enough for prototype)
  - Rate limiting: None for Phase 1 (only you using it)
  - Cost management: No caching in Phase 1, all AI calls made on-demand
  - Prompt templates: Simple string templates with user context injected
- **API Response Formats**: Standard JSON, all endpoints return `{ success: boolean, data?: any, error?: string }`
- **Error Handling**: 400 (bad request), 401 (unauthorized), 404 (not found), 500 (server error) with simple error messages

### LLM Prompt Engineering (Phase 2)
- **Trip Proposal Generation**: Simple prompt: "Generate a trip proposal for [country] based on these preferences: [user profiles]. Include: mood, 3-5 activities, itinerary description. Return JSON."
- **Recommendation Generation**: "Generate [type] recommendations for [location] based on user preferences: [profile]. Return JSON array."
- **Question Generation**: "Based on this user's travel history [history] and answers [answers], suggest 3 questions to better understand their preferences. Return JSON array."
- **User Profile Summary**: "Summarize this user's travel preferences based on: [answers]. Return a 2-3 sentence summary."
- **Feedback Processing**: Append feedback to original prompt and regenerate: "Original proposal: [proposal]. User feedback: [feedback]. Generate improved version."

### Data & Validation
- **Country/City Validation**: Validate countries against REST Countries API response. Validate cities via Google Maps Places Autocomplete API
- **Experience Autocomplete**: Simple hardcoded list of common experiences (hiking, museums, beaches, etc.) + allow custom
- **Data Validation Rules**: 
  - Email: basic regex validation
  - Dates: year must be 1900-2100
  - Ratings: must be 1-5 integer
  - Required fields: email, password, username
- **Duplicate Prevention**: Database unique constraint on (userId, countryCode) for visits, (userId, countryCode) for wishlist
- **Country Code Standard**: ISO 3166-1 alpha-2 (2-letter codes)

### Business Logic
- **Friend Search**: Simple case-insensitive search on username OR email (exact match, no fuzzy)
- **Travel Alignment Algorithm**: Simple intersection - find countries in both users' wishlists, count matches, sort by combined interest level
- **Favorite Places Ranking**: Sort by enjoymentRating DESC, then by recency (visitedYear DESC)
- **Profile Visibility**: Friends see everything. Public sees: firstName, lastNameInitial, totalCountriesVisited

### Business Logic (Phase 2)
- **Discover Feed Algorithm**: Show 10 items, ordered by relevanceScore DESC (calculated from user preferences)
- **Question Priority Logic**: AI generates questions based on gaps, priority 1-5 assigned by AI, show highest priority first

### Performance & Caching
- **AI Response Caching**: Phase 2 - No caching in Phase 1, all AI calls made on-demand
- **Database Indexing**: Add indexes later if performance issues arise (PostgreSQL will handle basic queries fine for prototype)
- **Pagination**: Simple offset-based, 20 items per page
- **Background Jobs**: None for MVP - all AI calls synchronous (add queue later if needed)
- **Rate Limiting**: None for Phase 1 (only you using it, add later if needed)

### Security & Privacy
- **Password Requirements**: Min 8 characters, no complexity required for prototype
- **Session Management**: JWT expires in 7 days, no refresh tokens (just re-login)
- **File Upload**: None for Phase 1 (avatars can be added later if needed)
- **Data Retention**: Hard deletes (no soft deletes for prototype)
- **Privacy Settings**: Just friend-only vs public (as specified)

### Deployment & Environment
- **Environment Variables**: 
  - `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_MAPS_API_KEY`
  - **Phase 2**: `OPENAI_API_KEY`
- **Deployment Strategy**: Simple hosting (Railway, Render, or Vercel), no CI/CD for prototype
- **Monitoring**: Console logging only, no external services

---

## 12. Backend Test Specifications (Essential Tests Only)

### Authentication & Authorization Tests
- [ ] **User Registration**: Valid email/password creates user, duplicate email rejected
- [ ] **User Login**: Valid credentials return JWT, invalid credentials rejected
- [ ] **JWT Validation**: Expired/invalid tokens rejected, valid tokens work
- [ ] **Protected Routes**: Unauthenticated requests return 401
- [ ] **Profile Privacy**: Non-friends see only public info, friends see full profile

### Friend System Tests
- [ ] **Friend Request**: Can send request, duplicate prevented, can't request self
- [ ] **Friend Acceptance**: Request accepted, friendship created, status updated
- [ ] **Friend Search**: Search by username/email finds users

### Travel Tracking Tests
- [ ] **Add Country**: Country added, duplicate prevented
- [ ] **Add City**: City added to correct country
- [ ] **Remove Country**: Country removed, cities cascade deleted
- [ ] **Update Rating**: Rating updated, validation (1-5) works

### Wishlist Tests
- [ ] **Add Country Wishlist**: Country added, interest level validated (1-5)
- [ ] **Add Experience Wishlist**: Experience added, custom allowed
- [ ] **Friend Wishlist Visibility**: Friends can see, non-friends cannot

### Travel Alignment Tests
- [ ] **Mutual Interest**: Correctly finds countries both friends want to visit

### Data Integrity Tests
- [ ] **Unique Constraints**: Duplicate prevention works
- [ ] **Data Validation**: Invalid data rejected (ratings, dates, etc.)

### Error Handling Tests
- [ ] **404/400/500**: Appropriate error codes and messages returned

### Integration Tests (Critical Flows)
- [ ] **User Journey**: Signup → add travel → add wishlist works
- [ ] **Friend Flow**: Search → request → accept → view profile works

---

## 13. Phase 2 Test Specifications

### Trip Proposal Tests
- [ ] **Create Proposal**: Proposal created, AI generation works
- [ ] **Share Proposal**: Proposal shared with friends
- [ ] **Proposal Access**: Only creator and shared friends can view
- [ ] **Submit Feedback**: Feedback saved, linked to proposal
- [ ] **AI Refinement**: Feedback triggers proposal update with AI refinement
- [ ] **Feedback History**: All feedback retrievable for a proposal

### Recommendations Tests
- [ ] **Discover Feed**: Feed items generated, personalized
- [ ] **City Profile**: Profile generated with recommendations
- [ ] **Caching**: Cached responses returned when available

### LLM Integration Tests
- [ ] **OpenAI API Calls**: Successful calls return expected format
- [ ] **Error Handling**: API failures handled gracefully
- [ ] **Rate Limiting**: Rate limits enforced
- [ ] **LLM Failures**: Graceful error handling when OpenAI fails

### Reflection Questions Tests
- [ ] **Question Generation**: AI generates questions based on user's travel history and gaps
- [ ] **Question Answering**: Answer saved, linked to question, status updated
- [ ] **Question Skipping**: Skipped questions marked correctly, don't reappear
- [ ] **Question Priority**: Questions ordered by priority correctly
- [ ] **Profile Summary**: Summary regenerated after answers, version increments

### User Travel Profile Tests
- [ ] **Profile Generation**: Profile summary generated from reflection answers
- [ ] **Profile Update**: Profile updates when new answers added
- [ ] **Knowledge Gaps**: Gaps identified correctly for question generation

### Integration Tests (Phase 2 Flows)
- [ ] **Trip Proposal Flow**: Create → share → feedback → refine works
- [ ] **Recommendations Flow**: Generate discover feed → view city profile works

---

**Last Updated**: [December 13th]
**Version**: 0.1

