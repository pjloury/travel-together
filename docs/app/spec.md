# Travel Together -- Web Application Specification

## Intent Traceability

| SC-* | Success Criterion | REQ-*/SCN-*/INV-* |
|------|-------------------|-------------------|
| SC-MEMORY-001 | User can create a memory pin with place name + experience tag (min), optional photo/note/year/rating | REQ-MEMORY-001, SCN-MEMORY-001-01 |
| SC-MEMORY-002 | Memories displayed as visual cards with AI summary, verbatim transcript, image-forward | REQ-MEMORY-002, SCN-MEMORY-002-01 |
| SC-MEMORY-003 | User can tag memories from defined taxonomy | REQ-MEMORY-003, SCN-MEMORY-003-01 |
| SC-MEMORY-004 | User browses memories in visual grid, filterable by place or tag | REQ-MEMORY-004, SCN-MEMORY-004-01 |
| SC-MEMORY-005 | Voice input is primary creation path; manual text entry supported | REQ-MEMORY-005, SCN-MEMORY-005-01 |
| SC-MEMORY-006 | Memories view uses warm visual treatment, no data-table aesthetics | REQ-MEMORY-006 |
| SC-VOICE-001 | User records free-form voice memo | REQ-VOICE-001, SCN-VOICE-001-01 |
| SC-VOICE-002 | Voice transcribed to text; verbatim transcript displayed and preserved | REQ-VOICE-002, SCN-VOICE-002-01 |
| SC-VOICE-003 | AI proposes structured data from transcript (place, max 3 tags from fixed 16, summary) | REQ-VOICE-003, SCN-VOICE-003-01 |
| SC-VOICE-004 | User reviews AI proposal: edit fields, re-record corrections, both transcripts preserved | REQ-VOICE-004, SCN-VOICE-004-01 |
| SC-VOICE-005 | Explicit save commits memory card with AI summary + verbatim transcript | REQ-VOICE-005, SCN-VOICE-005-01 |
| SC-VOICE-006 | Audio captured client-side, transcribed server-side via Whisper API | REQ-VOICE-006, SCN-VOICE-006-01 |
| SC-VOICE-007 | Each pipeline stage shows specific errors with Retry + Type Instead fallback | REQ-VOICE-007, SCN-VOICE-007-01, SCN-VOICE-007-02, SCN-VOICE-007-03 |
| SC-DREAM-001 | User creates dream pin with destination/experience, optional inspiration resources (max 10) | REQ-DREAM-001, SCN-DREAM-001-01 |
| SC-DREAM-002 | Dream pins as visual pinboard with Unsplash auto-fetch + gradient/emoji fallback | REQ-DREAM-002, SCN-DREAM-002-01 |
| SC-DREAM-003 | Dream board uses large imagery, minimal chrome, mood-board layout | REQ-DREAM-003 |
| SC-DREAM-004 | User browses/filters dream pins by destination or experience type | REQ-DREAM-004, SCN-DREAM-004-01 |
| SC-DREAM-005 | "I went!" converts dream to memory via voice or quick-add, with keep/archive choice | REQ-DREAM-005, SCN-DREAM-005-01, SCN-DREAM-005-02 |
| SC-PROFILE-001 | Top 8 per tab (independent lists), drag-reorder, server-persisted, cap enforced | REQ-PROFILE-001, SCN-PROFILE-001-01 |
| SC-PROFILE-002 | Top 8 visible to friends as curated highlights | REQ-PROFILE-002 |
| SC-PROFILE-003 | Profile shows visual summary: memory count, dream count, top experience types | REQ-PROFILE-003, SCN-PROFILE-003-01 |
| SC-NAV-001 | PAST/FUTURE tab switcher; memory board IS the profile | REQ-NAV-001 |
| SC-NAV-002 | Both tabs default to Top 8 above fold; All view below | REQ-NAV-002 |
| SC-NAV-003 | Tab switcher is instant SPA switch, no reload | REQ-NAV-003 |
| SC-NAV-004 | Tab memory stored server-side; deep links override; own-boards only | REQ-NAV-004, SCN-NAV-004-01 |
| SC-NAV-005 | Global search by display name/username; user cards; non-friends see Top 8 only | REQ-NAV-005, SCN-NAV-005-01 |
| SC-NAV-006 | Friend board annotations from viewer's perspective | REQ-NAV-006, SCN-NAV-006-01, SCN-NAV-006-02 |
| SC-NAV-007 | Friends management accessible but not primary tab | REQ-NAV-007 |
| SC-SOCIAL-001 | Social annotations on own pins (memory + dream tabs) | REQ-SOCIAL-001, SCN-SOCIAL-001-01, SCN-SOCIAL-001-02 |
| SC-SOCIAL-002 | Travel Together view surfaces shared dream matches | REQ-SOCIAL-002, SCN-SOCIAL-002-01 |
| SC-SOCIAL-003 | "Interested" creates independent inspired copy with attribution | REQ-SOCIAL-003, SCN-SOCIAL-003-01 |
| SC-SOCIAL-004 | Original user notified in-app when friend creates inspired pin | REQ-SOCIAL-004 |
| SC-SOCIAL-005 | Friends can view user's memory pins | REQ-SOCIAL-005 |
| SC-SOLO-001 | App rewarding with zero friends and zero content; voice-first day-1 | REQ-SOLO-001 |
| SC-SOLO-002 | Every empty state has illustration/gradient, first-person prompt, CTA button | REQ-SOLO-002, SCN-SOLO-002-01 |
| SC-SOLO-003 | Core loop compelling without social features | REQ-SOLO-003 |
| SC-NOTIF-001 | Badge + chronological list + inline highlight; interest + inspired notifications | REQ-NOTIF-001, SCN-NOTIF-001-01 |
| SC-LOCATION-001 | Free-form location input, no dropdown hierarchy | REQ-LOCATION-001 |
| SC-LOCATION-002 | AI normalizes location behind the scenes; region-based matching | REQ-LOCATION-002, SCN-LOCATION-002-01 |
| SC-LOCATION-003 | Low-confidence normalization: pin created, "unverified" indicator, excluded from matching | REQ-LOCATION-003, SCN-LOCATION-003-01 |
| SC-DISCOVERY-001 | "Sarah has been to Tokyo" on dream pins (contextual friend discovery) | REQ-DISCOVERY-001 |
| SC-DISCOVERY-002 | "3 friends dream of visiting Patagonia" on memory pins | REQ-DISCOVERY-002 |

---

## Section 1: Overview & Architecture

Travel Together is a visual travel memory and aspiration platform. Users record travel memories via voice input (AI-structured into beautiful cards) and curate a visual pinboard of dream destinations. Social discovery emerges naturally: friends see overlapping interests and express shared travel aspirations.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7 (SPA) |
| Backend | Express 5, Node.js |
| Database | PostgreSQL |
| Voice Transcription | OpenAI Whisper API (server-side) |
| AI Structuring & Location | Anthropic Claude API (server-side) |
| Dream Imagery | Unsplash API |
| Image Upload Storage | Cloudinary (free tier) |
| Auth | JWT (7-day expiry) + Google OAuth |

### Key Architectural Decisions

1. **Tab Switcher SPA**: Two primary views (PAST / FUTURE) with instant client-side switching. No page reloads. Memory board IS the user's profile -- no separate profile page.
2. **Free-form Location with AI Normalization**: Users type natural language ("that little fishing village outside Porto"). Claude normalizes to structured data behind the scenes. No country/city dropdowns ever.
3. **Voice-First Creation**: Primary pin creation path is voice recording -> Whisper transcription -> Claude structuring -> user review -> save. Manual text entry is the fallback, not the primary path.
4. **Clean Slate Schema**: All old tables (`country_visits`, `city_visits`, `country_wishlist`, `country_profiles`, `trip_proposals`, `user_travel_profiles`, `city_experiences`) are dropped. New schema from scratch. Existing tables retained: `users`, `friendships`, `password_reset_tokens`.
5. **Unified Pin Model**: Both memories and dreams are rows in a single `pins` table differentiated by `pin_type` enum. This simplifies queries, indexing, and the social matching layer.

### External Services

| Service | Purpose | Auth |
|---------|---------|------|
| OpenAI Whisper API | Speech-to-text transcription | `OPENAI_API_KEY` env var |
| Anthropic Claude API | Transcript structuring, location normalization | `ANTHROPIC_API_KEY` env var (already configured) |
| Unsplash API | Auto-fetch dream pin imagery by destination | `UNSPLASH_ACCESS_KEY` env var |
| Cloudinary | User-uploaded photo storage (memory signature photos) | `CLOUDINARY_URL` env var |

---

## Section 2: Data Model

### Retained Tables (no changes)

**`users`** -- existing schema + Google OAuth fields from migration 007:

| Column | Type | Constraints |
|--------|------|------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| username | VARCHAR(50) | UNIQUE NOT NULL |
| display_name | VARCHAR(100) | NOT NULL |
| password_hash | VARCHAR(255) | NOT NULL (empty string for Google-only users) |
| google_id | VARCHAR(255) | UNIQUE, nullable |
| avatar_url | TEXT | nullable |
| auth_provider | VARCHAR(50) | DEFAULT 'local' |
| created_at | TIMESTAMP | DEFAULT NOW() |

**`friendships`** -- no changes.

**`password_reset_tokens`** -- no changes.

### New Tables

<!-- REQ-MEMORY-001: satisfies SC-MEMORY-001, SC-DREAM-001 -->
#### `pins`

The unified table for both memory and dream pins.

```sql
CREATE TYPE pin_type AS ENUM ('memory', 'dream');

CREATE TABLE pins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_type              pin_type NOT NULL,

  -- Location (free-form + normalized)
  place_name            TEXT NOT NULL,                    -- user's free-form text, always preserved
  normalized_city       TEXT,                             -- AI-normalized city name
  normalized_country    TEXT,                             -- AI-normalized country name
  normalized_region     TEXT,                             -- AI-normalized region (for matching)
  latitude              DOUBLE PRECISION,
  longitude             DOUBLE PRECISION,
  location_confidence   VARCHAR(10) CHECK (location_confidence IN ('high', 'medium', 'low')),
  location_verified     BOOLEAN NOT NULL DEFAULT false,

  -- Content
  ai_summary            TEXT,                             -- AI-structured summary
  note                  TEXT,                             -- user's manual note
  transcript            TEXT,                             -- verbatim voice transcript (original)
  correction_transcript TEXT,                             -- re-record correction transcript

  -- Media
  photo_url             TEXT,                             -- user-uploaded photo (Cloudinary URL) or extension-selected image
  photo_source          VARCHAR(20) CHECK (photo_source IN ('upload', 'extension', 'unsplash')),
  unsplash_image_url    TEXT,                             -- Unsplash auto-fetched image for dreams
  unsplash_attribution  TEXT,                             -- Unsplash photographer attribution (required by API TOS)

  -- Memory-specific fields
  visit_year            INTEGER CHECK (visit_year BETWEEN 1900 AND 2100),
  rating                INTEGER CHECK (rating BETWEEN 1 AND 5),  -- 1-5 hearts

  -- Dream-specific fields
  dream_note            TEXT,                             -- "why I want to go" note
  archived              BOOLEAN NOT NULL DEFAULT false,   -- true when dream "marked as visited"

  -- Social / inspired-by fields
  inspired_by_pin_id    UUID,                             -- original pin this was inspired from (nullable, NOT a FK -- survives deletion)
  inspired_by_user_id   UUID,                             -- original user who owned the inspiring pin (nullable, NOT a FK)
  inspired_by_display_name TEXT,                          -- snapshot of display name at time of inspiration (survives account deletion)

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pins_user_id ON pins(user_id);
CREATE INDEX idx_pins_user_type ON pins(user_id, pin_type);
CREATE INDEX idx_pins_normalized_region ON pins(normalized_region) WHERE normalized_region IS NOT NULL;
CREATE INDEX idx_pins_location_verified ON pins(location_verified);
CREATE INDEX idx_pins_created_at ON pins(created_at DESC);
```

**Design decisions:**
- `inspired_by_pin_id` and `inspired_by_user_id` are intentionally NOT foreign keys. Per SC-SOCIAL-003, inspired pins are independent copies that survive original pin/user deletion.
- `inspired_by_display_name` is a snapshot: if the original user deletes their account, the system writes `'a fellow traveler'` into this field for all their inspired pins (via a trigger or application-level ON DELETE handler).
- `location_verified` defaults to false. Set to true when `location_confidence` is `'high'` or `'medium'`, or when user manually confirms via "Help us find this place" flow.
- `archived` is only meaningful for dream pins. Archived dreams are hidden from the board by default but not deleted.

<!-- REQ-MEMORY-003: satisfies SC-MEMORY-003 -->
#### `experience_tags` (seed data)

The 16 fixed taxonomy tags.

```sql
CREATE TABLE experience_tags (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(50) NOT NULL UNIQUE,
  emoji           VARCHAR(10) NOT NULL,
  description     TEXT NOT NULL,
  gradient_start  VARCHAR(7) NOT NULL,    -- hex color for fallback gradient start
  gradient_end    VARCHAR(7) NOT NULL,    -- hex color for fallback gradient end
  sort_order      INTEGER NOT NULL UNIQUE
);
```

Seed data (see Section 9 for full definitions).

#### `custom_tags`

User-created tags outside the fixed 16.

```sql
CREATE TABLE custom_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(50) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_custom_tags_user ON custom_tags(user_id);
```

#### `pin_tags`

Junction table linking pins to experience tags (fixed or custom).

```sql
CREATE TABLE pin_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  experience_tag_id INTEGER REFERENCES experience_tags(id) ON DELETE CASCADE,
  custom_tag_id   UUID REFERENCES custom_tags(id) ON DELETE CASCADE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT chk_tag_type CHECK (
    (experience_tag_id IS NOT NULL AND custom_tag_id IS NULL)
    OR (experience_tag_id IS NULL AND custom_tag_id IS NOT NULL)
  )
);

CREATE INDEX idx_pin_tags_pin ON pin_tags(pin_id);
CREATE INDEX idx_pin_tags_experience ON pin_tags(experience_tag_id);
CREATE INDEX idx_pin_tags_custom ON pin_tags(custom_tag_id);
```

<!-- REQ-DREAM-001: satisfies SC-DREAM-001 (inspiration_resources) -->
#### `pin_resources`

Inspiration resources attached to dream pins (populated by Chrome extension or manual link-add).

```sql
CREATE TABLE pin_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  source_url      TEXT NOT NULL,
  domain_name     VARCHAR(255) NOT NULL,
  photo_url       TEXT,
  excerpt         VARCHAR(280),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pin_resources_pin ON pin_resources(pin_id);
```

Constraint: max 10 resources per pin (enforced at application level).

<!-- REQ-PROFILE-001: satisfies SC-PROFILE-001 -->
#### `top_pins`

Ordered Top 8 for each user per tab. Server-persisted order.

```sql
CREATE TABLE top_pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pin_id          UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  tab             pin_type NOT NULL,                     -- 'memory' or 'dream'
  sort_order      INTEGER NOT NULL,                      -- 0-7 position
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, pin_id),
  UNIQUE(user_id, tab, sort_order)
);

CREATE INDEX idx_top_pins_user_tab ON top_pins(user_id, tab);
```

Constraint: max 8 rows per (user_id, tab) -- enforced at application level.

<!-- REQ-NOTIF-001: satisfies SC-NOTIF-001 -->
#### `notifications`

In-app notification store.

```sql
CREATE TYPE notification_type AS ENUM ('interest', 'inspired');

CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- recipient
  actor_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,   -- who triggered it
  notification_type notification_type NOT NULL,
  pin_id          UUID REFERENCES pins(id) ON DELETE CASCADE,             -- the pin that triggered it
  read            BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at DESC);
```

Notification types and display text:
- `inspired`: Display text template: "**[actor.displayName]** saved a dream inspired by your **[pin.placeName]** pin". This single type covers both "X expressed interest in your dream" and "X created a dream inspired by yours" from SC-NOTIF-001 -- in v1 the action of expressing interest IS creating an inspired pin, so they are unified.
- `interest`: **Reserved for future use.** Will be used when a lightweight "express interest without copying" feature is added. Not created by any v1 flow.

<!-- REQ-NAV-004: satisfies SC-NAV-004 -->
#### `user_preferences`

Server-side user preferences for tab memory and future settings.

```sql
CREATE TABLE user_preferences (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_tab        pin_type NOT NULL DEFAULT 'memory',    -- 'memory' or 'dream'
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tables to Drop

The following tables from migrations 002-004 and 008 are no longer used:

- `country_visits`
- `city_visits`
- `country_wishlist`
- `country_profiles`
- `user_travel_profiles`
- `trip_proposals`
- `city_experiences`

A new migration (`009_refactor.sql`) will drop these tables and create all new tables above.

---

## Section 3: API Endpoints

All responses follow the existing convention: `{ success: boolean, data?: any, error?: string }`.

All authenticated endpoints require `Authorization: Bearer <JWT>` header. Return `401` if missing or invalid.

### Auth Endpoints (retained, no changes)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | No | Existing |
| POST | `/api/auth/login` | No | Existing |
| GET | `/api/auth/me` | Yes | Existing |
| PUT | `/api/auth/me` | Yes | Existing |
| POST | `/api/auth/forgot-password` | No | Existing |
| POST | `/api/auth/reset-password` | No | Existing |
| POST | `/api/auth/google` | No | Existing |

### Friends Endpoints (retained, modified)

Existing endpoints retained as-is. The `GET /api/friends` response shape changes to remove `totalCountries` (table dropped) and add pin counts:

**`GET /api/friends`** -- list accepted friends
<!-- REQ-NAV-007: satisfies SC-NAV-007 -->

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "sarah_j",
      "displayName": "Sarah Jones",
      "avatarUrl": "https://...",
      "friendshipId": "uuid",
      "memoryCount": 12,
      "dreamCount": 8
    }
  ]
}
```

All other friends endpoints (`POST /request`, `GET /pending`, `POST /accept/:id`, `DELETE /:id`) remain unchanged.

---

### Pin Endpoints

<!-- REQ-MEMORY-001: satisfies SC-MEMORY-001 -->
<!-- REQ-DREAM-001: satisfies SC-DREAM-001 -->
#### `POST /api/pins` -- Create a pin

Auth: Yes

Request body:
```json
{
  "pinType": "memory",
  "placeName": "that little fishing village outside Porto",
  "note": "Best sunset of my life",
  "aiSummary": "A magical evening in Afurada...",
  "transcript": "So we were in this tiny village...",
  "correctionTranscript": null,
  "photoUrl": "https://res.cloudinary.com/...",
  "photoSource": "upload",
  "visitYear": 2024,
  "rating": 5,
  "dreamNote": null,
  "tags": [
    { "experienceTagId": 2 },
    { "experienceTagId": 4 },
    { "customTagName": "Sunsets" }
  ],
  "inspiredByPinId": null,
  "inspiredByUserId": null,
  "inspiredByDisplayName": null
}
```

Required fields: `pinType`, `placeName`.
All other fields are optional.

Server behavior:
1. Create pin row in `pins` table.
2. Call Claude location normalization for `placeName` (async, non-blocking -- pin is created immediately with `location_verified: false`). Update pin with normalized data when response arrives. If confidence is `'high'` or `'medium'`, set `location_verified: true`. If confidence is `'low'`, leave `location_verified: false` (pin shows "location unverified" indicator and does not participate in matching).
3. For each tag in `tags` array: if `experienceTagId` provided, insert `pin_tags` row referencing it. If `customTagName` provided, find-or-create in `custom_tags`, then insert `pin_tags` row.
4. If `pinType === 'dream'` and no `photoUrl` provided, fetch Unsplash image by `placeName`. Store `unsplash_image_url` and `unsplash_attribution` on the pin.
5. Return created pin with all related data.

Response (201):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "pinType": "memory",
    "placeName": "that little fishing village outside Porto",
    "normalizedCity": null,
    "normalizedCountry": null,
    "normalizedRegion": null,
    "locationVerified": false,
    "aiSummary": "A magical evening in Afurada...",
    "note": "Best sunset of my life",
    "transcript": "So we were in this tiny village...",
    "correctionTranscript": null,
    "photoUrl": "https://res.cloudinary.com/...",
    "photoSource": "upload",
    "unsplashImageUrl": null,
    "unsplashAttribution": null,
    "visitYear": 2024,
    "rating": 5,
    "dreamNote": null,
    "archived": false,
    "inspiredByPinId": null,
    "inspiredByUserId": null,
    "inspiredByDisplayName": null,
    "tags": [
      { "id": 2, "name": "Food & Drink", "emoji": "\ud83c\udf5c", "type": "experience" },
      { "id": 4, "name": "Beach & Water", "emoji": "\ud83c\udf0a", "type": "experience" },
      { "id": "uuid", "name": "Sunsets", "type": "custom" }
    ],
    "resources": [],
    "createdAt": "2026-03-29T12:00:00Z",
    "updatedAt": "2026-03-29T12:00:00Z"
  }
}
```

Error responses:
- 400: `{ "success": false, "error": "pinType and placeName are required" }`
- 400: `{ "success": false, "error": "pinType must be 'memory' or 'dream'" }`

---

<!-- REQ-MEMORY-004: satisfies SC-MEMORY-004 -->
<!-- REQ-DREAM-004: satisfies SC-DREAM-004 -->
#### `GET /api/pins` -- List pins

Auth: Yes

Query params:
- `type` (required): `'memory'` | `'dream'`
- `userId` (optional): UUID -- if provided, fetch pins for that user (subject to visibility rules). If omitted, fetch current user's pins.
- `tag` (optional): experience tag ID -- filter to pins with this tag
- `search` (optional): free-text search against `place_name`
- `limit` (optional, default 50): max results
- `offset` (optional, default 0): pagination offset

Visibility rules:
- Own pins: return all (including archived dreams if `includeArchived=true`)
- Friend's pins: return all non-archived
- Non-friend's pins: return only Top 8 pins for that tab

Response:
```json
{
  "success": true,
  "data": {
    "pins": [
      {
        "id": "uuid",
        "pinType": "memory",
        "placeName": "...",
        "normalizedRegion": "Porto Region",
        "locationVerified": true,
        "aiSummary": "...",
        "note": "...",
        "transcript": "...",
        "photoUrl": "...",
        "unsplashImageUrl": null,
        "unsplashAttribution": null,
        "visitYear": 2024,
        "rating": 5,
        "archived": false,
        "tags": [ { "id": 2, "name": "Food & Drink", "emoji": "\ud83c\udf5c", "type": "experience" } ],
        "resources": [],
        "isTop8": true,
        "top8Order": 0,
        "inspiredByDisplayName": null,
        "createdAt": "2026-03-29T12:00:00Z"
      }
    ],
    "total": 42,
    "memoryCount": 30,
    "dreamCount": 12
  }
}
```

---

#### `GET /api/pins/:id` -- Get single pin

Auth: Yes

Same visibility rules as list. Includes full `resources` array and `tags`.

Response shape matches a single item from the list response above with full detail.

Error responses:
- 404: `{ "success": false, "error": "Pin not found" }`
- 403: `{ "success": false, "error": "Not authorized to view this pin" }`

---

#### `PUT /api/pins/:id` -- Update a pin

Auth: Yes (must be pin owner)

Request body (all fields optional -- only provided fields are updated):
```json
{
  "placeName": "Afurada, Porto",
  "note": "Updated note",
  "aiSummary": "Updated summary",
  "photoUrl": "https://...",
  "photoSource": "upload",
  "visitYear": 2024,
  "rating": 4,
  "dreamNote": "Updated dream note",
  "archived": true,
  "tags": [
    { "experienceTagId": 2 },
    { "customTagName": "Sunsets" }
  ],
  "locationVerified": true,
  "normalizedCity": "Afurada",
  "normalizedCountry": "Portugal",
  "normalizedRegion": "Porto Metropolitan Area",
  "latitude": 41.138,
  "longitude": -8.6455,
  "locationConfidence": "high"
}
```

Location fields (`locationVerified`, `normalizedCity`, `normalizedCountry`, `normalizedRegion`, `latitude`, `longitude`, `locationConfidence`) are optional. These are set during the "Help us find this place" user-initiated confirmation flow (see below).

**Note:** Location normalization backfill (server-side async during pin creation) uses an internal DB update, not this endpoint. This endpoint handles user-initiated updates only.

If `placeName` changes, re-trigger location normalization.
If `tags` provided, replace all existing tags (delete old `pin_tags`, insert new ones).

**"Help us find this place" confirmation flow sequence:**
1. User taps "Help us find this place" on an unverified pin (a pin with `location_verified: false`).
2. Frontend calls `POST /api/location/normalize` with refined place text (user's clarification or the original `placeName`).
3. User reviews and confirms the normalized result (city, country, region on a confirmation UI).
4. Frontend calls `PUT /api/pins/:id` with `locationVerified: true` plus the normalized fields returned in step 2 (`normalizedCity`, `normalizedCountry`, `normalizedRegion`, `latitude`, `longitude`, `locationConfidence`).
5. Pin now participates in friend matching (since `location_verified` is `true`).

Response: full updated pin (same shape as GET).

Error responses:
- 403: `{ "success": false, "error": "Not authorized to edit this pin" }`
- 404: `{ "success": false, "error": "Pin not found" }`

---

#### `DELETE /api/pins/:id` -- Delete a pin

Auth: Yes (must be pin owner)

Server behavior:
1. Delete pin (cascades to `pin_tags`, `pin_resources`, `top_pins`).
2. For any `pins` rows where `inspired_by_pin_id` matches the deleted pin: leave them as-is (the `inspired_by_display_name` snapshot persists per SC-SOCIAL-003).

Response: `{ "success": true }`

---

### Tag Endpoints

<!-- REQ-MEMORY-003: satisfies SC-MEMORY-003 -->
#### `GET /api/tags` -- List all tags

Auth: Yes

Response:
```json
{
  "success": true,
  "data": {
    "experienceTags": [
      { "id": 1, "name": "Nature & Wildlife", "emoji": "\ud83c\udfde\ufe0f", "description": "...", "gradientStart": "#2D5016", "gradientEnd": "#4A7C23" }
    ],
    "customTags": [
      { "id": "uuid", "name": "Sunsets" }
    ]
  }
}
```

`experienceTags` returns all 16 fixed tags (available to everyone).
`customTags` returns only the current user's custom tags.

---

#### `POST /api/tags/custom` -- Create custom tag

Auth: Yes

Request body:
```json
{ "name": "Birdwatching" }
```

Response (201):
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Birdwatching" }
}
```

Error responses:
- 400: `{ "success": false, "error": "Tag name is required" }`
- 409: `{ "success": false, "error": "Tag already exists" }`

---

### Pin Resources Endpoints

<!-- REQ-DREAM-001: satisfies SC-DREAM-001 (inspiration_resources) -->
#### `POST /api/pins/:id/resources` -- Add inspiration resource

Auth: Yes (must be pin owner, pin must be dream type)

Request body:
```json
{
  "sourceUrl": "https://example.com/article",
  "domainName": "example.com",
  "photoUrl": "https://example.com/photo.jpg",
  "excerpt": "A stunning beachside village..."
}
```

Server checks: pin must have < 10 existing resources.

Response (201):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "sourceUrl": "https://example.com/article",
    "domainName": "example.com",
    "photoUrl": "https://example.com/photo.jpg",
    "excerpt": "A stunning beachside village...",
    "sortOrder": 2,
    "createdAt": "2026-03-29T12:00:00Z"
  }
}
```

Error responses:
- 400: `{ "success": false, "error": "Maximum 10 resources per pin" }`
- 403: `{ "success": false, "error": "Not authorized" }`

---

#### `DELETE /api/pins/:id/resources/:resourceId` -- Remove resource

Auth: Yes (must be pin owner)

Response: `{ "success": true }`

---

### Top 8 Endpoints

<!-- REQ-PROFILE-001: satisfies SC-PROFILE-001 -->
#### `GET /api/pins/top` -- Get user's Top 8

Auth: Yes

Query params:
- `userId` (optional): UUID -- defaults to current user
- `tab` (required): `'memory'` | `'dream'`

Response:
```json
{
  "success": true,
  "data": [
    {
      "sortOrder": 0,
      "pin": { "id": "uuid", "pinType": "memory", "placeName": "...", "...": "..." }
    }
  ]
}
```

---

#### `PUT /api/pins/top` -- Set Top 8 (full replacement)

Auth: Yes

Request body:
```json
{
  "tab": "memory",
  "pinIds": ["uuid1", "uuid2", "uuid3"]
}
```

`pinIds` is an ordered array (index = `sort_order`). Maximum 8 items. Pins must belong to current user and match the specified `tab` type.

Server behavior:
1. Validate all pin IDs belong to current user and have correct `pin_type`.
2. Validate array length <= 8.
3. Delete existing `top_pins` rows for this `(user_id, tab)`.
4. Insert new rows with `sort_order` matching array index.

Response:
```json
{ "success": true, "data": { "count": 3 } }
```

Error responses:
- 400: `{ "success": false, "error": "Maximum 8 pins in Top 8" }`
- 400: `{ "success": false, "error": "Pin {id} does not belong to you or does not match tab type" }`

---

### Voice Pipeline Endpoints

<!-- REQ-VOICE-006: satisfies SC-VOICE-006 -->
#### `POST /api/voice/transcribe` -- Transcribe audio via Whisper

Auth: Yes

Request: `multipart/form-data` with field `audio` (WAV or WebM blob, max 25MB per Whisper API limits).

Server behavior:
1. Receive audio file from multipart upload.
2. Forward to OpenAI Whisper API (`POST https://api.openai.com/v1/audio/transcriptions` with model `whisper-1`).
3. Return transcript text.

Response:
```json
{
  "success": true,
  "data": {
    "transcript": "So we were in this tiny village outside Porto and the sunset was absolutely incredible..."
  }
}
```

Error responses:
- 400: `{ "success": false, "error": "No audio file provided" }`
- 413: `{ "success": false, "error": "Audio file too large (max 25MB)" }`
- 502: `{ "success": false, "error": "Transcription service unavailable", "stage": "transcription" }`

<!-- REQ-VOICE-003: satisfies SC-VOICE-003 -->
#### `POST /api/voice/structure` -- AI-structure transcript via Claude

Auth: Yes

Request body:
```json
{
  "transcript": "So we were in this tiny village outside Porto...",
  "correctionTranscript": null,
  "existingTags": ["Nature & Wildlife", "Food & Drink"],
  "context": "memory"
}
```

`context` is `'memory'` or `'dream'` -- affects Claude's prompt framing.
`existingTags` is the user's previously used tags (helps Claude prefer consistency).
`correctionTranscript` is optional -- if provided, Claude incorporates both transcripts.

Server behavior:
1. Build Claude prompt (see below).
2. Call Claude API.
3. Parse JSON response.
4. Return proposed structure.

Claude prompt template:
```
You are helping a user organize their travel {context === 'memory' ? 'memory' : 'dream'}.

They recorded this voice memo:
"{transcript}"

{correctionTranscript ? `They then added this correction: "${correctionTranscript}"` : ''}

Extract and propose:
1. place_name: The specific place mentioned (use the user's natural language, e.g., "that little fishing village outside Porto")
2. tags: Up to 3 tags from ONLY this list: [Nature & Wildlife, Food & Drink, Culture & History, Beach & Water, Outdoor Adventure, Winter Sports, Sports, Nightlife & Music, Architecture & Streets, Wellness & Slow Travel, Arts & Creativity, People & Connections, Epic Journeys, Shopping & Markets, Festivals & Special Events, Photography]. If no tag clearly fits, return an empty array.
3. summary: A 2-3 sentence polished summary capturing the essence of their experience. Preserve the user's voice and emotion while making it concise.

The user has previously used these tags: [{existingTags}]. Prefer consistency when relevant.

Return ONLY valid JSON:
{
  "place_name": "...",
  "tags": ["Tag1", "Tag2"],
  "summary": "...",
  "confidence": 0.85
}

"confidence" is 0.0-1.0 representing how confident you are in the extraction overall.
```

Response:
```json
{
  "success": true,
  "data": {
    "placeName": "that little fishing village outside Porto",
    "tags": ["Beach & Water", "Food & Drink"],
    "summary": "A magical evening watching the sunset over the Douro River from a tiny fishing village near Porto. The golden light painted the colorful houses while local fishermen brought in their catch.",
    "confidence": 0.92
  }
}
```

Error responses:
- 400: `{ "success": false, "error": "Transcript is required" }`
- 502: `{ "success": false, "error": "AI structuring service unavailable", "stage": "structuring" }`

---

### Location Normalization Endpoint

<!-- REQ-LOCATION-002: satisfies SC-LOCATION-002 -->
#### `POST /api/location/normalize` -- Normalize free-form location

Auth: Yes

Request body:
```json
{ "placeName": "that little fishing village outside Porto" }
```

Server behavior:
1. Call Claude API with normalization prompt (see Section 6).
2. Return structured location data.

Response:
```json
{
  "success": true,
  "data": {
    "displayName": "that little fishing village outside Porto",
    "normalizedCity": "Afurada",
    "normalizedCountry": "Portugal",
    "normalizedRegion": "Porto Metropolitan Area",
    "latitude": 41.1380,
    "longitude": -8.6455,
    "confidence": "high"
  }
}
```

Error responses:
- 400: `{ "success": false, "error": "placeName is required" }`
- 502: `{ "success": false, "error": "Location normalization service unavailable" }`

Note: This endpoint is called automatically by the server during pin creation. It is also available as a standalone endpoint for the "Help us find this place" clarification flow (SC-LOCATION-003).

---

### Social Endpoints

<!-- REQ-SOCIAL-003: satisfies SC-SOCIAL-003 -->
#### `POST /api/social/inspire/:pinId` -- Create inspired dream pin

Auth: Yes

The `pinId` is the original dream pin the user is inspired by. The authenticated user must be a friend of the pin's owner.

Server behavior:
1. Validate friendship.
2. Create new dream pin for the current user with:
   - `place_name` copied from original
   - `inspired_by_pin_id` = original pin ID
   - `inspired_by_user_id` = original pin's user ID
   - `inspired_by_display_name` = original user's current display name
   - Tags copied from original
   - Unsplash image fetched fresh (or copied if available)
3. Create notification for the original pin's owner (type: `'inspired'`).
4. Return the new pin.

Response (201):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "pinType": "dream",
    "placeName": "Patagonia",
    "inspiredByDisplayName": "Sarah Jones",
    "tags": [],
    "createdAt": "2026-03-29T12:00:00Z"
  }
}
```

Error responses:
- 403: `{ "success": false, "error": "Must be friends to be inspired by this pin" }`
- 404: `{ "success": false, "error": "Pin not found" }`

---

<!-- REQ-SOCIAL-001: satisfies SC-SOCIAL-001 -->
<!-- REQ-DISCOVERY-001: satisfies SC-DISCOVERY-001 -->
<!-- REQ-DISCOVERY-002: satisfies SC-DISCOVERY-002 -->
#### `GET /api/social/annotations` -- Get social annotations for user's pins

Auth: Yes

Query params:
- `tab` (required): `'memory'` | `'dream'`

This endpoint computes friend overlaps for the authenticated user's pins.

Server behavior:
1. Get all the user's pins of the specified type.
2. Get all friends' pins.
3. For each of the user's pins with a `normalized_region`:
   - **Memory tab**: count friends with dream pins in the same region -> "X friends dream of visiting here"
   - **Dream tab**: count friends with memory pins in the same region -> "X friends have been here" + list names. Count friends with dream pins in the same region -> "X friends also dream of this"
4. Return a map of pin_id -> annotations.

Response:
```json
{
  "success": true,
  "data": {
    "pin-uuid-1": {
      "friendsDreamingCount": 3,
      "friendsDreaming": ["Sarah", "Mike", "Alex"]
    },
    "pin-uuid-2": {
      "friendsBeenCount": 2,
      "friendsBeen": [
        { "id": "user-uuid", "displayName": "Sarah", "pinId": "their-pin-uuid" }
      ],
      "friendsDreamingCount": 1,
      "friendsDreaming": ["Alex"]
    }
  }
}
```

---

<!-- REQ-NAV-006: satisfies SC-NAV-006 -->
#### `GET /api/social/annotations/:userId` -- Get cross-annotations for viewing a friend's board

Auth: Yes

Query params:
- `tab` (required): `'memory'` | `'dream'`

This computes annotations from the viewer's (authenticated user's) perspective when viewing another user's board.

Server behavior:
1. Verify friendship between authenticated user and `userId`.
2. Get `userId`'s pins of the specified type.
3. Get the authenticated user's pins.
4. For each of their pins with a `normalized_region`:
   - **Viewing friend's PAST tab**: check if viewer has dream pins in same region -> "You dream of visiting here!"
   - **Viewing friend's FUTURE tab**: check if viewer has memory pins in same region -> "You've been here!" Also check viewer's dream pins -> "You dream of this too!"
5. Return map.

Response:
```json
{
  "success": true,
  "data": {
    "their-pin-uuid-1": {
      "viewerDreams": true,
      "viewerDreamPinId": "my-dream-uuid"
    },
    "their-pin-uuid-2": {
      "viewerHasBeen": true,
      "viewerMemoryPinId": "my-memory-uuid",
      "viewerAlsoDreams": false
    }
  }
}
```

Error responses:
- 403: `{ "success": false, "error": "Must be friends to view annotations" }`

---

<!-- REQ-SOCIAL-002: satisfies SC-SOCIAL-002 -->
#### `GET /api/social/travel-together` -- Shared dream matches

Auth: Yes

Returns destinations/regions where the authenticated user AND at least one friend both have dream pins.

Response:
```json
{
  "success": true,
  "data": [
    {
      "region": "Patagonia",
      "myPin": { "id": "uuid", "placeName": "Torres del Paine" },
      "friends": [
        { "id": "user-uuid", "displayName": "Sarah", "pinPlaceName": "El Chalten" }
      ]
    }
  ]
}
```

---

### Notification Endpoints

<!-- REQ-NOTIF-001: satisfies SC-NOTIF-001 -->
#### `GET /api/notifications` -- List notifications

Auth: Yes

Query params:
- `limit` (optional, default 20)
- `offset` (optional, default 0)

Response:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "type": "inspired",
        "actor": { "id": "uuid", "displayName": "Sarah Jones", "avatarUrl": "..." },
        "pin": { "id": "uuid", "placeName": "Patagonia" },
        "read": false,
        "createdAt": "2026-03-29T12:00:00Z"
      }
    ],
    "unreadCount": 3
  }
}
```

---

#### `PUT /api/notifications/read` -- Mark notifications as read

Auth: Yes

Request body:
```json
{ "notificationIds": ["uuid1", "uuid2"] }
```

Pass empty array or `{ "all": true }` to mark all as read.

Response: `{ "success": true }`

---

### User Preferences Endpoints

<!-- REQ-NAV-004: satisfies SC-NAV-004 -->
#### `GET /api/users/preferences` -- Get user preferences

Auth: Yes

Response:
```json
{
  "success": true,
  "data": { "lastTab": "memory" }
}
```

---

#### `PUT /api/users/preferences` -- Update user preferences

Auth: Yes

Request body:
```json
{ "lastTab": "dream" }
```

Response: `{ "success": true, "data": { "lastTab": "dream" } }`

---

### Search Endpoint

<!-- REQ-NAV-005: satisfies SC-NAV-005 -->
#### `GET /api/search/users` -- Search users

Auth: Yes

Query params:
- `q` (required): search string (matched against `display_name` and `username`, case-insensitive, prefix match)
- `limit` (optional, default 20)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "username": "sarah_j",
      "displayName": "Sarah Jones",
      "avatarUrl": "https://...",
      "memoryCount": 12,
      "dreamCount": 8,
      "topTags": [
        { "name": "Food & Drink", "emoji": "\ud83c\udf5c" },
        { "name": "Beach & Water", "emoji": "\ud83c\udf0a" },
        { "name": "Culture & History", "emoji": "\ud83c\udfef" }
      ],
      "isFriend": true
    }
  ]
}
```

`topTags` is the user's 3 most-used experience tags across all their pins.

SQL approach for search:
```sql
SELECT u.id, u.username, u.display_name, u.avatar_url
FROM users u
WHERE (u.display_name ILIKE $1 || '%' OR u.username ILIKE $1 || '%')
  AND u.id != $2
ORDER BY u.display_name
LIMIT $3
```

---

### Image Upload Endpoint

#### `POST /api/upload` -- Upload image to Cloudinary

Auth: Yes

Request: `multipart/form-data` with field `image` (JPEG, PNG, WebP; max 10MB).

Server behavior:
1. Validate file type and size.
2. Upload to Cloudinary with transformation: max 1200px width, auto quality.
3. Return Cloudinary URL.

Response:
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/travel-together/image/upload/v1234/pins/abc123.jpg"
  }
}
```

Error responses:
- 400: `{ "success": false, "error": "No image file provided" }`
- 400: `{ "success": false, "error": "File must be JPEG, PNG, or WebP" }`
- 413: `{ "success": false, "error": "Image too large (max 10MB)" }`

---

### Dream Conversion Endpoint

<!-- REQ-DREAM-005: satisfies SC-DREAM-005 -->
#### `POST /api/pins/:id/convert` -- "I went!" dream-to-memory conversion

Auth: Yes (must be pin owner, pin must be dream type)

Request body:
```json
{
  "keepDream": true
}
```

This endpoint returns the dream pin's data pre-populated for creating a memory. The actual memory is created via the normal `POST /api/pins` endpoint. This endpoint only handles the dream pin's fate.

Server behavior:
1. If `keepDream` is false, set `archived: true` on the dream pin.
2. Return the dream pin's data formatted for memory creation (pre-filled fields).

Response:
```json
{
  "success": true,
  "data": {
    "prefilled": {
      "pinType": "memory",
      "placeName": "Patagonia",
      "tags": [
        { "experienceTagId": 1 },
        { "experienceTagId": 5 }
      ]
    },
    "dreamArchived": false
  }
}
```

---

## Section 4: Frontend Architecture

### Route Structure

```
/                       -> Board (own profile, PAST|FUTURE tabs)
/login                  -> Login
/register               -> Register
/forgot-password        -> ForgotPassword
/reset-password         -> ResetPassword
/user/:userId           -> Board (viewing another user's profile)
/user/:userId/past      -> Board (deep link to PAST tab)
/user/:userId/future    -> Board (deep link to FUTURE tab)
/friends                -> FriendsManagement
/travel-together        -> TravelTogether (shared dreams)
/settings               -> Settings
```

Deep link routes (`/past`, `/future` suffixes) override tab memory for that session per SC-NAV-004.

### Key Components

| Component | Purpose | SC-* |
|-----------|---------|------|
| `Board` | Main view: tab switcher + Top 8 + All pins grid | SC-NAV-001, SC-NAV-002, SC-NAV-003 |
| `TabSwitcher` | PAST / FUTURE toggle, instant switch | SC-NAV-001, SC-NAV-003 |
| `PinCard` | Visual card for a single pin (memory or dream) | SC-MEMORY-002, SC-DREAM-002 |
| `PinBoard` | Masonry grid layout of PinCards | SC-MEMORY-004, SC-DREAM-003 |
| `Top8Board` | Ordered 1-8 featured pins with drag-reorder | SC-PROFILE-001 |
| `VoiceCapture` | Audio recording button + waveform indicator | SC-VOICE-001 |
| `VoiceReview` | Transcript display + AI proposal review + edit fields | SC-VOICE-004 |
| `MemoryPinCreator` | Full memory creation flow (voice or manual) | SC-MEMORY-001, SC-VOICE-005 |
| `DreamPinCreator` | Dream pin creation form | SC-DREAM-001 |
| `DreamConvert` | "I went!" flow with voice/quick-add choice | SC-DREAM-005 |
| `SearchView` | User search bar + results list | SC-NAV-005 |
| `FriendAnnotation` | Social badge on pin cards (friends dreaming/been) | SC-SOCIAL-001 |
| `NotificationBell` | Badge icon + dropdown list | SC-NOTIF-001 |
| `EmptyState` | Illustration + prompt + CTA for each empty view | SC-SOLO-002 |
| `TagPicker` | Tag selection UI (16 fixed + custom) | SC-MEMORY-003 |
| `ImageUpload` | Photo upload/preview for memory pins | SC-MEMORY-001 |

### State Management

Use React Context for:
- **AuthContext** (existing): JWT token, current user data.
- **BoardContext** (new): Active tab, pins data, Top 8 data, loading states. Scoped to the Board view.

Use local component state for:
- Voice recording state (recording/stopped/processing)
- Pin creation form fields
- Search query and results

Use `useSWR` or equivalent for:
- Pin list fetching with caching and revalidation
- Notification count polling (every 60 seconds)
- Social annotations (fetched alongside pins)

### Tab Switcher Implementation

1. `Board` component maintains `activeTab` state (`'memory'` | `'dream'`).
2. On mount: check URL for deep link (`/past` or `/future`). If present, use that. Otherwise, call `GET /api/users/preferences` to get `lastTab`.
3. On tab change: update local state immediately (instant switch), call `PUT /api/users/preferences` in background (fire-and-forget -- don't block UI on server response).
4. Pin data for both tabs can be pre-fetched in background for instant switching. Minimum: fetch the active tab eagerly, fetch the other tab lazily after initial render.

---

## Section 5: Voice Input Pipeline

<!-- REQ-VOICE-001: satisfies SC-VOICE-001 -->
<!-- REQ-VOICE-002: satisfies SC-VOICE-002 -->
<!-- REQ-VOICE-006: satisfies SC-VOICE-006 -->
<!-- REQ-VOICE-007: satisfies SC-VOICE-007 -->

### Pipeline Steps

```
[1. Record]  -->  [2. Upload]  -->  [3. Transcribe]  -->  [4. Structure]  -->  [5. Review]  -->  [6. Save]
 (client)        (client->srv)     (srv->Whisper)       (srv->Claude)       (client)          (client->srv)
```

#### Step 1: Record Audio (Client)

- Use `navigator.mediaDevices.getUserMedia({ audio: true })` to get microphone access.
- Create `MediaRecorder` with `mimeType: 'audio/webm;codecs=opus'` (preferred) or `'audio/wav'` fallback.
- UI: Large "record" button. While recording: pulsing animation + duration timer.
- User taps again to stop. Audio blob stored in memory.
- **Error**: If `getUserMedia` fails (permission denied), show: "Microphone access needed to record. Check browser permissions." + "Type instead" button.

#### Step 2: Upload Audio (Client -> Server)

- POST audio blob as `multipart/form-data` to `/api/voice/transcribe`.
- UI: "Transcribing your memory..." with spinner.
- **Error on upload failure**: "Could not send audio to server. Check your connection." + [Retry] button (re-sends same blob) + [Type instead] button.

#### Step 3: Transcribe (Server -> Whisper API)

- Server receives audio, forwards to Whisper API.
- **Error**: If Whisper returns error or timeout (30s), server returns 502 with `stage: "transcription"`.
- Client shows: "Transcription failed. Your recording is safe." + [Retry] button + [Type instead] button.
- On success: transcript text returned to client. Displayed immediately in `VoiceReview` component.

#### Step 4: Structure (Client -> Server -> Claude)

- Client sends transcript to `/api/voice/structure`.
- UI: Shows transcript text immediately. Below it: "Organizing your memory..." spinner for the AI proposal section.
- **Error**: If Claude returns error or timeout (30s), server returns 502 with `stage: "structuring"`.
- Client shows: transcript is still visible. AI proposal section shows: "Could not organize automatically." + [Retry] button + manual form fields pre-populated with transcript as note.
- On success: AI proposal fields appear below transcript.

#### Step 5: Review (Client)

- Display:
  - Verbatim transcript (read-only, always visible)
  - Editable: place name (text input, pre-filled by AI)
  - Editable: tags (tag picker, pre-selected by AI)
  - Editable: summary (text area, pre-filled by AI)
  - Optional: photo upload, year, rating (for memories), dream note (for dreams)
- "Re-record" button: opens new recording session. On completion, correction transcript sent to `/api/voice/structure` along with original transcript. Both transcripts displayed.
- All fields directly editable by user regardless of AI proposal.

#### Step 6: Save (Client -> Server)

- "Save Memory" or "Save Dream" button (explicit, no auto-save).
- POST to `/api/pins` with all fields.
- On success: navigate to board, new pin appears.
- On error: "Could not save. Please try again." + [Retry] button. Form state preserved.

### Manual Text Entry Fallback

Available as:
- "Type instead" button at any error stage in the voice pipeline.
- Direct "Add memory" / "Add dream" button on the board (for users who prefer typing).

Opens the same review form (Step 5) but with empty AI fields. User fills in manually. No Whisper or Claude calls needed.

---

## Section 6: Location Normalization

<!-- REQ-LOCATION-001: satisfies SC-LOCATION-001 -->
<!-- REQ-LOCATION-002: satisfies SC-LOCATION-002 -->
<!-- REQ-LOCATION-003: satisfies SC-LOCATION-003 -->

### Claude Prompt for Location Normalization

```
Given this place description from a traveler: "{placeName}"

Normalize it to structured location data. The traveler may use informal, poetic, or vague descriptions.
Match to the most likely real-world location.

Return ONLY valid JSON:
{
  "display_name": "{the user's original text, unchanged}",
  "normalized_city": "closest city or town name",
  "normalized_country": "country name",
  "normalized_region": "broader geographic region for matching (e.g., 'Patagonia', 'Amalfi Coast', 'Tokyo Metropolitan Area', 'Scottish Highlands')",
  "lat": 41.138,
  "lng": -8.646,
  "confidence": "high|medium|low"
}

Confidence levels:
- "high": clear, unambiguous location (e.g., "Paris", "Torres del Paine", "Shinjuku")
- "medium": likely correct but some ambiguity (e.g., "that coast in southern Italy", "the old town")
- "low": too vague or multiple strong candidates (e.g., "a beautiful beach", "the mountains")

For the "normalized_region" field: use a human-readable region name that would naturally group nearby locations.
Examples: "Torres del Paine", "El Chalten", and "Patagonia" should all normalize to region "Patagonia".
"Amalfi", "Positano", and "Ravello" should all normalize to region "Amalfi Coast".
```

### Normalization Flow

1. **During pin creation**: After `POST /api/pins`, server asynchronously calls Claude for location normalization. The pin is created immediately with `location_verified: false`. When Claude responds, the pin is updated with normalized fields.
2. **Confidence thresholds**:
   - `high` or `medium`: Set `location_verified: true`. Populate `normalizedCity`, `normalizedCountry`, `normalizedRegion`, `latitude`, `longitude`, `locationConfidence`. Pin participates in friend matching.
   - `low`: Set `location_verified: false`. Populate normalized fields as best-effort but pin does NOT participate in friend matching. Frontend shows "location unverified" indicator. User can confirm via "Help us find this place" flow to set `location_verified: true`.
3. **"Help us find this place" flow** (SC-LOCATION-003): User taps the "unverified" indicator on a pin. UI shows the AI's best guess (city, country, region) and lets user confirm or type a clarification. On clarification, re-call `/api/location/normalize` with the refined text. On confirm, set `location_verified: true`.

### Region-Based Matching

Social annotations and friend discovery use `normalized_region` for matching, not exact coordinates. Two pins match if they share the same `normalized_region` string (case-insensitive comparison).

Decision: `normalized_region` matching is string-equality based. This is simple and covers the 80% case. Edge cases (e.g., overlapping regions) are accepted for v1. Future enhancement could use geographic proximity.

---

## Section 7: Unsplash Integration (Dream Pins)

<!-- REQ-DREAM-002: satisfies SC-DREAM-002 -->

### Auto-Fetch Flow

1. When a dream pin is created without a user-provided photo:
   - Server calls Unsplash Search API: `GET https://api.unsplash.com/search/photos?query={placeName}&orientation=landscape&per_page=1`
   - If result found: store `unsplash_image_url` (the `urls.regular` field, ~1080px wide) and `unsplash_attribution` (photographer name + Unsplash link, per API TOS: "Photo by [Name] on Unsplash").
   - If no result or API error: leave both fields null. Frontend falls back to gradient + emoji.
2. Unsplash attribution is displayed on dream pin cards as small text below the image.

### Fallback: Gradient + Emoji

When no photo is available (no user upload, no Unsplash result), the pin card displays:

- **Background**: CSS gradient using colors from the pin's primary (first) experience tag.
- **Center**: Large emoji from the pin's primary experience tag.
- If the pin has no tags: use a default travel gradient (`#1a1a2e` to `#16213e`) with globe emoji.

### Tag Color and Emoji Mapping (see Section 9 for full table)

Each of the 16 experience tags has assigned gradient colors and an emoji. These are stored in the `experience_tags` seed data and are used both for the tag UI chips and for dream pin fallback visuals.

---

## Section 8: Social Layer

### Friend Annotations Computation

<!-- REQ-SOCIAL-001: satisfies SC-SOCIAL-001 -->

Annotations are computed server-side via the `/api/social/annotations` endpoint. The computation uses `normalized_region` matching.

**On user's own PAST tab (memory pins):**
```sql
-- For each of the user's memory pins, find friends who have dream pins in the same region
SELECT p.id as my_pin_id, COUNT(DISTINCT fp.user_id) as friend_dream_count,
       array_agg(DISTINCT u.display_name) as friend_names
FROM pins p
JOIN friendships f ON (
  (f.user_id_1 = $1 OR f.user_id_2 = $1) AND f.status = 'accepted'
)
JOIN pins fp ON fp.user_id = CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END
JOIN users u ON u.id = fp.user_id
WHERE p.user_id = $1
  AND p.pin_type = 'memory'
  AND fp.pin_type = 'dream'
  AND fp.archived = false
  AND p.normalized_region IS NOT NULL
  AND LOWER(p.normalized_region) = LOWER(fp.normalized_region)
GROUP BY p.id;
```

Shows: "3 friends dream of visiting here" badge.

**On user's own FUTURE tab (dream pins):**
Two queries:
1. Friends with memory pins in same region -> "X friends have been here" + names
2. Friends with dream pins in same region -> "X friends also dream of this"

**On friend's PAST tab (viewing their memories):**
Check viewer's dream pins against friend's memory regions -> "You dream of visiting here!"

**On friend's FUTURE tab (viewing their dreams):**
1. Check viewer's memory pins against friend's dream regions -> "You've been here!"
2. Show "I'm interested too!" button (triggers `POST /api/social/inspire/:pinId`)

### "Inspired By" Flow

<!-- REQ-SOCIAL-003: satisfies SC-SOCIAL-003 -->

1. User views friend's FUTURE tab.
2. User taps "I'm interested too!" on a dream pin.
3. Client calls `POST /api/social/inspire/:pinId`.
4. Server creates a new dream pin on the user's board:
   - Copies: `place_name`, tags, `normalized_*` fields
   - Sets: `inspired_by_pin_id`, `inspired_by_user_id`, `inspired_by_display_name`
   - Fetches fresh Unsplash image
5. Server creates notification for original pin owner.
6. New pin appears on user's FUTURE board with "Inspired by Sarah Jones" attribution.

**Deletion behavior (SC-SOCIAL-003):**
- Original pin deleted: inspired copies unchanged. `inspired_by_display_name` remains.
- Original user deletes account: application-level handler updates all `pins` where `inspired_by_user_id` matches to set `inspired_by_display_name = 'a fellow traveler'`.
- Inspired user can remove attribution: `PUT /api/pins/:id` with `inspiredByDisplayName: null`.

### Notification Creation

Notifications are created by the server at the time of the triggering action:

| Trigger | Notification Type | Recipient | Actor |
|---------|------------------|-----------|-------|
| `POST /api/social/inspire/:pinId` | `inspired` | Pin owner | Current user |

Note: The `interest` notification type is reserved for a future "express interest without copying" feature. For v1, "I'm interested too!" always creates an inspired pin, so only the `inspired` type is used.

### Top 8 Ordering

- Drag-and-drop reorder in the frontend (using a library like `@dnd-kit/core`).
- On drop, client sends `PUT /api/pins/top` with the full ordered array of pin IDs.
- Server replaces all `top_pins` rows for that `(user_id, tab)`.

---

## Section 9: Experience Tag Taxonomy

<!-- Satisfies SC-MEMORY-003 experience tags definition -->

Seed data for the `experience_tags` table. All 16 tags with their visual properties.

| id | name | emoji | description | gradient_start | gradient_end | sort_order |
|----|------|-------|-------------|---------------|-------------|-----------|
| 1 | Nature & Wildlife | \ud83c\udfde\ufe0f | National parks, safaris, forests, mountains, natural wonders | #2D5016 | #4A7C23 | 1 |
| 2 | Food & Drink | \ud83c\udf5c | Local cuisine, street food, wine regions, cooking classes, restaurants | #8B4513 | #D2691E | 2 |
| 3 | Culture & History | \ud83c\udfef | Temples, museums, ancient ruins, historical sites, traditions | #6B2D5B | #9B4B8A | 3 |
| 4 | Beach & Water | \ud83c\udf0a | Coastlines, islands, snorkeling, diving, lakeside relaxation | #0E4D6E | #1A8FBF | 4 |
| 5 | Outdoor Adventure | \ud83e\uddd7 | Hiking, climbing, rafting, canyoning, extreme sports | #8B4000 | #CC5500 | 5 |
| 6 | Winter Sports | \ud83c\udfbf | Skiing, snowboarding, ice climbing, winter landscapes | #1B3A5C | #3A7BD5 | 6 |
| 7 | Sports | \ud83c\udfdf\ufe0f | Attending events, playing sports, marathons, sport culture | #1A472A | #2E8B57 | 7 |
| 8 | Nightlife & Music | \ud83c\udf78 | Clubs, live music, bars, festivals, concerts | #2D1B4E | #6A1B9A | 8 |
| 9 | Architecture & Streets | \ud83c\udfdb\ufe0f | City walks, iconic buildings, urban exploration, neighborhoods | #4A4A4A | #7A7A7A | 9 |
| 10 | Wellness & Slow Travel | \ud83e\uddd8 | Spas, retreats, meditation, hot springs, slow-paced journeys | #2E4A3E | #5B8A72 | 10 |
| 11 | Arts & Creativity | \ud83c\udfad | Galleries, street art, theater, craft workshops, local art scenes | #8B2252 | #CD3278 | 11 |
| 12 | People & Connections | \ud83e\udd1d | Homestays, local encounters, community experiences, friendships | #654321 | #A0785A | 12 |
| 13 | Epic Journeys | \ud83d\ude82 | Road trips, train routes, sailing, multi-day treks, cross-country | #4A2800 | #8B5000 | 13 |
| 14 | Shopping & Markets | \ud83d\udecd\ufe0f | Bazaars, flea markets, artisan shops, souvenirs, local crafts | #6B2D5B | #B8578A | 14 |
| 15 | Festivals & Special Events | \ud83c\udf8a | Carnivals, cultural festivals, holidays, seasonal celebrations | #8B0000 | #DC143C | 15 |
| 16 | Photography | \ud83d\udcf8 | Landscapes, portraits, golden hour spots, photogenic locations | #2C3E50 | #4A6FA5 | 16 |

**Default fallback** (no tags): gradient `#1A1A2E` to `#16213E`, emoji: \ud83c\udf0d

### Seed SQL

```sql
INSERT INTO experience_tags (id, name, emoji, description, gradient_start, gradient_end, sort_order) VALUES
(1,  'Nature & Wildlife',       '\ud83c\udfde\ufe0f', 'National parks, safaris, forests, mountains, natural wonders', '#2D5016', '#4A7C23', 1),
(2,  'Food & Drink',            '\ud83c\udf5c', 'Local cuisine, street food, wine regions, cooking classes, restaurants', '#8B4513', '#D2691E', 2),
(3,  'Culture & History',       '\ud83c\udfef', 'Temples, museums, ancient ruins, historical sites, traditions', '#6B2D5B', '#9B4B8A', 3),
(4,  'Beach & Water',           '\ud83c\udf0a', 'Coastlines, islands, snorkeling, diving, lakeside relaxation', '#0E4D6E', '#1A8FBF', 4),
(5,  'Outdoor Adventure',       '\ud83e\uddd7', 'Hiking, climbing, rafting, canyoning, extreme sports', '#8B4000', '#CC5500', 5),
(6,  'Winter Sports',           '\ud83c\udfbf', 'Skiing, snowboarding, ice climbing, winter landscapes', '#1B3A5C', '#3A7BD5', 6),
(7,  'Sports',                  '\ud83c\udfdf\ufe0f', 'Attending events, playing sports, marathons, sport culture', '#1A472A', '#2E8B57', 7),
(8,  'Nightlife & Music',       '\ud83c\udf78', 'Clubs, live music, bars, festivals, concerts', '#2D1B4E', '#6A1B9A', 8),
(9,  'Architecture & Streets',  '\ud83c\udfdb\ufe0f', 'City walks, iconic buildings, urban exploration, neighborhoods', '#4A4A4A', '#7A7A7A', 9),
(10, 'Wellness & Slow Travel',  '\ud83e\uddd8', 'Spas, retreats, meditation, hot springs, slow-paced journeys', '#2E4A3E', '#5B8A72', 10),
(11, 'Arts & Creativity',       '\ud83c\udfad', 'Galleries, street art, theater, craft workshops, local art scenes', '#8B2252', '#CD3278', 11),
(12, 'People & Connections',    '\ud83e\udd1d', 'Homestays, local encounters, community experiences, friendships', '#654321', '#A0785A', 12),
(13, 'Epic Journeys',           '\ud83d\ude82', 'Road trips, train routes, sailing, multi-day treks, cross-country', '#4A2800', '#8B5000', 13),
(14, 'Shopping & Markets',      '\ud83d\udecd\ufe0f', 'Bazaars, flea markets, artisan shops, souvenirs, local crafts', '#6B2D5B', '#B8578A', 14),
(15, 'Festivals & Special Events', '\ud83c\udf8a', 'Carnivals, cultural festivals, holidays, seasonal celebrations', '#8B0000', '#DC143C', 15),
(16, 'Photography',             '\ud83d\udcf8', 'Landscapes, portraits, golden hour spots, photogenic locations', '#2C3E50', '#4A6FA5', 16);
```

---

## Appendix A: Decisions Made During Spec

These decisions were made by the architect to resolve ambiguities not explicitly covered in intent.md:

1. **Unified `pins` table**: Memories and dreams share one table with a `pin_type` enum, rather than two separate tables. This simplifies queries (especially social matching) and avoids schema duplication. The `archived` field and `dream_note` are only meaningful for dreams; `visit_year` and `rating` are only meaningful for memories. Both allow NULL for the irrelevant fields.

2. **Location normalization is async**: Pin creation returns immediately without waiting for Claude's location normalization. The normalized fields are backfilled. This prevents Claude API latency from blocking the user's "save" action. The frontend can poll or use a webhook pattern to update the UI when normalization completes.

3. **`inspired_by_*` fields are denormalized snapshots**: Rather than foreign keys, the inspired-by fields are snapshots of data at creation time. This satisfies SC-SOCIAL-003's requirement that inspired pins survive original deletion. The `inspired_by_display_name` is updated to "a fellow traveler" via application logic when a user deletes their account.

4. **`normalized_region` matching is string equality**: For v1, two pins match socially if their `normalized_region` strings match (case-insensitive). This is simpler than geographic proximity matching and sufficient given that Claude is instructed to use consistent region names. Edge cases are accepted.

5. **Medium-confidence locations are verified**: Both `high` and `medium` confidence results set `location_verified: true` and participate in social matching. Only `low` confidence locations are unverified and excluded from matching until the user confirms via "Help us find this place."

6. **Notification `interest` type reserved for future**: For v1, "I'm interested too!" always creates an inspired pin (triggering `inspired` notification). The `interest` notification type exists in the enum for future use (express interest without creating a pin).

7. **Search is prefix-match, not full-text**: User search uses `ILIKE` prefix matching on display name and username. Full-text search is unnecessary for v1 given the user-search-only scope.

8. **Single photo per memory pin**: The intent specifies "a signature photo" (singular). No multi-photo support. This keeps the UI and upload flow simple.

9. **`pin_resources` limited to 10 at application level**: Rather than a database constraint (which would require a trigger), the 10-resource limit is enforced in the API endpoint handler before INSERT.

10. **Dream pin conversion is two-step**: The `/api/pins/:id/convert` endpoint handles the dream's fate (keep/archive) and returns prefilled data. The actual memory creation is a separate `POST /api/pins` call. This reuses the existing creation flow rather than duplicating it.
