# Travel Together — Behavioral Spec

**Version:** 1.0  
**Date:** 2026-05-01  
**Production URL:** https://tt.pjloury.com  
**API URL:** https://travel-together-jsgy.onrender.com

---

## 1. Authentication

### 1.1 Email/Password Login (`/login`)

**Happy path:**
- Email + password form renders on page load
- Submit with valid credentials → JWT stored → redirect to `/`
- `?redirect=` param honored after login

**Error states:**
- Wrong password → "Invalid credentials" message visible, no redirect
- Non-existent email → "Invalid credentials" (same message, no account enumeration)
- Empty fields → form validation prevents submission

**Google path:**
- "Continue with Google" button renders when `VITE_GOOGLE_CLIENT_ID` is set
- Google login flow redirects to `?token=<jwt>` → logs in → redirects to `/`

**Links present:**
- "Create one" → `/register`
- "Forgot password" → `/forgot-password`

---

### 1.2 Registration (`/register`)

**Happy path:**
- Fill Display Name, Username, Email, Password (8+ chars) → submit
- New JWT issued on success → user logged in immediately → redirect to `/`
- `?ref=<code>&inviter=<id>` honored: after signup, redirect to `/user/<inverterId>`

**Error states:**
- Username taken → error message visible
- Email taken → error message visible
- Password < 8 chars → client validation blocks submission
- Passwords don't match → validation error

---

### 1.3 Forgot Password (`/forgot-password`)

- Email input + "Send Reset Link" button
- Submit any email → success screen ("Check Your Email") regardless of whether account exists
- "Back to Login" link on success screen

---

### 1.4 Reset Password (`/reset-password?token=<t>`)

- Two password fields present
- Passwords must match and be 8+ chars
- Valid token + match → "Password Reset!" → redirect to `/login` after 2s
- Invalid/missing token → error message + "Request a new link" link

---

### 1.5 Invite Join Page (`/join/:code`)

- 3-step onboarding carousel (step dots clickable)
- "Next" advances steps; final step shows "Get started" → `/register?ref=<code>`
- Valid code → inviter card (avatar, name, stats) shown
- "Already have an account? Sign in" link present
- Logged-in users redirected to `/` immediately

---

### 1.6 Memory Invite (`/m/:token`)

- "Joining the memory…" loading state
- Valid token + authenticated → "You're in!" → redirect to `/` after 1.2s
- Not authenticated → bounce through login, then return to claim
- Invalid token → error state with "Back to home" link

---

## 2. Board View

### 2.1 Home Board (`/`)

**Own board (authenticated):**
- PAST and FUTURE tabs visible; click switches instantly
- Grid shows pin cards; map icon toggles to map view (`M` hotkey)
- FAB (+) present bottom-right
- Country bar (memories tab) shows flag emojis → clickable → opens CountriesModal
- Wishlist bar (dreams tab) present → clickable → opens WishlistModal
- Social mode toggle button present (own board)

**Memory tab:**
- Sort dropdown present: "Rank (manual)", "Newest visit", "Oldest visit"
- Pins render with cover image (or gradient fallback)
- Top 8 pins show rank badges (①②③…)

**Dreams tab:**
- Discovery card renders at end of grid (idle state: dark gradient with ✦ sparkle)
- Empty state shows wishlist section with "Add countries to your wishlist"

**Loading state:**
- Spinner + rotating loading phrase visible before pins load

**Keyboard navigation (grid focus):**
- ← → switches PAST ↔ FUTURE (tab plane)
- ↓ focuses first card; arrow keys navigate grid
- Enter opens detail panel
- Esc closes detail panel

---

### 2.2 Friend's Board (`/user/:id`)

**Accepted friend:**
- Pins visible (read-only)
- No FAB or edit controls
- "Travel Together" section visible below grid (shared dreams)

**Non-friend:**
- Public profile card: avatar, name, stats, "Add friend" button
- Pin board hidden
- "Add friend" → sends request → button shows "Request sent"

**Not logged in:**
- Redirect to `/login?redirect=/user/<id>`

---

### 2.3 Deep Link Tabs

- `/user/:id/past` → forces Memory tab open
- `/user/:id/future` → forces Dream tab open

---

## 3. Pin Cards

- Cover image or deterministic gradient fallback if no image
- Country flag visible (if normalized)
- Click → opens detail panel (right-side slide-in)
- Social layer (own board, social mode ON): friend avatars/badges on card
- "I'm interested too!" button on friend's dream pin (own board, if friends)
- Dream discovery card at end of grid (own board, dreams tab)

---

## 4. Memory Detail Panel

### Own board (editable):

- Panel slides in from right
- Close button (×) works
- Editable fields: place name, rating (stars), highlights, year, tags, companions, note
- Each field saves on blur/Enter (debounced) → "Saving…" → "Saved ✓"
- Companion tagging: "👤 Tag a friend" button → opens TagFriendPanel
- Cover photo: click to open Unsplash search modal
- Additional photos: carousel with upload button
- Archive/Delete button (red/destructive)
- Escape key closes panel

### Friend's board (read-only):
- All fields visible, none editable
- No archive/delete controls

---

## 5. Dream Detail Panel

### Own board (editable):

- Panel slides in from right
- Editable fields: place name, dream note, tags, companions
- Cover photo auto-fetches from Unsplash on title change
- "I went!" button at scroll bottom → opens DreamConvertModal
- TagFriendPanel with `pinType="dream"` (invites go to dream-companion endpoint)
- Archive/Delete button

### Friend's board:
- "I'm interested too!" button visible (if friends) → adds to own dreams
- Toast: "Dream saved to your board!" on success, "You already have this dream" on duplicate

---

## 6. Dream Convert Modal

- Triggered by "I went!" button in DreamDetail
- Title: "You visited {place}!"
- Two options: "Quick convert" and "Tell it as a story"
- **Quick convert**: dream archived, memory created, undo bar appears (8s)
- **Tell it as a story**: VoiceCapture opens with dream data pre-filled

---

## 7. Memory Creation (VoiceCapture)

- Opens from FAB on memories tab or keyboard shortcut
- Form-first by default (place name, locations, tags, summary, year, rating, note)
- "Tell it as a story" toggle enables voice path
- Voice path: mic button → recording timer → stop → transcribe → AI structure → review form
- Required: place name
- Save → POST /pins (pinType=memory) → board refreshes → country bar updates (async 3-5s)
- Error states: recording permission denied, transcription failure (falls back to manual entry)

---

## 8. Dream Creation (DreamPinCreator)

- Opens from FAB on dreams tab
- Voice record → transcribe → AI insights → Unsplash photo auto-fetched
- Editable: place name, tags, dream note
- Save → POST /pins (pinType=dream) → board refreshes

---

## 9. TagFriendPanel

**Closed state:**
- "👤 Tag a friend" button visible

**Open state:**
- Search input (auto-focused), results dropdown
- "🔗 Copy invite link" button → copies shareable URL to clipboard
- Pending invites section (if any): resend/cancel actions
- Flash messages: "✓ Tagged {name}", "{name} is already tagged", "✓ Invite sent to {email}"
- No results + valid email format → invite email pre-filled in input
- "Done" button closes panel
- Escape key closes panel without bubbling to parent

**memory pinType:** POST /invites/send + auto-share with target user  
**dream pinType:** POST /invites/dream-companion with pinId

---

## 10. Discovery Card (Dreams Grid)

**Own board, dreams tab, end of grid:**

- Idle state: dark blue gradient, ✦ sparkle icon, pulsing animation
- Click idle → loading state (spinner)
- Loading → calls `/explore/suggest-dream` → shows dream suggestion with image
- Showing state: image + overlay with place name, dream note, 3 buttons:
  - "Accept" (gold) → creates dream pin, shows flash "✓ [Place] added to your dreams"
  - "Try another" → fetches new suggestion
  - "See more" → navigates to /discover
- Not shown on: friend boards, memory tab, logged-out view

---

## 11. Map View

- M key or map icon toggles map view
- All pins render as markers on Leaflet map
- Click marker → opens detail panel
- MapNavStrip at bottom: "← [pin name] →", "1 / N"
- ← → buttons navigate pins; disabled at boundaries
- Swipe left/right on strip navigates (> 40px horizontal movement)

---

## 12. Countries Modal

- Opens from country bar (memories tab)
- Map view: world map with visited countries highlighted
- Click country → tooltip with name
- List view: countries grouped by continent
- Search autocomplete → click → adds country (optimistic update)
- Remove button (×) → deletes country + all pins for it
- Confirmation before removal

---

## 13. Wishlist Modal

- Opens from wishlist bar (dreams tab)
- Map view: wishlist countries (one color), visited (grayed)
- List view: wishlist countries + remove button
- Search → add country (validation: not already visited, not already wishlisted)
- Count: "N on wishlist"

---

## 14. Friends Page (`/friends`)

### Sections:
1. **Pending requests** (if any): Accept/Decline per request
2. **Friends map**: world map of where friends have been
3. **Your Friends**: grid of friend cards (avatar, name, stats, × remove)
4. **People you may know**: suggested users with "Add" button
5. **Find friends**: search bar → results with status badges
6. **Invite friends**: generate link + email invite textarea

### Behaviors:
- Accept request → request disappears, friend added
- Decline → request disappears
- Remove friend (×) → confirm → friendship deleted
- Search → results show Connected/Pending/Sent/Add states
- No results + valid email → "Send invite to [email]" button
- Generate link → shareable URL appears + Copy/Share buttons
- "Copy" shows "✓ Copied" for 2s
- Email textarea → comma/newline separated → "N invitations sent" message

---

## 15. Discover Page (`/discover`)

### Trips tab (default):
- Trip grid (2-3 columns)
- Each card: cover image, region/country, city, trip title, tag chips, "✦ For you" badge (personalized)
- Region filter tabs (if 3+ regions)
- Generate bar (logged-in): input + "✦ Generate" button
- Click card → TripDetail panel

### TripDetail panel:
- Close (×)
- Cover image + title + region + description
- "✦ Add {city} to my dreams" button
- "🌍 I've been to {city}" → TripMergePicker modal
- Itinerary: day-by-day experiences with "+" to add each to dreams
- "+" on experience → toast "✓ {title} added to your dreams"
- Logged-out: signup prompt with Sign up / Sign in links

### TripMergePicker modal:
- List of user's memories → click to merge
- "Create new memory" option
- Confetti on success

### Gallery tab:
- Photo grid of travel photography
- Lightbox on click
- Attribution visible

### Resorts tab:
- Resort card grid
- Click → detail view
- "Add to dreams" button

---

## 16. Settings (`/settings`)

- Email field (read-only, greyed)
- Username field (max 30 chars, editable)
- Display Name field (max 100 chars, editable)
- "Save Changes" button
- Success: "Profile updated successfully!" → page reloads
- Error (username taken): inline red error under username field
- Cover photos info card (read-only, no action)

---

## 17. Welcome Modal (First-Time Users)

- 4-step carousel (dots clickable)
- "Skip" (top-right) → dismiss
- "Next" advances; final step has "Start adding memories" and "Invite friends first"
- After dismiss: `localStorage.setItem('tt_welcome_seen', '1')` prevents re-show
- Should not appear on subsequent logins

---

## 18. Unsplash Photo Search

- Search input → grid of results
- Click image → applies to pin as cover
- Attribution shown: "Photo by {name} via Unsplash"
- "Cancel" closes without saving

---

## 19. Notifications

- Bell icon in navbar (if authenticated)
- Notification types: friend request, memory share, dream companion invite
- Click notification → navigates to relevant content
- Mark as read on view

---

## 20. Error States (Global)

| Scenario | Expected behavior |
|---|---|
| API unreachable | Spinner loops; no crash |
| 401 on protected route | Redirect to `/login?redirect=<path>` |
| 404 on pin/user | Error message shown, no crash |
| Photo upload fails | "Could not upload photo" error toast |
| Voice recording denied | "Permission denied — type instead" fallback |
| Transcription fails | "Could not transcribe — fill in manually" |
| Invalid invite token | Error message + "Back to home" link |

---

## 21. Keyboard Shortcuts (Board View)

| Key | Context | Action |
|---|---|---|
| `M` | Board | Toggle map/grid view |
| `G` | Board | Toggle map/grid view (alias) |
| `←` `→` | Tab plane | Switch PAST ↔ FUTURE |
| `↓` | Tab plane | Enter grid, focus first card |
| `↑` | Top row of grid | Return to tab plane |
| `←` `→` `↑` `↓` | Grid | Move between cards |
| `Enter` | Grid | Open detail panel |
| `Esc` | Detail open | Close detail panel |
| `←` `→` | Detail open | Cycle to prev/next pin |

---

## 22. Responsive Layout

- Mobile: single column, bottom nav bar
- Tablet: 2-column grid
- Desktop: 3-4 column grid, side panel for detail
- Detail panel: full-screen on mobile, right-side slide-in on desktop

---

## 23. Performance Requirements

- Board load: < 2s on fast connection after auth
- Pin detail open: < 200ms (panel slides in immediately; data loads async if needed)
- Country bar update after pin creation: ≤ 5s
- Unsplash photo fetch: < 3s or error shown

---

## 24. Test Accounts

For automated regression tests:

- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`: env vars used by Playwright
- A second account `TEST_FRIEND_EMAIL` / `TEST_FRIEND_PASSWORD` for social tests
- Both accounts should be pre-populated with at least 1 memory and 1 dream pin

---
