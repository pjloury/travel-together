# Travel Together - Phase 2 Specification

This document contains features deferred from Phase 1 to keep the initial build simple and incremental.

---

## Prerequisites

Complete all Phase 1 build steps before starting Phase 2.

---

## 0. Friend Profile Overlap View

When viewing a friend's profile, show the wishlist overlap between you and that friend.

### API Endpoint
```
GET /api/alignment/:friendId - Wishlist overlap with specific friend
```

### Response
```json
{
  "success": true,
  "data": {
    "friend": { "id": "...", "displayName": "Bob" },
    "sharedWishlist": [
      { "countryCode": "IT", "countryName": "Italy", "yourInterest": 5, "theirInterest": 4 }
    ],
    "onlyYouWant": [
      { "countryCode": "GR", "countryName": "Greece", "yourInterest": 3 }
    ],
    "onlyTheyWant": [
      { "countryCode": "ES", "countryName": "Spain", "theirInterest": 5 }
    ]
  }
}
```

### Features
- [ ] When viewing friend's profile, show "Travel Overlap" section
- [ ] Highlight countries you both want to visit
- [ ] Show your interest vs their interest side by side
- [ ] Optionally show countries only one of you wants (for discovery)

---

## 1. Enhanced Travel Tracking

### Additional Fields on CountryVisit
```
visitedYear: integer (optional, 1900-2100)
enjoymentRating: integer (optional, 1-5)
rank: integer (optional, for favorite places ranking)
```

### Additional Fields on CityVisit
```
visitedYear: integer (optional)
enjoymentRating: integer (optional, 1-5)
```

### Additional Fields on CountryWishlist
```
notes: string (optional, personal notes about why you want to visit)
```

### Features
- [ ] Add/edit year visited
- [ ] Add/edit enjoyment rating (1-5 stars)
- [ ] Show favorite places ranking (sorted by rating)
- [ ] Display rating on profile
- [ ] Add notes to wishlist items

---

## 2. Experience Tracking

### CityExperience Model
```
id: string (uuid)
cityVisitId: string (FK → CityVisit)
experienceName: string
experienceType: string (category)
notes: string (optional)
createdAt: timestamp
```

### Features
- [ ] Add experiences to cities visited
- [ ] Autocomplete from common experience types
- [ ] Allow custom experience names
- [ ] View experiences grouped by city

### Experience Types (Autocomplete List)
```
Hiking, Museums, Beaches, Food Tours, Nightlife, 
Historical Sites, Adventure Sports, Shopping, 
Local Markets, Wine/Beer Tasting, Temples/Religious Sites,
Nature/Wildlife, Festivals, Art Galleries, Cooking Classes,
Scuba Diving, Skiing, Photography Tours
```

---

## 3. Experience Wishlist

### ExperienceWishlist Model
```
id: string (uuid)
userId: string (FK → User)
experienceName: string
experienceType: string
isCustom: boolean
interestLevel: integer (1-5)
createdAt: timestamp
```

### Features
- [ ] Add experiences I want to have
- [ ] Autocomplete from experience types
- [ ] Set interest level
- [ ] View which friends have done these experiences

---

## 4. Travel Vibes

### TravelVibe Model
```
id: string (uuid)
userId: string (FK → User)
mood: string (relaxed, adventurous, cultural, romantic, party)
pacing: string (slow, moderate, fast-paced)
environments: array (urban, rural, beach, mountains, desert)
description: string (optional)
createdAt: timestamp
```

### Features
- [ ] Set travel vibe preferences
- [ ] Match vibes with friends
- [ ] Use vibes in trip proposal generation

---

## 5. Reflection Questions (AI-Powered)

### TravelPreferenceQuestion Model
```
id: string (uuid)
userId: string (FK → User)
questionText: string
questionType: enum (travel_style, preferences, past_experience, future_goals)
questionCategory: string (budget, pacing, accommodation, activities)
isAIGenerated: boolean
priority: integer (1-5)
status: enum (pending, answered, skipped)
createdAt: timestamp
```

### TravelPreferenceAnswer Model
```
id: string (uuid)
questionId: string (FK → TravelPreferenceQuestion)
userId: string (FK → User)
answer: string
createdAt: timestamp
```

### UserTravelProfile Model
```
id: string (uuid)
userId: string (FK → User)
profileSummary: string (AI-generated)
keyInsights: array of strings
preferenceVectors: jsonb (structured preferences)
knowledgeGaps: array of strings
lastUpdated: timestamp
version: integer
```

### QuestionTemplate Model (Base Question Library)
```
id: string (uuid)
questionText: string
questionType: enum (travel_style, preferences, past_experience, future_goals, values, constraints)
questionCategory: string
conditions: jsonb (optional, when this question should be suggested)
priority: integer (1-5)
isActive: boolean
createdAt: timestamp
```

### Features
- [ ] AI generates personalized questions based on travel history
- [ ] Answer questions over time (not all at once)
- [ ] AI builds travel preference profile from answers
- [ ] Profile summary visible on user profile
- [ ] Questions adapt based on knowledge gaps
- [ ] Base question library with template questions
- [ ] Skip/dismiss questions that aren't relevant

### AI Prompts

**Question Generation:**
```
Based on this user's travel history: [history]
And their previous answers: [answers]
Suggest 3 questions to better understand their travel preferences.
Focus on these gaps: [gaps]
Return JSON: [{ questionText, questionType, questionCategory, priority }]
```

**Profile Summary:**
```
Summarize this user's travel preferences based on:
- Travel history: [history]
- Answers: [answers]
Return a 2-3 sentence summary and key insights as JSON.
```

---

## 6. Trip Proposals (AI-Powered)

### TripProposal Model
```
id: string (uuid)
createdBy: string (FK → User)
countryCode: string
countryName: string
mood: string
exampleActivities: array of strings
itineraryDescription: string
isAIGenerated: boolean
aiPrompt: string (optional, the prompt used if AI-generated)
status: enum (draft, shared, accepted)
sharedWith: array of userIds
createdAt: timestamp
updatedAt: timestamp
```

### TripProposalFeedback Model
```
id: string (uuid)
tripProposalId: string (FK → TripProposal)
userId: string (FK → User)
feedback: string
createdAt: timestamp
```

### Features
- [ ] Create trip proposal (manual or AI-generated)
- [ ] AI considers: friend interests, travel history, wishlist overlap, travel profiles
- [ ] Override AI suggestions
- [ ] Share proposal with friends
- [ ] Friends give feedback
- [ ] AI refines proposal based on feedback

### AI Prompts

**Generate Proposal:**
```
Generate a trip proposal for [country] for these travelers:
[user profiles and preferences]

Shared interests: [wishlist overlap]
Combined travel history: [history]

Return JSON:
{
  mood: string,
  exampleActivities: [5 activities],
  itineraryDescription: string (200 words)
}
```

**Refine with Feedback:**
```
Original proposal: [proposal]
User feedback: [feedback]
Generate improved version maintaining the same JSON structure.
```

---

## 7. Discover Feed

### DiscoverFeedItem Model
```
id: string (uuid)
type: enum (seasonal, friend_experience, popular, personalized)
title: string
description: string
countryCode: string (optional)
cityName: string (optional)
imageUrl: string (optional)
season: string (optional)
relevanceScore: float
createdAt: timestamp
```

### Features
- [ ] Scroll through travel inspiration
- [ ] Seasonal recommendations
- [ ] Friend's experiences
- [ ] Popular destinations
- [ ] AI-personalized suggestions based on travel profile

### Feed Algorithm
1. Generate 10 items per request
2. Mix: 30% seasonal, 20% friend experiences, 20% popular, 30% personalized
3. Sort by relevanceScore DESC
4. Cache for 24 hours

---

## 8. City & Country Profiles

### CountryProfile Model
```
id: string (uuid)
countryCode: string (unique)
countryName: string
bestTimesToVisit: jsonb
culturalFacts: array of strings
generalTips: array of strings
createdAt: timestamp
```

### CityProfile Model
```
id: string (uuid)
cityName: string
countryCode: string
recommendedExperiences: jsonb
recommendedNeighborhoods: jsonb
bestTimesToVisit: jsonb
culturalFacts: array of strings
generalTips: array of strings
createdAt: timestamp
```

### Features
- [ ] View country/city detail pages
- [ ] AI-generated best times to visit (festivals, weather, events)
- [ ] Personalized experience recommendations
- [ ] Neighborhood guides
- [ ] Cultural fun facts
- [ ] Which friends have been there

---

## 9. Map Visualization

### Features
- [ ] World map showing visited countries (colored)
- [ ] World map showing wishlist countries (different color)
- [ ] Click country to see detail
- [ ] Friend overlay option

### Implementation
- Use simple SVG world map
- Color countries by status (visited, wishlist, both)
- No complex mapping library needed

---

## 10. Technical Enhancements

### AI Response Caching
- Cache AI-generated content in database
- 7-day TTL for profiles and recommendations
- Invalidate on user data changes

### Rate Limiting
- Add rate limiting once multiple users
- 100 requests/minute per user

### Background Jobs
- Queue for AI calls if latency becomes issue
- Async profile regeneration

---

## 11. Phase 2 Build Order

1. Friend profile overlap view (simple, no AI)
2. Enhanced tracking (ratings, years)
3. City experiences
4. Experience wishlist
5. Map visualization
6. Travel vibes
7. Reflection questions + AI profile
8. Trip proposals
9. City/country profiles
10. Discover feed

---

## 12. Environment Variables (Phase 2)

Add to existing:
```
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=gpt-3.5-turbo
```

---

**Version**: 1.0  
**Last Updated**: February 5, 2026

