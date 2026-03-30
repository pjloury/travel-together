# Travel Together -- Chrome Extension Specification

## Intent Traceability

| SC-* | Success Criterion | REQ-*/SCN-*/INV-* |
|------|-------------------|-------------------|
| SC-EXTENSION-001 | Chrome extension installable; Google OAuth via chrome.identity; JWT in chrome.storage.local | REQ-EXT-001, SCN-EXT-001-01, SCN-EXT-001-02 |
| SC-EXTENSION-002 | Extract up to 5 images (og:image first, then by pixel area), title, URL, 500 words of text | REQ-EXT-002, SCN-EXT-002-01 |
| SC-EXTENSION-003 | AI proposes place name, up to 3 tags, summary from extracted content | REQ-EXT-003, SCN-EXT-003-01 |
| SC-EXTENSION-004 | "Add as new dream" creates dream pin with source attribution visible to friends | REQ-EXT-004, SCN-EXT-004-01 |
| SC-EXTENSION-005 | "Add to existing dream" appends to inspiration_resources array | REQ-EXT-005, SCN-EXT-005-01 |
| SC-EXTENSION-006 | Full flow completes within toolbar popup, no new tab | REQ-EXT-006 |
| SC-EXTENSION-007 | No usable photo falls back to Unsplash/gradient | REQ-EXT-007 |

---

## Section 1: Overview

The Travel Together Chrome Extension is a Manifest V3 browser extension that lets users pin travel inspiration from any webpage to their dream board. It is a separate deployable artifact, published to the Chrome Web Store, that calls the same backend API as the main web app.

### Technical Profile

| Property | Value |
|----------|-------|
| Manifest Version | 3 |
| Minimum Chrome Version | 110 |
| Permissions | `activeTab`, `scripting`, `storage`, `identity` |
| Host Permissions | Backend API origin (e.g., `https://api.travel-together.app/*`) |
| Backend | Same Express API as main web app -- no new server-side services |

### File Structure

```
extension/
  manifest.json
  popup/
    popup.html
    popup.js
    popup.css
  background/
    service-worker.js
  content/
    extractor.js
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
```

---

## Section 2: Auth Flow

<!-- REQ-EXT-001: satisfies SC-EXTENSION-001 -->

### Initial Authentication (first-time user)

1. User opens extension popup.
2. Popup reads `chrome.storage.local.get('jwt')`.
3. If no JWT found: show "Sign in with Google" button.
4. User clicks sign in:
   ```js
   chrome.identity.launchWebAuthFlow({
     url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${chrome.identity.getRedirectURL()}&response_type=token+id_token&scope=openid+email+profile&nonce=${crypto.randomUUID()}`,
     interactive: true
   }, (redirectUrl) => {
     // Extract id_token from URL fragment
     const params = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
     const idToken = params.get('id_token');
     // Send to backend
     fetch(`${API_BASE}/api/auth/google`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ credential: idToken })
     })
     .then(res => res.json())
     .then(data => {
       chrome.storage.local.set({ jwt: data.token, user: data.user });
     });
   });
   ```
5. JWT stored in `chrome.storage.local` (persists across browser sessions).

### Subsequent Opens

1. Popup reads JWT from `chrome.storage.local`.
2. If JWT exists: verify by calling `GET /api/auth/me` with `Authorization: Bearer <jwt>`.
3. If valid: proceed to extraction flow.
4. If 401 (expired): attempt silent re-auth via `chrome.identity.launchWebAuthFlow` with `interactive: false`.
   - If silent re-auth succeeds: store new JWT, proceed.
   - If fails (Google session also expired): show "Sign in with Google" button again.

### Token Refresh Strategy

JWTs expire after 7 days (matching web app). The extension checks validity on each popup open. If within 1 day of expiry, proactively refresh via silent `launchWebAuthFlow`.

---

## Section 3: Content Extraction

<!-- REQ-EXT-002: satisfies SC-EXTENSION-002 -->

### Extraction via Content Script

When the user opens the popup (authenticated), the popup sends a message to the background service worker, which injects a content script into the active tab:

```js
// popup.js
chrome.runtime.sendMessage({ action: 'extract' });

// service-worker.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extract') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['content/extractor.js']
      });
    });
  }
});
```

### Extractor Logic (`content/extractor.js`)

The content script extracts data and sends it back via `chrome.runtime.sendMessage`:

```js
function extract() {
  // 1. Images
  const images = [];

  // og:image first
  const ogImage = document.querySelector('meta[property="og:image"]')?.content;
  if (ogImage) {
    images.push({ url: ogImage, source: 'og:image', area: Infinity });
  }

  // All images on page, sorted by pixel area
  const allImages = Array.from(document.querySelectorAll('img'))
    .filter(img => {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      return w >= 200 && h >= 200;  // minimum threshold
    })
    .map(img => ({
      url: img.src,
      source: 'page',
      area: (img.naturalWidth || img.width) * (img.naturalHeight || img.height)
    }))
    .sort((a, b) => b.area - a.area);

  // Deduplicate by URL, take top 4 page images
  const seen = new Set(images.map(i => i.url));
  for (const img of allImages) {
    if (!seen.has(img.url) && images.length < 5) {
      seen.add(img.url);
      images.push(img);
    }
  }

  // 2. Title + URL
  const title = document.querySelector('meta[property="og:title"]')?.content
    || document.title;
  const url = document.querySelector('link[rel="canonical"]')?.href
    || window.location.href;

  // 3. Text content
  const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
  const bodyText = document.body.innerText
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 500)
    .join(' ');
  const textContent = (ogDesc.slice(0, 500) + '\n\n' + bodyText).trim();

  chrome.runtime.sendMessage({
    action: 'extractionResult',
    data: {
      images,      // Array of { url, source, area }
      title,       // string
      pageUrl: url, // string
      domain: new URL(url).hostname.replace('www.', ''),
      textContent  // string (og:description + body text, max ~500 words)
    }
  });
}

extract();
```

### Extraction Result Handling

The service worker receives the extraction result and forwards it to the popup:

```js
// service-worker.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'extractionResult') {
    // Save to session storage for draft persistence
    chrome.storage.session.set({ draft: msg.data });
    // Forward to popup if open
    chrome.runtime.sendMessage({ action: 'extractionReady', data: msg.data });
  }
});
```

---

## Section 4: AI Processing

<!-- REQ-EXT-003: satisfies SC-EXTENSION-003 -->

### Endpoint

The extension uses the same `/api/voice/structure` endpoint as the web app, but with the page text content as the "transcript":

```js
const response = await fetch(`${API_BASE}/api/voice/structure`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwt}`
  },
  body: JSON.stringify({
    transcript: `Page title: ${extractedData.title}\n\nContent: ${extractedData.textContent}`,
    correctionTranscript: null,
    existingTags: userTags,  // from cached user data
    context: 'dream'
  })
});
```

The existing Claude prompt in `/api/voice/structure` handles both voice transcripts and page content. The `context: 'dream'` parameter tells Claude to frame the output as an aspiration rather than a memory.

### Response

Same shape as the voice structuring endpoint:
```json
{
  "success": true,
  "data": {
    "placeName": "Santorini",
    "tags": ["Beach & Water", "Architecture & Streets"],
    "summary": "A stunning Greek island known for its white-washed buildings perched on volcanic cliffs, world-class sunsets over the caldera, and crystal-clear Aegean waters.",
    "confidence": 0.95
  }
}
```

### Error Handling

If AI processing fails:
- Show: "Could not analyze this page automatically."
- Provide manual form: place name (pre-filled with page title), tag picker, summary text area.
- User can still create the pin manually.

---

## Section 5: Pin Creation UI (Popup)

<!-- REQ-EXT-004: satisfies SC-EXTENSION-004 -->
<!-- REQ-EXT-005: satisfies SC-EXTENSION-005 -->
<!-- REQ-EXT-006: satisfies SC-EXTENSION-006 -->
<!-- REQ-EXT-007: satisfies SC-EXTENSION-007 -->

### Popup Dimensions

Width: 400px (Chrome extension popup standard).
Min height: 500px. Max height: 600px (scrollable).

### State Machine

```
[auth_check] --> [signed_out] --> (sign in) --> [auth_check]
     |
     v
[extracting] --> [error_extract] --> (retry) --> [extracting]
     |
     v
[image_picker] --> [ai_processing] --> [review] --> [action_choice]
                        |                               |
                        v                          [new_dream] --> [saving] --> [success]
                  [error_ai] --> (manual)                |
                                    |              [add_existing] --> [saving] --> [success]
                                    v
                              [review (manual)]
```

### States

#### `auth_check`
On popup open. Read `chrome.storage.local` for JWT. Validate. Transition to `signed_out` or `extracting`.

Check for existing draft in `chrome.storage.session`. If found, show "Resume draft?" prompt at top. If user taps resume, skip to `image_picker` or `review` depending on draft state.

#### `signed_out`
Show: Travel Together logo + "Sign in with Google" button.

#### `extracting`
Show: "Analyzing page..." with spinner.
Inject content script. Wait for extraction result (5 second timeout).

Error: If injection fails or times out, show "Could not read this page. Try refreshing." + [Retry].

#### `image_picker`
Show extracted images as a horizontal strip of thumbnails (up to 5).
- If 1 image: show it directly, no picker needed.
- If 0 images: skip to `ai_processing` with no selected image.
- User taps a thumbnail to select it (highlighted border).
- "Continue" button transitions to `ai_processing`.

#### `ai_processing`
Show: selected image (large preview) + "Analyzing content..." spinner below.
Call `/api/voice/structure` with extracted text content.

Save AI response to `chrome.storage.session` draft.

Error: Show extracted image + manual form. "Could not analyze automatically. Fill in details below."

#### `review`
Show:
- Selected image (or "No image" placeholder)
- Editable place name (text input, pre-filled by AI or page title)
- Tag chips (16 fixed tags, pre-selected by AI, tappable to toggle)
- Editable summary (text area, pre-filled by AI)
- Source attribution: "Pinned from {domain}" (non-editable, auto-populated)

"Choose action" button at bottom.

#### `action_choice`
Modal overlay or bottom sheet with two options:

**"Add as new dream"**
- Transitions to `saving` with `POST /api/pins`:
  ```json
  {
    "pinType": "dream",
    "placeName": "Santorini",
    "aiSummary": "...",
    "photoUrl": "https://example.com/photo.jpg",
    "photoSource": "extension",
    "tags": [{ "experienceTagId": 4 }, { "experienceTagId": 9 }]
  }
  ```
- After pin creation, also creates a resource: `POST /api/pins/:newId/resources`:
  ```json
  {
    "sourceUrl": "https://example.com/article",
    "domainName": "example.com",
    "photoUrl": null,
    "excerpt": "First 280 chars of AI summary"
  }
  ```

**"Add to existing dream"**
- Shows searchable list of user's existing dream pins.
- List loaded from `GET /api/pins?type=dream&userId={self}` on first open, cached in `chrome.storage.session`.
- User types to filter (client-side, by `placeName` substring match).
- Each list item shows: pin name + primary tag emoji + small thumbnail.
- Selecting a pin transitions to `saving` with `POST /api/pins/:selectedId/resources`:
  ```json
  {
    "sourceUrl": "https://example.com/article",
    "domainName": "example.com",
    "photoUrl": "https://example.com/selected-photo.jpg",
    "excerpt": "First 280 chars of AI summary"
  }
  ```

#### `saving`
Show: "Saving..." spinner.
On success: transition to `success`. Clear draft from `chrome.storage.session`.
On error: "Could not save. Check your connection." + [Retry] + [Cancel].

#### `success`
Show: checkmark animation + "Pinned to your dream board!" + pin card preview.
"View on board" link: opens `${WEB_APP_URL}/` in new tab.
Auto-close popup after 3 seconds, or user closes manually.

### Draft Persistence

After content extraction completes (transition out of `extracting`), save all state to `chrome.storage.session`:

```js
chrome.storage.session.set({
  draft: {
    extractedData,     // images, title, url, text
    selectedImageUrl,  // user's choice
    aiProposal,        // place name, tags, summary
    userEdits,         // any field edits the user made
    state: 'review'    // current state name
  }
});
```

On popup reopen: if draft exists in `chrome.storage.session`, show "Resume where you left off?" banner. Tapping it restores the state. Tapping "Start fresh" clears the draft and begins extraction on the current page.

`chrome.storage.session` is cleared automatically when the browser session ends (all Chrome windows closed). This is intentional -- drafts should not persist indefinitely.

---

## Section 6: API Integration

### Endpoints Used

| Action | Endpoint | Notes |
|--------|----------|-------|
| Auth | `POST /api/auth/google` | Existing -- exchange Google ID token for JWT |
| Validate JWT | `GET /api/auth/me` | Existing -- check if JWT is still valid |
| AI Processing | `POST /api/voice/structure` | Existing -- same endpoint as voice pipeline |
| Create Dream Pin | `POST /api/pins` | Defined in app spec |
| Add Resource | `POST /api/pins/:id/resources` | Defined in app spec |
| List User Dreams | `GET /api/pins?type=dream` | Defined in app spec -- for "add to existing" list |
| List Tags | `GET /api/tags` | Defined in app spec -- for user's existing tags |

### New Endpoint Needed

None. The extension reuses all existing endpoints from the app spec. The `GET /api/pins?type=dream` endpoint with the user's own `userId` returns all their dream pins, which is sufficient for the "add to existing" searchable list.

### CORS

The backend must allow requests from the extension origin. Chrome extensions make requests from the `chrome-extension://{extension-id}` origin. The Express CORS configuration must include this:

```js
const cors = require('cors');
app.use(cors({
  origin: [
    'https://travel-together.app',                    // web app production
    /\.vercel\.app$/,                                  // Vercel previews
    'http://localhost:5173',                            // local dev
    /^chrome-extension:\/\//                           // Chrome extensions
  ],
  credentials: true
}));
```

### API Base URL

The extension stores the API base URL in the manifest or as a constant:

```js
// In popup.js or a shared config
const API_BASE = 'https://api.travel-together.app';  // production
// For development: can be overridden via chrome.storage.local.set({ apiBase: 'http://localhost:3000' })
```

---

## Section 7: Manifest

```json
{
  "manifest_version": 3,
  "name": "Travel Together - Pin Your Dreams",
  "version": "1.0.0",
  "description": "Save travel inspiration from any webpage to your dream board",
  "permissions": [
    "activeTab",
    "scripting",
    "storage",
    "identity"
  ],
  "host_permissions": [
    "https://api.travel-together.app/*"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "oauth2": {
    "client_id": "${GOOGLE_CLIENT_ID}",
    "scopes": ["openid", "email", "profile"]
  },
  "minimum_chrome_version": "110"
}
```

---

## Appendix A: Decisions Made During Spec

1. **Reuse `/api/voice/structure` for page content**: Rather than creating a separate `/api/extension/process` endpoint, the extension passes page text content as the "transcript" to the existing structuring endpoint. The Claude prompt handles both voice transcripts and page text without modification because it looks for place names and travel content regardless of source.

2. **No new API endpoints**: The extension is a pure client of the existing app API. All needed endpoints are defined in the app spec. This keeps the backend simple and avoids API surface sprawl.

3. **Image minimum threshold 200x200px**: Images smaller than 200x200 pixels are filtered out during extraction. This prevents logos, icons, and tiny decorative images from cluttering the image picker.

4. **Draft uses `chrome.storage.session`**: Session storage (cleared on browser close) rather than `chrome.storage.local` (persists forever). This prevents stale drafts from accumulating. Per FM-EXTENSION-004, drafts persist within a browser session, which covers the "user accidentally closes popup" case.

5. **Source attribution as a `pin_resource`**: When creating a new dream from the extension, the source webpage is stored as the first entry in `pin_resources` rather than as a separate field on the pin. This keeps the data model unified -- all external sources are resources.

6. **Extension popup dimensions**: 400px wide x 500-600px tall. This is within Chrome's default popup size limits (800x600) and provides enough room for the image picker, form fields, and action buttons without scrolling in most cases.

7. **"Add to existing" list caching**: The user's dream pins list is fetched once per popup open and cached in `chrome.storage.session`. Client-side filtering is used rather than server-side search to minimize API calls and provide instant-feel filtering.
