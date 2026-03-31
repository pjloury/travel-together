# Intent: Travel Together App Refactor -- From Travel Tracker to Visual Memory & Aspiration Platform

## Ground Truth (User's Original Request)

> "I want to refactor this app and create a new spec together that is focused on making it easy to input what are the favorite places I've been and favorite experiences I've had. 1 to collect those memories but 2 to be able to let others know that I can give input and advice on those places and activities. Second, I want to make it really aspirational for me to keep a visual pinboard of the places that I want to travel to and the experiences that I want to have. really focused on a single player mode of fond lookback and excited dreaming aspirational look forward. then out of this deep beautiful visual pinning inspiration experience, can surface traveling together opportunities with your friends based on their shared interests. Also friends can view your aspirations and say if they're interested as well"

**Key concepts extracted:**

- **"favorite places I've been and favorite experiences I've had"**: Memories are place+experience pairs, emphasis on FAVORITES not exhaustive tracking
- **"collect those memories"**: Personal archive/journal purpose -- emotional, not data-entry. Voice-first input captures the raw emotion and stream-of-consciousness storytelling.
- **"let others know I can give input and advice"**: Manifested through the **Top 8** -- a user's curated highlight reel of their defining travel experiences, visible to friends
- **"visual pinboard"**: Pinterest/mood-board aesthetic, image-first, NOT list-based
- **"aspirational"**: Emotional quality -- dreaming, excitement, not a checklist or to-do list
- **"single player mode"**: Must be deeply rewarding ALONE before any social features matter
- **"fond lookback"**: Nostalgic, warm emotional tone for memories
- **"excited dreaming aspirational look forward"**: Inspirational, energizing emotional tone for dreams
- **"deep beautiful visual pinning inspiration experience"**: The visual quality IS the product -- not a feature bolt-on
- **"surface traveling together opportunities"**: Social discovery EMERGES FROM personal content, not a separate page
- **"friends can view your aspirations and say if they're interested"**: Low-friction interest signaling on dream pins

**Concept coverage:**

| Key Concept | Covered By | Status |
|-------------|------------|--------|
| Favorite places + experiences (memories) | SC-MEMORY-001, SC-MEMORY-002, SC-MEMORY-003 | COVERED |
| Collect those memories (personal archive) | SC-MEMORY-004, SC-VOICE-001 through SC-VOICE-007 | COVERED |
| Let others know (Top 8 curated highlights) | SC-PROFILE-001, SC-PROFILE-002 | COVERED |
| Visual pinboard | SC-DREAM-001, SC-DREAM-002 | COVERED |
| Aspirational feeling | SC-DREAM-003, QG-VISUAL-001 | COVERED |
| Single player mode first | SC-SOLO-001, SC-SOLO-002 | COVERED |
| Fond lookback | SC-MEMORY-006, QG-VISUAL-002 | COVERED |
| Excited dreaming look forward | SC-DREAM-003, QG-VISUAL-001 | COVERED |
| Deep beautiful visual experience | QG-VISUAL-001, QG-VISUAL-002, QG-VISUAL-003 | COVERED |
| Surface travel-together opportunities | SC-SOCIAL-001, SC-SOCIAL-002 | COVERED |
| Friends view aspirations + express interest | SC-SOCIAL-003, SC-SOCIAL-004, SC-NOTIF-001 | COVERED |
| Voice-first memory creation | SC-VOICE-001 through SC-VOICE-007, CON-REFACTOR-007 | COVERED |
| Free-form location (no forced hierarchy) | SC-LOCATION-001, SC-LOCATION-002, SC-LOCATION-003 | COVERED |
| Pin things found online to dream board | SC-EXTENSION-001 through SC-EXTENSION-007 | COVERED |

---

## Problem Statement

The current Travel Together app is a functional travel tracker (countries visited, wishlist, friend alignment) but feels like a data-entry tool. The user wants to transform it into an emotionally resonant, visually beautiful personal travel journal with two modes -- **Lookback** (fond memories) and **Lookahead** (aspirational dreams) -- where social travel discovery EMERGES naturally from the richness of personal content rather than being a separate feature. Voice input is the primary creation mechanism, capturing raw emotion and storytelling that AI then structures into beautiful memory cards.

---

## Success Criteria

### Memory Collection -- Lookback (SC-MEMORY-*)

- [ ] **SC-MEMORY-001**: User can create a memory pin consisting of at minimum: a place name (free-form text) and one experience tag. Optionally: a signature photo, a short text note, a year, a rating (1-5 hearts). A user can have **both a memory pin and a dream pin for the same place** -- these are independent objects. Having been somewhere (memory) and wanting to return (dream) are distinct emotional states and both are valid simultaneously. On social annotations: if a user has both a memory and a dream for the same place, friends see the memory annotation separately from the dream annotation.
- [ ] **SC-MEMORY-002**: Memories are displayed as visual cards containing: AI-structured summary, verbatim voice transcript (preserved and visible), image-forward when photo exists, place-illustration or color-gradient fallback when no photo -- never as a plain text list.
- [ ] **SC-MEMORY-003**: User can tag memories with experience types from the defined taxonomy (see Experience Tags section), which become the basis for social discovery and matching.
- [ ] **SC-MEMORY-004**: User can browse their own memories in a visual grid/masonry layout, filterable by place or experience type.
- [ ] **SC-MEMORY-005**: Voice input is the primary and lowest-friction memory creation path. Manual text entry is also supported as an alternative. The voice flow replaces the previous "under 10 seconds tap entry" as the day-1 experience.
- [ ] **SC-MEMORY-006**: The memories view uses warm visual treatment with no data-table or spreadsheet aesthetics. Concrete visual criteria are specified in QG-VISUAL-002.

### Voice Input -- Primary Creation Mechanism (SC-VOICE-*)

- [ ] **SC-VOICE-001**: User can record a voice memo freely -- messy, stream-of-consciousness, emotional storytelling. No structure required from the user.
- [ ] **SC-VOICE-002**: Voice recording is transcribed to text. The full verbatim transcript is displayed to the user and permanently preserved on the memory card.
- [ ] **SC-VOICE-003**: AI (Claude API, already integrated in the app) processes the verbatim transcript and proposes structured data: place name, experience tags, and a polished summary card. AI proposes tags **only from the 16 fixed taxonomy tags** -- it does not invent custom tags. AI proposes **a maximum of 3 tags** per memory/dream. If the transcript does not clearly map to any fixed tag, AI proposes zero tags (user adds manually during review). AI must always propose at least a place name; tag proposals are best-effort. During the review step (SC-VOICE-004), the user can add, remove, or swap any proposed tags -- including adding custom tags that fall outside the 16 fixed taxonomy.
- [ ] **SC-VOICE-004**: User reviews the AI-proposed structure and can: (a) edit any AI-proposed field directly (change place name, swap/add/remove tags, rewrite summary), (b) tap "Re-record" to speak a correction -- AI re-processes incorporating both original transcript and correction, (c) both the original transcript AND any correction transcripts are preserved and shown verbatim on the card. The AI proposal is a suggestion, not a final answer.
- [ ] **SC-VOICE-005**: Upon user commit (explicit "Save Memory" / "Save Dream" button tap -- no auto-save), the memory card is created containing both: the AI-structured summary AND the original verbatim transcript preserved in full.
- [ ] **SC-VOICE-006**: Audio is recorded client-side via browser MediaRecorder API, sent to the backend, and transcribed server-side via OpenAI Whisper API. The verbatim transcript text is then passed to Claude for structuring. The user never interacts with Whisper directly -- they see only the resulting transcript.
- [ ] **SC-VOICE-007**: At each stage of the voice pipeline (audio upload, Whisper transcription, Claude structuring), failures are communicated to the user with a specific error message. Each failure stage offers: (a) a **Retry** button to re-attempt that stage without re-recording, and (b) a **Type instead** fallback that opens a manual text entry field pre-populated with any partial transcript available. The app never silently fails or leaves the user on a blank/frozen screen.

### Aspirational Pinboard -- Lookahead (SC-DREAM-*)

- [ ] **SC-DREAM-001**: User can create a dream pin consisting of: a destination (free-form place name) and/or an experience type. Optionally: an inspiration image (upload or URL), a note about why. Dream pins optionally have an **`inspiration_resources` array**, each resource containing: source URL, domain name, optional photo URL, optional short excerpt (max 280 chars). This array is populated by the Chrome extension (SC-EXTENSION-005) and is also available for future use (e.g., manually adding a reference link). A dream pin can have up to 10 inspiration resources.
- [ ] **SC-DREAM-002**: Dream pins are displayed as a visual pinboard (masonry/Pinterest-style grid of image cards), NOT as a checklist or ranked list. Default imagery is auto-fetched from Unsplash API by destination name; fallback is a color gradient with a relevant emoji depicting the place/vibe. Both states look intentionally designed.
- [ ] **SC-DREAM-003**: The dream board uses large imagery, minimal chrome, and mood-board layout -- not a to-do list or checklist. Concrete visual criteria (card height, text-to-image ratio) are specified in QG-VISUAL-001.
- [ ] **SC-DREAM-004**: User can browse and filter their dream pins by destination or experience type.
- [ ] **SC-DREAM-005**: When a dream is fulfilled, user taps "I went!" on the dream pin and is offered two paths: (a) **"Tell me about it"** -- opens the full voice input flow (speak freely, AI structures into memory), (b) **"Quick add"** -- pre-filled form with destination from dream pin, user adds: signature photo (optional), short text note, year, up to 3 tags. Both paths create a memory pin carrying forward the destination and experience tags from the dream pin. After conversion, user chooses: "Keep as dream" (dream pin stays) or "Mark as visited" (dream pin archived/removed).

### Top 8 -- Curated Highlights (SC-PROFILE-*)

- [ ] **SC-PROFILE-001**: A user can manually curate a **Top 8** -- their 8 favorite memories to feature on the PAST tab AND up to 8 favorite dreams on the FUTURE tab (independent lists, up to 16 total featured pins). Top 8 pins appear above a visual "fold" as the primary view of each tab. Mechanics: (a) user can Add/Remove any pin from Top 8 via a clear UI affordance on each card, (b) at 9 pins the cap is enforced -- user must remove one before adding another (UI shows current 8, asks which to swap), (c) user can manually reorder the Top 8 via drag-and-drop or equivalent touch gesture, (d) reorder persists server-side (not localStorage). If user has fewer than 8 pins total: all pins appear in Top 8 positions (no artificial empty slots). If user has no pins: empty state per SC-SOLO-002.
- [ ] **SC-PROFILE-002**: The Top 8 is visible to friends viewing the user's boards, serving as a curated "here are my defining travel experiences" signal and natural conversation invitation.
- [ ] **SC-PROFILE-003**: User's profile (which IS the Memory board) shows a visual summary: count of memories, count of dreams, top experience types.

### App Structure (SC-NAV-*)

- [ ] **SC-NAV-001**: The app has two primary views accessible via a tab switcher: **PAST** (Memory board) | **FUTURE** (Dream board). No separate profile page -- the Memory board IS the user's profile.
- [ ] **SC-NAV-002**: Both tabs default to showing the user's curated **Top 8** pins above the fold. Pins beyond 8 live in an expanded "All" view loaded separately via scroll-down or tap-to-expand affordance.
- [ ] **SC-NAV-003**: Tab switcher enables instant switching -- single page app feel, no page reload.
- [ ] **SC-NAV-004**: Default landing is the Memory board (PAST tab). After first visit, the app remembers the user's last chosen tab and returns to it. Tab memory is stored server-side as a user preference (survives device switches). Deep links to a specific tab override tab memory for that session. Tab memory applies only to the user's own boards -- viewing a friend's board does not affect the user's tab memory.
- [ ] **SC-NAV-005**: Search accepts free-text input matching against user **display names and usernames** (not email, not places, not tags). Search is **global** -- not limited to existing friends; this is how new connections are discovered. Results display as **user cards** showing: avatar, display name, count of memories, count of dreams, and their Top 3 experience tags. Tapping a result opens that user's profile (their PAST | FUTURE boards). Non-friends viewing another user's board see the **Top 8 only** (not the full expanded view) -- full expanded view is friends-only. There is no place-based or tag-based search in v1.
- [ ] **SC-NAV-006**: When viewing a friend's board, annotations appear from YOUR perspective: (a) **their PAST tab** -- your dreams annotate their memories ("You dream of visiting here!"), (b) **their FUTURE tab** -- your memories annotate their dreams ("You've been here!") and you can tap "I'm interested too!" on their dream pins. All annotations computed from normalized location matching (region-based per SC-LOCATION-002).
- [ ] **SC-NAV-007**: Friends management is accessible but not a primary tab.

### Social Discovery (SC-SOCIAL-*)

- [ ] **SC-SOCIAL-001**: Social annotations on a user's own pins: (a) **PAST tab** -- memory pins show "X friends dream of visiting here" badge when friends have dream pins matching the same normalized location/region, (b) **FUTURE tab** -- dream pins show "X friends have been here" badge + "Sarah can help" when friends have memory pins matching the same location/region. Dream pins also show "X friends also dream of this" when friends have matching dream pins. All annotations computed from normalized location matching (region-based per SC-LOCATION-002).
- [ ] **SC-SOCIAL-002**: A dedicated "Travel Together" view surfaces matched dreams: destinations or experiences that both the user AND one or more friends have pinned as dreams. This emerges from personal pin data, not a separate input flow.
- [ ] **SC-SOCIAL-003**: Friends viewing a user's dream board can tap "I'm interested too!" on any dream pin, which creates a **new dream pin on the friend's own board** marked "Inspired by [original user's name]". The attribution is visible on the card and persists unless the friend explicitly removes it. The friend can later edit the inspired pin as their own (change image, add notes, etc.). Inspired dream pins are **independent copies** -- they survive if the original pin is deleted or the original user deletes their account. If the original pin is deleted: attribution remains as "Inspired by [display name]" (historical record). If the original user deletes their account: attribution shows "Inspired by a fellow traveler" (anonymized). The friend who received the inspired pin can always remove the attribution themselves.
- [ ] **SC-SOCIAL-004**: When a friend creates an inspired pin from a user's dream, the original user is notified in-app (not push notification for v1). See SC-NOTIF-001 for notification surface details.
- [ ] **SC-SOCIAL-005**: Friends viewing a user's memory pins can see what that person has experienced (supporting discovery via Top 8 and full board browsing).

### Single-Player Experience (SC-SOLO-*)

- [ ] **SC-SOLO-001**: The app is deeply rewarding to use with zero friends and zero existing content. Day-1 experience: user can immediately speak a memory via voice input and see it transformed into a beautiful visual card.
- [ ] **SC-SOLO-002**: Every empty state includes: (a) an illustration or gradient visual, (b) a specific prompt text in first person (e.g., "What's your favorite travel memory?"), (c) a single clear call-to-action button (e.g., voice recording prompt). No blank pages with "No data" or bare empty containers.
- [ ] **SC-SOLO-003**: The core loop (speak a memory, see it become a card, pin a dream, browse your boards) is compelling without any social features activated.

### In-App Notifications (SC-NOTIF-*)

- [ ] **SC-NOTIF-001**: In-app notifications surface as: (a) a numeric badge on the activity/notification section of the tab bar, (b) an inline highlight on the specific pin that triggered the notification. Notification types for v1: "X expressed interest in your dream", "X created a dream inspired by yours". Notifications are visible in a simple chronological list accessible from the tab bar. No push notifications (per CON-REFACTOR-004).

### Chrome Browser Extension -- Pin from the Web (SC-EXTENSION-*)

- [ ] **SC-EXTENSION-001**: A Chrome browser extension is available and installable from the Chrome Web Store. Authentication flow: the extension uses `chrome.identity.launchWebAuthFlow` to perform Google OAuth (same Google account the user uses for the main app). The backend exchanges the Google ID token for a JWT via the existing `/api/auth/google` endpoint. The JWT is stored in `chrome.storage.local` (not localStorage -- the extension cannot access the web app's localStorage). On subsequent opens, the extension reads the JWT from `chrome.storage.local` directly -- no login prompt. First-time users see a "Sign in with Google" button in the popup that triggers this flow.
- [ ] **SC-EXTENSION-002**: When activated on any webpage, the extension extracts: (a) **up to 5 candidate images** from the page (og:image first, then largest images by pixel area), (b) the page title and URL, and (c) up to 500 words of page text content for AI processing. The extension popup shows a simple image picker (horizontal strip or grid of up to 5 thumbnails) so the user can select which image to use. If only 1 image is found, it is shown directly (no picker UI needed). If no suitable image is found, the pin falls back to SC-EXTENSION-007 (Unsplash/gradient).
- [ ] **SC-EXTENSION-003**: AI processes the extracted page content and proposes: a destination/place name, up to 3 experience tags from the fixed 16-tag taxonomy, and a 2-3 sentence summary of the destination or experience. The user sees this proposal before committing.
- [ ] **SC-EXTENSION-004**: The user can choose "Add as new dream" -- creates a new dream pin with the proposed details (photo, place, tags, summary) plus a visible source link attribution ("Pinned from [domain]" with clickable URL). Source link attribution is visible to **friends viewing the dream pin** -- it serves as social context showing where the inspiration came from. Non-friends see the pin card but not the source attribution (consistent with their limited view).
- [ ] **SC-EXTENSION-005**: The user can alternatively choose "Add to existing dream" -- displays a searchable list of the user's existing dream pins; selecting one appends an entry to the dream pin's `inspiration_resources` array (as defined in SC-DREAM-001) containing the source URL, domain name, and optionally the photo URL and a short excerpt. The existing pin's primary photo and title are not overwritten. The "Add to existing dream" list is loaded **client-side**: the extension fetches the user's full dream board once (using the existing GET /api/wishlist or equivalent endpoint), caches it in `chrome.storage.session` for the browser session, and filters locally as the user types. A new API endpoint may be needed if the existing wishlist endpoint does not return the required schema -- this is flagged for the spec phase.
- [ ] **SC-EXTENSION-006**: The extension mini-UI is usable within the browser toolbar popup -- no new tab required. The full flow (extract -> AI propose -> user review -> commit) completes within the popup.
- [ ] **SC-EXTENSION-007**: If the page has no usable photo (no og:image, no images above a minimum size), the dream pin falls back to the standard Unsplash/gradient behavior from SC-DREAM-002.

### Discovery / Matching (SC-DISCOVERY-*)

- [ ] **SC-DISCOVERY-001**: The "Help Me" concept from the current app (places I want to go where friends have been) is preserved but surfaced contextually: when viewing a dream pin for Tokyo, the app shows "Sarah has been to Tokyo" with her memory pins visible.
- [ ] **SC-DISCOVERY-002**: The "I Can Help" concept (places I've been that friends want to go) is surfaced on the user's own memory pins: "3 friends dream of visiting Patagonia" badge on the user's Patagonia memory.

### Free-Form Location (SC-LOCATION-*)

- [ ] **SC-LOCATION-001**: Users express place however naturally comes to them: "that little fishing village outside Porto", "my favorite ramen spot in Shinjuku", "Torres del Paine", "the Amalfi Coast". The app NEVER presents a country/city/neighborhood dropdown hierarchy. Users only ever see their own natural language description on their cards.
- [ ] **SC-LOCATION-002**: Behind the scenes, AI normalizes free-form location text to structured data (coordinates, city, country, region) for search, matching, and recommendations. The normalized structure is invisible to users but powers: friend matching, search, tag filtering, and "who else has been here" discovery. Matching is region-based: two users who describe the same area differently ("Torres del Paine" / "Patagonia" / "El Chaltn") must be matched as overlapping locations.
- [ ] **SC-LOCATION-003**: When AI cannot confidently normalize a location (low confidence or no match), the pin is still created with the free-form text preserved as-is. A subtle "location unverified" indicator appears on the pin (non-blocking). User can optionally tap to clarify ("Help us find this place") which opens a simple search/confirm flow. Unverified locations do not participate in friend matching until confirmed.

---

## Experience Tags -- Confirmed Taxonomy

16 fixed tags plus custom overflow. Tags serve dual purpose: meaning of a past memory AND the vibe/purpose of a future dream. Custom tags allowed for things that fall through the cracks. Tag matching across users powers social discovery.

| Emoji | Tag Name |
|-------|----------|
| 🏞️ | Nature & Wildlife |
| 🍜 | Food & Drink |
| 🏯 | Culture & History |
| 🌊 | Beach & Water |
| 🧗 | Outdoor Adventure |
| 🎿 | Winter Sports |
| 🏟️ | Sports |
| 🍸 | Nightlife & Music |
| 🏛️ | Architecture & Streets |
| 🧘 | Wellness & Slow Travel |
| 🎭 | Arts & Creativity |
| 🤝 | People & Connections |
| 🚂 | Epic Journeys |
| 🛍️ | Shopping & Markets |
| 🎊 | Festivals & Special Events |
| 📸 | Photography |

Custom tags: Users can create their own tags for experiences not covered above (e.g., "Birdwatching", "Volcano hiking", "Street art"). Custom tags participate in matching/discovery like built-in tags.

---

## Quality Gates (process outcomes -- verified then archived)

- **QG-VISUAL-001**: Dream board uses large imagery (minimum 200px card height), masonry or grid layout, with less than 30% of card surface area occupied by text/metadata.
- **QG-VISUAL-002**: Memory cards use warm color palette or photo-forward treatment; no raw table rows or plain-text lists anywhere in memory browsing.
- **QG-VISUAL-003**: All empty states have illustration or gradient treatment with inviting microcopy, never a bare "No items" message.
- **QG-PERF-001**: Initial page load (dashboard/home) renders meaningful content within 2 seconds on a median mobile connection.
- **QG-PERF-002**: Creating a memory via voice (record, review AI structure, commit) completes in a satisfying flow. Manual text entry completes in under 10 seconds of user interaction time.
- **QG-REUSE-001**: Existing auth system (JWT + Google OAuth), friendship system, and PostgreSQL database are reused -- no new auth or social infrastructure from scratch.

---

## Constraints

- **CON-REFACTOR-001**: Tech stack remains React 19 + React Router 7 + Express 5 + PostgreSQL. No framework migration.
- **CON-REFACTOR-003**: Image storage for user-uploaded photos needs an external service (e.g., Cloudinary free tier, S3, or similar). The app will NOT store binary blobs in PostgreSQL.
- **CON-REFACTOR-004**: No push notifications in v1. Social signals are in-app only.
- **CON-REFACTOR-005**: Mobile-responsive design required -- the pinboard/visual experience must work on phone screens, not just desktop.
- **CON-REFACTOR-006**: Claude API is already integrated in the app and will be used for voice transcript processing and location normalization.
- **CON-REFACTOR-007**: OpenAI Whisper API used for voice transcription. Audio captured client-side via browser MediaRecorder, sent to backend, transcribed server-side before Claude processes the text. Whisper API key required alongside existing Anthropic key.
- **CON-EXTENSION-001**: The Chrome extension is a separate deployable artifact (Manifest V3, Chrome Web Store). It calls the same backend API as the web app. No new backend services are introduced -- the extension is a new client, not a new server. Required Chrome permissions: `activeTab` (grants tab access on user gesture -- clicking the extension icon; preferred over `<all_urls>` to minimize Web Store review friction), `scripting` (Manifest V3 content script injection), `storage` (for `chrome.storage.local` JWT and `chrome.storage.session` draft state), `identity` (for `chrome.identity.launchWebAuthFlow`).

---

## Non-Goals (Explicitly Out of Scope)

- **Country-level exhaustive tracking**: The current "Countries Visited" count as a primary metric is de-emphasized. Memories are about specific places and experiences, not checking off countries.
- **Country/city dropdown hierarchy**: The app will NEVER present a structured country > city > neighborhood selection UI. Location input is always free-form text, normalized by AI behind the scenes.
- **Forced location schema for users**: Users are never asked to categorize their place into a structured format. They describe it naturally; the system handles normalization invisibly.
- **Interest-level scoring (1-5)**: The current wishlist "interest level" number is replaced by the visual pinboard. Dreams are either pinned or not -- no numeric ranking.
- **AI-generated travel profiles / reflection questions**: Phase 2's AI question system and auto-generated travel profiles are cut. The user's own pins and Top 8 ARE their profile.
- **AI trip proposals**: Cut for this refactor. May return later but the core experience is personal pinning, not AI-generated itineraries.
- **Discover feed / algorithmic recommendations**: Cut. The inspiration comes from the user's own dreaming and friends' content, not an AI feed.
- **Country/city AI profiles**: Cut as a standalone feature. May keep lightweight place info but not the full AI-generated profile pages.
- **Travel Vibes model**: Cut. Experience tags on memories/dreams replace the abstract "vibe" system.
- **World map visualization**: Deferred. May return as an enhancement but is not core to the lookback/lookahead experience.
- **Complex alignment pages (Let's Travel / I Can Help / Help Me as separate pages)**: These three views are collapsed into contextual annotations on pins and a single "Travel Together" matched view.
- **Auto-generated "Ask Me About" badges**: Replaced by the manually curated Top 8 system. No auto-generated expertise signals.
- **Data migration**: Clean slate -- no existing data or schemas to preserve. The app was never launched.
- **Per-pin privacy controls**: All pins (memories and dreams) are visible to accepted friends. There is no per-pin "private" toggle in v1. Users who want privacy should not add those memories to the app. This is an intentional simplification -- the emotional authenticity of the experience depends on sharing. Non-friends (found via search) see only the Top 8 pins, not the full boards.
- **Place-based or tag-based search**: Search in v1 is user-only (display names and usernames). No search by place name, tag, or experience type.
- **Firefox/Safari extensions**: v1 Chrome only. Other browser extensions are deferred.

---

## Dimensions Analyzed

| Dimension | In Scope? | Specified In |
|-----------|-----------|--------------|
| Memory data model (what IS a memory) | YES | SC-MEMORY-001 |
| Memory visual presentation | YES | SC-MEMORY-002, SC-MEMORY-006, QG-VISUAL-002 |
| Voice input as primary creation | YES | SC-VOICE-001 through SC-VOICE-007 |
| Speech-to-text service (Whisper API) | YES | SC-VOICE-006, CON-REFACTOR-007 |
| AI feedback and user editing | YES | SC-VOICE-004 |
| Memory experience tagging | YES | SC-MEMORY-003 |
| Memory browsing/filtering | YES | SC-MEMORY-004 |
| Dream data model | YES | SC-DREAM-001 |
| Dream visual presentation (pinboard) | YES | SC-DREAM-002, SC-DREAM-003, QG-VISUAL-001 |
| Dream default imagery (Unsplash + gradient fallback) | YES | SC-DREAM-002 |
| Dream-to-memory conversion (two paths) | YES | SC-DREAM-005 |
| Top 8 mechanics (cap, reorder, persist) | YES | SC-PROFILE-001 |
| Top 8 visibility to friends | YES | SC-PROFILE-002 |
| App structure (PAST/FUTURE tabs) | YES | SC-NAV-001 through SC-NAV-007 |
| Tab memory (server-side, deep link override) | YES | SC-NAV-004 |
| Social annotations (both perspectives) | YES | SC-SOCIAL-001, SC-NAV-006 |
| Social matching (shared dreams) | YES | SC-SOCIAL-002 |
| Interest expression ("inspired by" pins) | YES | SC-SOCIAL-003, SC-SOCIAL-004 |
| In-app notifications | YES | SC-NOTIF-001 |
| Single-player day-1 experience | YES | SC-SOLO-001, SC-SOLO-002, SC-SOLO-003 |
| Empty state concrete criteria | YES | SC-SOLO-002 |
| Contextual friend discovery on pins | YES | SC-DISCOVERY-001, SC-DISCOVERY-002 |
| Image handling (upload, storage, display) | YES | CON-REFACTOR-003 |
| Free-form location input + AI normalization | YES | SC-LOCATION-001, SC-LOCATION-002 |
| Location normalization failure behavior | YES | SC-LOCATION-003 |
| Experience tag taxonomy (16 fixed + custom) | YES | Experience Tags section |
| Mobile responsiveness | YES | CON-REFACTOR-005 |
| Performance | YES | QG-PERF-001, QG-PERF-002 |
| Auth / friendship infrastructure reuse | YES | QG-REUSE-001 |
| AI features (Claude for voice + location) | YES | SC-VOICE-003, SC-LOCATION-002, CON-REFACTOR-006 |
| Voice pipeline error states + fallbacks | YES | SC-VOICE-007 |
| AI tag assignment constraints (max 3, fixed taxonomy only) | YES | SC-VOICE-003 |
| User search (global, display name/username only) | YES | SC-NAV-005 |
| Non-friend board visibility (Top 8 only) | YES | SC-NAV-005, Non-Goals |
| Inspired pin independence (survives deletion) | YES | SC-SOCIAL-003 |
| Dual pins (memory + dream for same place) | YES | SC-MEMORY-001 |
| Chrome extension as a separate client | YES | SC-EXTENSION-* |
| Extension auth (same JWT/account) | YES | SC-EXTENSION-001, CON-EXTENSION-001 |
| Photo extraction from web pages | YES | SC-EXTENSION-002, SC-EXTENSION-007 |
| AI processing of web content | YES | SC-EXTENSION-003 |
| Add-to-existing dream as resource | YES | SC-EXTENSION-005 |
| Per-pin privacy | NO | Non-Goals |
| Place/tag-based search | NO | Non-Goals |
| Push notifications | NO | CON-REFACTOR-004 |
| Map visualization | NO | Non-Goals (deferred) |
| Data migration | NO | Non-Goals (clean slate) |
| Firefox/Safari extensions | NO | Non-Goals (deferred) |

---

## Failure Modes (Pre-Mortem)

These are ways we could THINK we satisfied the intent but actually FAIL:

- **FM-REFACTOR-001**: Visual pinboard looks great on desktop but is unusable on mobile (cards too small, tap targets too close). Mitigated by CON-REFACTOR-005 and QG-VISUAL-001.

- **FM-REFACTOR-002**: Memory entry via voice feels awkward or unreliable -- user records but transcription is poor, or AI structures incorrectly, killing the "fond lookback" feeling. Mitigated by SC-VOICE-002 (verbatim transcript preserved), SC-VOICE-004 (user review before commit).

- **FM-REFACTOR-003**: The app feels empty and pointless on day 1 with no content. User has no memories, no dreams, no friends -- stares at blank boards. Mitigated by SC-SOLO-001 and SC-SOLO-002 (inviting empty states with voice prompt, immediate satisfaction from first card).

- **FM-REFACTOR-004**: Social features dominate the UX, making the single-player experience feel incomplete or second-class. Mitigated by SC-SOLO-003 (core loop compelling without social) and the architecture where social annotations are LAYERED ON TOP of personal content, not a separate mode.

- **FM-REFACTOR-005**: Image handling becomes a blocker -- user uploads are complex (resize, compress, CDN, loading states). Without good image handling, the "visual pinboard" is just text cards with placeholder colors, which undermines the entire vision. Mitigated by CON-REFACTOR-003 but this needs careful implementation planning.

- **FM-REFACTOR-006**: Dream pins without user-uploaded images look generic/boring. Mitigated by SC-DREAM-002: Unsplash API auto-fetch by destination name with color gradient + emoji fallback. Both states must look intentionally designed, not broken.

- **FM-REFACTOR-008**: Top 8 curation feels like a chore or users don't bother curating. Mitigated by making Top 8 optional -- boards still show all pins, Top 8 is just a featured layer. The system should work fine without curation; Top 8 enhances but isn't required.

- **FM-REFACTOR-009**: The "I'm interested too!" social action on dream pins creates notification noise or feels performative rather than useful. Mitigated by SC-SOCIAL-004 (in-app only, not push) but the interaction design needs care.

- **FM-REFACTOR-010**: Every unit test passes but the actual visual experience is ugly/broken because visual quality is hard to test programmatically. Mitigated by QG-VISUAL-001, QG-VISUAL-002, QG-VISUAL-003 (specific measurable visual criteria) but ultimately requires human review of rendered output.

- **FM-REFACTOR-011**: We build the pinboard but the browsing/filtering experience is poor -- user has 50 memories and no way to find the one from Barcelona. Mitigated by SC-MEMORY-004, SC-DREAM-004 (filtering by place and experience type).

- **FM-REFACTOR-012**: The dream-to-memory conversion (SC-DREAM-005) is clunky or forgotten, so users who fulfill a dream have no satisfying way to mark that transition. Mitigated by SC-DREAM-005 specifying two conversion paths ("Tell me about it" voice flow and "Quick add" pre-filled form).

- **FM-REFACTOR-013**: Voice transcription quality is poor for non-English speakers or in noisy environments, making the primary input method unreliable. Mitigated by SC-MEMORY-005 (manual text entry as alternative path) and SC-VOICE-002 (transcript shown for user verification).

- **FM-REFACTOR-014**: AI structuring of voice transcripts is inaccurate -- wrong place names extracted, wrong tags suggested -- creating frustration instead of delight. Mitigated by SC-VOICE-004 (user reviews and tweaks AI proposals before committing).

- **FM-REFACTOR-015**: Location normalization fails silently -- two users who both visited "Torres del Paine" / "Patagonia" / "El Chaltn" don't get matched because the AI parsed their free-form descriptions into different normalized locations. Mitigated by SC-LOCATION-002 (region-based matching) and SC-LOCATION-003 (graceful failure with "unverified" indicator when normalization confidence is low).

- **FM-REFACTOR-016**: The PAST/FUTURE tab switcher is not discoverable or feels like a mode buried in navigation -- users don't realize the other half of the app exists. Mitigated by SC-NAV-001 (prominent tab switcher) and SC-NAV-003 (instant switching, SPA feel).

- **FM-REFACTOR-017**: Top 8 reorder is stored client-side only (localStorage) and lost when user switches devices. Mitigated by SC-PROFILE-001 (reorder persists server-side).

- **FM-REFACTOR-018**: "I'm interested too!" creates a pin but loses attribution to the original dreamer, breaking the social connection. Mitigated by SC-SOCIAL-003 ("Inspired by [name]" attribution persists on the card).

- **FM-REFACTOR-019**: Whisper API transcription fails or times out but user sees no feedback -- audio seems to vanish. Mitigated by SC-VOICE-006 (explicit pipeline: record -> send -> transcribe -> display) which implies error states at each step need UI feedback.

- **FM-REFACTOR-020**: Notifications pile up with no way to see them -- user never discovers that friends are interested in their dreams. Mitigated by SC-NOTIF-001 (badge on tab bar + chronological list).

- **FM-REFACTOR-021**: User edits AI-proposed fields but original transcript is lost or overwritten. Mitigated by SC-VOICE-004 (both original and correction transcripts preserved and shown verbatim).

- **FM-EXTENSION-001**: The extension extracts a photo but it's a logo, ad, or irrelevant image rather than a travel photo. Mitigation: SC-EXTENSION-002 specifies og:image as first preference (sites set this intentionally) and user can see/swap the proposed image before committing in the review step.

- **FM-EXTENSION-002**: Auth token is expired when user tries to pin from the extension (they haven't opened the main app in 7+ days). Mitigation: Extension detects expired token and re-authenticates using the same `chrome.identity.launchWebAuthFlow` flow -- silently if the Google session is still active, or prompting the user if not. No redirect to the web app needed.

- **FM-EXTENSION-003**: AI processes a generic travel listicle ("10 best places in Europe") rather than a specific destination -- proposes a vague or wrong place name. Mitigation: SC-EXTENSION-003 requires user review before committing. User can edit the AI proposal.

- **FM-EXTENSION-004**: User clicks outside the popup during AI processing (2-5 second wait), closing it and losing the in-progress pin proposal. Mitigation: After page content extraction (step 1), the extracted content and any AI proposal in progress is saved to `chrome.storage.session`. Reopening the popup within the same browser session resumes the draft. A "Resume draft" prompt appears at the top of the popup if a draft exists.

---

## Open Questions -- ALL RESOLVED

**Q1: Default imagery for dream pins** -- RESOLVED
Unsplash API auto-fetch by destination name. If no good match, color gradient fallback with a relevant emoji to depict the place/vibe. Both states should look intentionally designed, not broken. Traced to SC-DREAM-002.

**Q2: Memory photos + voice input** -- RESOLVED
Photos are optional. No forced upload. Voice input is the PRIMARY memory creation mechanism (see SC-VOICE-001 through SC-VOICE-006). User can also manually add a single "signature photo" to any memory. No multi-photo support. URL paste not needed -- upload only. Traced to SC-VOICE-*, SC-MEMORY-001, SC-MEMORY-002.

**Q3: "Ask Me About" replaced by Top 8 + Location normalization failure** -- RESOLVED
All auto-generated "Ask Me About" badges removed. Replaced with manually curated Top 8. Location normalization failure behavior fully specified: pins still created with unverified indicator, optional clarification flow, unverified locations excluded from matching. Traced to SC-PROFILE-001, SC-PROFILE-002, SC-LOCATION-003.

**Q4: Migration strategy** -- RESOLVED
Clean slate. No existing data or schemas to preserve. The app was never launched. No migration needed. Removed CON-REFACTOR-002.

**Q5: Experience tag taxonomy + Social annotation model** -- RESOLVED
16 fixed tags (see Experience Tags section) plus custom tag creation for overflow. Social annotations fully specified for both perspectives: on your own pins (PAST and FUTURE) and on friends' boards. Traced to SC-MEMORY-003, SC-SOCIAL-001, SC-NAV-006.

**Q6: Home screen / app structure + Tab memory** -- RESOLVED
No separate profile page. Memory board IS the profile. Two primary tabs: PAST (Memory board) | FUTURE (Dream board). Both default to Top 8. Tab memory stored server-side, deep links override, applies only to own boards. Traced to SC-NAV-001 through SC-NAV-007.

**Q7: Location specificity** -- RESOLVED
Free-form location input. No forced structure. Users describe places naturally. AI normalizes behind the scenes to structured data for matching/search. Region-based matching. Graceful failure for low-confidence normalization. Traced to SC-LOCATION-001, SC-LOCATION-002, SC-LOCATION-003.

**Q8: Speech-to-text service** -- RESOLVED
OpenAI Whisper API (not browser Web Speech API). Audio recorded client-side, sent to server, transcribed server-side via Whisper. Traced to SC-VOICE-006, CON-REFACTOR-007.

**Q9: Top 8 mechanics** -- RESOLVED
Independent lists for PAST and FUTURE (up to 16 total). Cap enforced at 8 per tab with swap UI. Drag-and-drop reorder persists server-side. Graceful behavior for fewer than 8 pins. Traced to SC-PROFILE-001.

**Q10: "I'm interested too!" action** -- RESOLVED
Creates a new dream pin on the friend's own board marked "Inspired by [name]". Attribution persists. Original owner notified in-app. Traced to SC-SOCIAL-003, SC-SOCIAL-004, SC-NOTIF-001.

**Q11: Dream-to-memory conversion** -- RESOLVED
Two paths: "Tell me about it" (voice flow) and "Quick add" (pre-filled form). User chooses to keep or archive the dream pin. Traced to SC-DREAM-005.

**Q12: AI feedback on structured card** -- RESOLVED
User can edit fields directly, re-record corrections (preserved verbatim), explicit save button (no auto-save). Traced to SC-VOICE-004, SC-VOICE-005.

---

## Assumptions

- **A1**: Existing auth (JWT + Google OAuth) and friendship system work correctly and will be reused as-is. -- CONFIRMED by reading existing specs and schema.
- **A2**: Clean slate -- no existing users or data to preserve. App was never launched. -- CONFIRMED by human decision (Q4).
- **A3**: Free-tier image hosting (Cloudinary or similar) is sufficient for v1 volume. -- REASONABLE assumption for early stage.
- **A4**: The refactor is a UI/UX transformation with data model changes, NOT a backend rewrite. Express routes and PostgreSQL stay; new tables added, some old tables retired. No backend framework migration. -- CONFIRMED.
- **A5**: This is a web app (responsive) not a native mobile app. -- CONFIRMED by existing React setup.
- **A6**: No real-time features in v1. Notifications are computed on page load / tab switch, not pushed via WebSocket. Standard request/response only. -- CONFIRMED.
- **A7**: Claude API is already integrated and available for voice transcript processing and location normalization. -- CONFIRMED by human.
- **A8**: Browser-based voice recording (Web Audio API / MediaRecorder) is sufficient; no native mobile recording APIs needed. -- REASONABLE for responsive web app.
- **A9**: OpenAI Whisper API key is available alongside the existing Anthropic API key. Both are configured as server-side environment variables. -- CONFIRMED.

---

## Human Concerns Resolution

| # | Human Said | Explored As | Resolution | Traced To |
|---|-----------|-------------|------------|-----------|
| 1 | "focused on single player mode" | Should social features be hidden until user has content? Or always visible but secondary? | Social annotations layered on personal content; core loop works without friends | SC-SOLO-001, SC-SOLO-003 |
| 2 | "visual pinboard" | Pinterest-like masonry layout vs uniform grid vs freeform board | Masonry/Pinterest-style grid confirmed | SC-DREAM-002, QG-VISUAL-001 |
| 3 | "let others know I can give input and advice" | Auto-generated badges vs curated highlights | Top 8 curated highlights replace auto-generated "Ask Me About" | SC-PROFILE-001, SC-PROFILE-002 |
| 4 | "fond lookback" / "excited dreaming" | Emotional tone as a design constraint, not just a feature | Documented as QG-VISUAL-001, QG-VISUAL-002. Subjective language removed from SC-* per Challenger review. | QG-VISUAL-001, QG-VISUAL-002 |
| 5 | Voice as primary input | How do users actually want to record memories? | Voice-first: record freely, Whisper transcribes, Claude structures, user reviews and commits | SC-VOICE-001 through SC-VOICE-006, CON-REFACTOR-007 |
| 6 | Free-form location | Should places be structured (country > city) or natural language? | Free-form only. AI normalizes invisibly. No dropdowns ever. Graceful failure for unverified locations. | SC-LOCATION-001, SC-LOCATION-002, SC-LOCATION-003 |
| 7 | App structure / home screen | What's the primary navigation? Separate profile page? | PAST/FUTURE tab switcher. Memory board IS the profile. No separate profile page. Tab memory server-side. | SC-NAV-001 through SC-NAV-007 |
| 8 | Challenger: SC-* have subjective criteria | BHV-1, BHV-2, BHV-3 -- emotional/aesthetic language in behavioral SC-* | Subjective language removed from SC-MEMORY-006, SC-DREAM-003, SC-SOLO-002. Concrete criteria specified. Aesthetic goals remain in QG-*. | SC-MEMORY-006, SC-DREAM-003, SC-SOLO-002 |
| 9 | Challenger: Top 8 mechanics underspecified | Cap enforcement, reorder persistence, independent lists for PAST/FUTURE | Fully specified: independent lists, cap with swap UI, drag-and-drop reorder, server-side persistence | SC-PROFILE-001 |
| 10 | Challenger: "I'm interested too!" action unclear | Creates pin vs flags interest? Attribution? | Creates new dream pin on friend's board with "Inspired by [name]" attribution. Owner notified. | SC-SOCIAL-003, SC-SOCIAL-004, SC-NOTIF-001 |
| 11 | Challenger: Dream-to-memory conversion vague | What's the actual UX flow? | Two paths: voice ("Tell me about it") and quick-add (pre-filled form). User chooses to keep or archive dream. | SC-DREAM-005 |
| 12 | Challenger: Location normalization failure unspecified | What happens when AI can't normalize? | Pin still created with "unverified" indicator. Optional clarification flow. Excluded from matching until confirmed. | SC-LOCATION-003 |
| 13 | Challenger: Social annotations unclear per context | Your pins vs friend's boards -- different perspectives | Fully specified: your PAST/FUTURE annotations and friend board annotations from your perspective | SC-SOCIAL-001, SC-NAV-006 |
| 14 | Challenger: Tab memory edge cases | Device switching, deep links, friend boards | Server-side storage, deep link override, own-boards-only | SC-NAV-004 |
| 15 | Challenger: No notification surface | How are in-app notifications shown? | Badge on tab bar + chronological list + inline highlight on triggering pin | SC-NOTIF-001 |
| 16 | Challenger: Assumptions A4 and A6 unconfirmed | Backend scope and real-time features | Both confirmed: UI/UX transformation (not backend rewrite), no real-time in v1 | A4, A6 |
| 17 | Challenger R2: Voice pipeline error states unspecified | What happens when upload/transcription/structuring fails? | Each stage shows specific error, offers Retry (same stage) and Type Instead (manual fallback with partial transcript) | SC-VOICE-007 |
| 18 | Challenger R2: AI tag assignment from voice unconstrained | Could AI invent tags outside the 16? How many tags? | AI proposes only from 16 fixed tags, max 3, zero if unclear. User adds custom during review. | SC-VOICE-003 |
| 19 | Challenger R2: Search feature underspecified | What fields? Scope? Result display? Non-friend visibility? | Global search on display name/username. User cards with stats. Non-friends see Top 8 only. | SC-NAV-005 |
| 20 | Challenger R2: Inspired pin when original deleted | What happens to attribution if pin or user is deleted? | Independent copies survive. Deleted pin: name preserved. Deleted user: anonymized. Friend can remove attribution. | SC-SOCIAL-003 |
| 21 | Challenger R2: Memory AND dream for same place | Is this allowed? How do annotations work? | Explicitly allowed as independent objects. Annotations shown separately. | SC-MEMORY-001 |
| 22 | Challenger R2: Pin privacy unaddressed | Can users hide specific pins? | No per-pin privacy in v1. All pins visible to friends. Non-friends see Top 8 only. Intentional simplification. | Non-Goals |

---

## Critical Path

**The FIRST thing the user would do after receiving this refactored app:**

1. Open the app, sign in
2. Tap the voice recording button
3. Speak freely about a favorite travel memory -- messy, emotional, stream-of-consciousness
4. See the full verbatim transcript appear
5. See AI's proposed structure: place name, experience tags, polished summary
6. Review, tweak if needed, commit
7. See a beautiful memory card appear with their words and AI-structured summary
8. Feel: "That was effortless. I want to add more."

**What "works" means for the critical path:**
- Voice recording captures audio clearly in the browser
- Transcription produces accurate verbatim text
- AI proposes sensible place name, tags, and summary from the transcript
- User can review and adjust the AI proposal
- Committing creates a visually beautiful memory card
- The card shows both the polished summary AND the verbatim transcript
- Pinboard layout looks good with even 1-2 pins (not empty/broken)
- No friend, no other content needed -- pure single-player satisfaction

**What must be in place before expanding scope:**
- Voice recording + transcription pipeline
- Claude API integration for transcript structuring
- Memory data model + creation API + visual card component
- Dream data model + creation API + pinboard layout component
- Image handling strategy (Unsplash for dreams, gradient+emoji fallback)
- These BEFORE any social features, Top 8 curation, or matching logic

**Secondary critical path (Chrome extension):** User finds a travel article, clicks extension, sees AI-proposed dream pin, taps "Add as new dream", pin appears on their Future board with source attribution.
