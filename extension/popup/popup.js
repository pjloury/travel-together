// Popup controller for Travel Together Chrome Extension.
//
// Spec: docs/extension/spec.md (Section 5)
// Contract: docs/extension/spec.md (Section 6)
//
// @implements REQ-EXT-001, REQ-EXT-002, REQ-EXT-003, REQ-EXT-004, REQ-EXT-005, REQ-EXT-006, REQ-EXT-007

/**
 * Experience tags as defined in the spec.
 * @implements SCN-EXT-003-01
 */
const EXPERIENCE_TAGS = [
  { id: 1,  name: 'Beach & Water',          emoji: '\u{1F3D6}\u{FE0F}' },
  { id: 2,  name: 'Outdoor Adventures',     emoji: '\u{1F9D7}' },
  { id: 3,  name: 'Winter Sports',          emoji: '\u{26F7}\u{FE0F}' },
  { id: 4,  name: 'City & Culture',         emoji: '\u{1F3D9}\u{FE0F}' },
  { id: 5,  name: 'Food & Drink',           emoji: '\u{1F35C}' },
  { id: 6,  name: 'Architecture & Streets', emoji: '\u{1F3DB}\u{FE0F}' },
  { id: 7,  name: 'Nature & Landscapes',    emoji: '\u{1F3DE}\u{FE0F}' },
  { id: 8,  name: 'Nightlife',              emoji: '\u{1F389}' },
  { id: 9,  name: 'Wellness & Spa',         emoji: '\u{1F9D8}' },
  { id: 10, name: 'History & Heritage',     emoji: '\u{1F3EF}' },
  { id: 11, name: 'Road Trips',             emoji: '\u{1F697}' },
  { id: 12, name: 'Festivals & Events',     emoji: '\u{1F3AA}' },
  { id: 13, name: 'Photography',            emoji: '\u{1F4F8}' },
  { id: 14, name: 'Sports & Stadiums',      emoji: '\u{1F3DF}\u{FE0F}' },
  { id: 15, name: 'Family & Kids',          emoji: '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}' },
  { id: 16, name: 'Romance & Couples',      emoji: '\u{1F491}' },
];

const WEB_APP_URL = 'https://travel-together-tau.vercel.app';

// State
let API_BASE = 'https://travel-together-api.onrender.com';
let jwt = null;
let user = null;
let extractedData = null;
let selectedImageUrl = null;
let aiProposal = null;
let userEdits = { placeName: '', tags: [], summary: '' };
let selectedExistingPinId = null;
let dreamPinsCache = null;
let currentState = 'auth_check';
let autoCloseTimer = null;
let userTagsCache = null;

const app = document.getElementById('app');

// ---- Initialization ----

/**
 * init loads configuration and starts the auth check flow.
 *
 * @implements REQ-EXT-001, SCN-EXT-001-01
 */
async function init() {
  // Load API base URL override from storage
  const stored = await chrome.storage.local.get('apiBase');
  if (stored.apiBase) {
    API_BASE = stored.apiBase;
  }

  // Listen for extraction results from background service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'extractionReady') {
      extractedData = msg.data;
      transitionToImagePicker();
    }
  });

  setState('auth_check');
}

// ---- State Machine ----

/**
 * setState transitions to a named state and renders the corresponding UI.
 *
 * @implements REQ-EXT-006
 */
function setState(name) {
  currentState = name;
  if (autoCloseTimer) {
    clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
  }

  switch (name) {
    case 'auth_check':     renderAuthCheck(); break;
    case 'signed_out':     renderSignedOut(); break;
    case 'extracting':     renderExtracting(); break;
    case 'image_picker':   renderImagePicker(); break;
    case 'ai_processing':  renderAiProcessing(); break;
    case 'review':         renderReview(); break;
    case 'action_choice':  renderActionChoice(); break;
    case 'new_dream':      saveAsNewDream(); break;
    case 'add_existing':   renderAddExisting(); break;
    case 'saving':         renderSavingSpinner(); break;
    case 'success':        renderSuccess(); break;
    case 'error_extract':  renderExtractError(); break;
    case 'error_ai':       renderAiError(); break;
    default: break;
  }
}

// ---- Auth ----

/**
 * renderAuthCheck validates the stored JWT and transitions accordingly.
 *
 * @implements REQ-EXT-001, SCN-EXT-001-01, SCN-EXT-001-02
 */
async function renderAuthCheck() {
  app.innerHTML = `
    <div class="state active text-center">
      <div class="spinner"></div>
      <p>Checking authentication...</p>
    </div>
  `;

  const stored = await chrome.storage.local.get(['jwt', 'user']);
  if (!stored.jwt) {
    setState('signed_out');
    return;
  }

  jwt = stored.jwt;
  user = stored.user;

  // Validate JWT with backend
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });

    if (res.ok) {
      const data = await res.json();
      user = data.user || data;
      // Proactive JWT refresh if token expires within 24 hours
      proactiveTokenRefresh();
      // Pre-fetch user tags for AI context (fire and forget)
      fetchUserTags();
      // Check for existing draft
      await checkForDraft();
      return;
    }

    if (res.status === 401) {
      // Attempt silent re-auth
      const success = await silentReauth();
      if (success) {
        await checkForDraft();
        return;
      }
    }

    // Auth failed
    jwt = null;
    user = null;
    setState('signed_out');
  } catch (err) {
    // Network error -- try to proceed if we have a JWT (offline-tolerant)
    setState('signed_out');
  }
}

/**
 * silentReauth attempts a non-interactive Google OAuth flow.
 *
 * @implements REQ-EXT-001, SCN-EXT-001-02
 *
 * @returns {Promise<boolean>} true if re-auth succeeded
 */
function silentReauth() {
  return new Promise((resolve) => {
    const GOOGLE_CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token+id_token&scope=openid+email+profile&nonce=${crypto.randomUUID()}`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: false }, async (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        resolve(false);
        return;
      }
      try {
        const params = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
        const idToken = params.get('id_token');
        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: idToken })
        });
        const data = await res.json();
        jwt = data.token;
        user = data.user;
        await chrome.storage.local.set({ jwt: data.token, user: data.user });
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * proactiveTokenRefresh checks if the JWT expires within 24 hours and
 * silently refreshes it if so. Does not block the user on failure.
 *
 * @implements REQ-EXT-001
 */
function proactiveTokenRefresh() {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return;
    const msUntilExpiry = payload.exp * 1000 - Date.now();
    if (msUntilExpiry < 86400000) {
      // Token expires within 24 hours -- attempt silent refresh
      silentReauth().then((success) => {
        if (success) {
          // jwt and storage already updated by silentReauth
        }
      }).catch(() => {
        // Proactive refresh failed -- proceed with existing JWT
      });
    }
  } catch {
    // Decode failed -- proceed with existing JWT
  }
}

/**
 * checkForDraft checks chrome.storage.session for a saved draft and either
 * shows the resume banner or proceeds to extraction.
 *
 * @implements REQ-EXT-006
 */
async function checkForDraft() {
  const stored = await chrome.storage.session.get('draft');
  if (stored.draft && stored.draft.state) {
    // Show resume banner
    renderResumeBanner(stored.draft);
  } else if (stored.draft && stored.draft.images) {
    // Raw extraction data from service worker, show resume banner
    renderResumeBanner({ extractedData: stored.draft, state: 'image_picker' });
  } else {
    setState('extracting');
  }
}

/**
 * fetchUserTags fetches the user's existing tags for AI context.
 * Cached per popup session in a module-level variable.
 * Falls back to [] silently on failure.
 *
 * @implements REQ-EXT-003
 */
async function fetchUserTags() {
  if (userTagsCache !== null) return userTagsCache;
  try {
    const res = await fetch(`${API_BASE}/api/tags`, {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    if (res.ok) {
      const data = await res.json();
      const tags = data.tags || data;
      userTagsCache = tags.map(t => t.name || t).filter(Boolean);
    } else {
      userTagsCache = [];
    }
  } catch {
    userTagsCache = [];
  }
  return userTagsCache;
}

/**
 * renderResumeBanner shows the "Resume where you left off?" banner.
 */
function renderResumeBanner(draft) {
  app.innerHTML = `
    <div class="state active">
      <div class="resume-banner">
        <p>Resume where you left off?</p>
        <div class="banner-actions">
          <button id="btn-resume" class="btn-primary" style="flex:1">Resume</button>
          <button id="btn-fresh" class="btn-secondary" style="flex:1">Start fresh</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-resume').addEventListener('click', () => {
    // Restore draft state
    if (draft.extractedData) extractedData = draft.extractedData;
    if (draft.selectedImageUrl) selectedImageUrl = draft.selectedImageUrl;
    if (draft.aiProposal) aiProposal = draft.aiProposal;
    if (draft.userEdits) userEdits = draft.userEdits;

    const targetState = draft.state || 'image_picker';
    setState(targetState);
  });

  document.getElementById('btn-fresh').addEventListener('click', async () => {
    await chrome.storage.session.remove('draft');
    extractedData = null;
    selectedImageUrl = null;
    aiProposal = null;
    userEdits = { placeName: '', tags: [], summary: '' };
    setState('extracting');
  });
}

/**
 * renderSignedOut shows the sign-in screen.
 *
 * @implements REQ-EXT-001, SCN-EXT-001-01
 */
function renderSignedOut() {
  app.innerHTML = `
    <div class="state active text-center">
      <h2 style="margin-bottom:8px;">Travel Together</h2>
      <p style="color:#6b7280;margin-bottom:24px;">Pin travel inspiration to your dream board</p>
      <button id="btn-signin" class="btn-primary">Sign in with Google</button>
    </div>
  `;

  document.getElementById('btn-signin').addEventListener('click', () => {
    const GOOGLE_CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token+id_token&scope=openid+email+profile&nonce=${crypto.randomUUID()}`;

    chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, async (redirectUrl) => {
      if (chrome.runtime.lastError || !redirectUrl) {
        app.querySelector('.state').insertAdjacentHTML('beforeend',
          '<p class="error-msg mt-8">Sign in failed. Please try again.</p>');
        return;
      }
      try {
        const params = new URLSearchParams(new URL(redirectUrl).hash.substring(1));
        const idToken = params.get('id_token');
        const res = await fetch(`${API_BASE}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: idToken })
        });
        const data = await res.json();
        jwt = data.token;
        user = data.user;
        await chrome.storage.local.set({ jwt: data.token, user: data.user });
        setState('auth_check');
      } catch {
        app.querySelector('.state').insertAdjacentHTML('beforeend',
          '<p class="error-msg mt-8">Sign in failed. Please try again.</p>');
      }
    });
  });
}

// ---- Extraction ----

/**
 * renderExtracting injects the content script and waits for results.
 *
 * @implements REQ-EXT-002, SCN-EXT-002-01
 */
function renderExtracting() {
  app.innerHTML = `
    <div class="state active text-center">
      <div class="spinner"></div>
      <p>Analyzing page...</p>
    </div>
  `;

  // Send extract message to background service worker
  chrome.runtime.sendMessage({ action: 'extract' });

  // Timeout after 5 seconds
  setTimeout(() => {
    if (currentState === 'extracting' && !extractedData) {
      setState('error_extract');
    }
  }, 5000);
}

/**
 * renderExtractError shows the extraction error state.
 *
 * @implements REQ-EXT-002
 */
function renderExtractError() {
  app.innerHTML = `
    <div class="state active text-center">
      <p class="error-msg">Could not read this page. Try refreshing.</p>
      <button id="btn-retry-extract" class="btn-primary mt-16">Retry</button>
    </div>
  `;
  document.getElementById('btn-retry-extract').addEventListener('click', () => {
    setState('extracting');
  });
}

/**
 * transitionToImagePicker moves from extracting to image_picker.
 */
function transitionToImagePicker() {
  if (currentState !== 'extracting') return;

  // Save draft after extraction
  saveDraft('image_picker');

  // Skip image picker if 0 images
  if (!extractedData.images || extractedData.images.length === 0) {
    selectedImageUrl = null;
    setState('ai_processing');
    return;
  }

  // Skip picker if only 1 image -- auto-select it
  if (extractedData.images.length === 1) {
    selectedImageUrl = extractedData.images[0].url;
    setState('ai_processing');
    return;
  }

  setState('image_picker');
}

// ---- Image Picker ----

/**
 * renderImagePicker shows extracted images as a horizontal thumbnail strip.
 *
 * @implements REQ-EXT-002, SCN-EXT-002-01
 */
function renderImagePicker() {
  // Default to first image selected
  if (!selectedImageUrl && extractedData.images.length > 0) {
    selectedImageUrl = extractedData.images[0].url;
  }

  let thumbsHtml = extractedData.images.map((img, idx) => {
    const sel = img.url === selectedImageUrl ? 'selected' : '';
    return `<img class="image-thumb ${sel}" data-idx="${idx}" src="${escapeAttr(img.url)}" alt="Image ${idx + 1}">`;
  }).join('');

  app.innerHTML = `
    <div class="state active">
      <h3 class="mb-8">Choose an image</h3>
      <div class="image-strip">${thumbsHtml}</div>
      <button id="btn-continue-img" class="btn-primary mt-16">Continue</button>
    </div>
  `;

  // Thumbnail click handler
  app.querySelectorAll('.image-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      app.querySelectorAll('.image-thumb').forEach(t => t.classList.remove('selected'));
      thumb.classList.add('selected');
      selectedImageUrl = extractedData.images[parseInt(thumb.dataset.idx)].url;
    });
  });

  document.getElementById('btn-continue-img').addEventListener('click', () => {
    setState('ai_processing');
  });
}

// ---- AI Processing ----

/**
 * renderAiProcessing sends extracted content to the AI endpoint and shows a spinner.
 *
 * @implements REQ-EXT-003, SCN-EXT-003-01
 */
async function renderAiProcessing() {
  let previewHtml = selectedImageUrl
    ? `<img class="image-preview" src="${escapeAttr(selectedImageUrl)}" alt="Selected image">`
    : '';

  app.innerHTML = `
    <div class="state active text-center">
      ${previewHtml}
      <div class="spinner"></div>
      <p>Analyzing content...</p>
    </div>
  `;

  try {
    // Ensure user tags are fetched (may already be cached)
    const existingTags = await fetchUserTags();

    const response = await fetch(`${API_BASE}/api/voice/structure`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        transcript: `Page title: ${extractedData.title}\n\nContent: ${extractedData.textContent}`,
        correctionTranscript: null,
        existingTags,
        context: 'dream'
      })
    });

    if (!response.ok) {
      throw new Error(`AI processing failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success && result.data) {
      aiProposal = result.data;

      // Map AI tag names to EXPERIENCE_TAGS ids
      const aiTagIds = (aiProposal.tags || []).map(tagName => {
        const match = EXPERIENCE_TAGS.find(t => t.name === tagName);
        return match ? match.id : null;
      }).filter(Boolean).slice(0, 3);

      userEdits = {
        placeName: aiProposal.placeName || extractedData.title,
        tags: aiTagIds,
        summary: aiProposal.summary || ''
      };

      // SC-EXTENSION-007: Unsplash fallback when no page image was extracted
      const aiPlaceName = aiProposal.place_name || aiProposal.placeName;
      if (!selectedImageUrl && aiPlaceName) {
        try {
          const unsplashRes = await fetch(`${API_BASE}/api/location/unsplash`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify({
              placeName: aiPlaceName,
              tags: (aiProposal.tags || [])
            })
          });
          if (unsplashRes.ok) {
            const unsplashData = await unsplashRes.json();
            if (!unsplashData.fallback && unsplashData.imageUrl) {
              selectedImageUrl = unsplashData.imageUrl;
              // Store attribution if provided
              if (unsplashData.attribution) {
                extractedData.unsplashAttribution = unsplashData.attribution;
              }
            }
          }
        } catch {
          // Unsplash fetch failed silently -- proceed without image
        }
      }

      // Save draft with AI result
      saveDraft('review');

      setState('review');
    } else {
      throw new Error('AI returned no data');
    }
  } catch (err) {
    // AI failed: show manual form per spec Section 4 Error Handling
    setState('error_ai');
  }
}

/**
 * renderAiError shows the manual form when AI processing fails.
 *
 * @implements REQ-EXT-003
 */
function renderAiError() {
  userEdits = {
    placeName: extractedData.title || '',
    tags: [],
    summary: ''
  };

  let previewHtml = selectedImageUrl
    ? `<img class="image-preview" src="${escapeAttr(selectedImageUrl)}" alt="Selected image">`
    : '';

  app.innerHTML = `
    <div class="state active">
      ${previewHtml}
      <p class="error-msg mb-8">Could not analyze this page automatically.</p>
      <p style="color:#6b7280;font-size:13px;margin-bottom:12px;">Fill in details below.</p>
      ${buildReviewForm()}
      <button id="btn-choose-action" class="btn-primary mt-16">Choose action</button>
    </div>
  `;

  attachReviewFormListeners();

  document.getElementById('btn-choose-action').addEventListener('click', () => {
    readReviewFormEdits();
    setState('action_choice');
  });
}

// ---- Review ----

/**
 * renderReview shows the editable review form with AI-prefilled data.
 *
 * @implements REQ-EXT-003, REQ-EXT-004, SCN-EXT-003-01
 */
function renderReview() {
  let previewHtml = selectedImageUrl
    ? `<img class="image-preview" src="${escapeAttr(selectedImageUrl)}" alt="Selected image">`
    : '<div style="height:60px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;margin-bottom:12px;">No image</div>';

  app.innerHTML = `
    <div class="state active">
      ${previewHtml}
      ${buildReviewForm()}
      <p class="attribution">Pinned from ${escapeHtml(extractedData.domain)}</p>
      <button id="btn-choose-action" class="btn-primary mt-16">Choose action</button>
    </div>
  `;

  attachReviewFormListeners();

  document.getElementById('btn-choose-action').addEventListener('click', () => {
    readReviewFormEdits();
    saveDraft('review');
    setState('action_choice');
  });
}

/**
 * buildReviewForm generates the HTML for the review form fields.
 */
function buildReviewForm() {
  const tagChipsHtml = EXPERIENCE_TAGS.map(tag => {
    const active = userEdits.tags.includes(tag.id) ? 'active' : '';
    return `<button class="tag-chip ${active}" data-tag-id="${tag.id}">${tag.emoji} ${escapeHtml(tag.name)}</button>`;
  }).join('');

  return `
    <label class="field-label">Place name</label>
    <input class="field-input" id="input-place-name" type="text" value="${escapeAttr(userEdits.placeName)}">

    <label class="field-label">Tags</label>
    <div class="tag-chips" id="tag-chips">${tagChipsHtml}</div>

    <label class="field-label">Summary</label>
    <textarea class="field-textarea" id="input-summary">${escapeHtml(userEdits.summary)}</textarea>
  `;
}

/**
 * attachReviewFormListeners sets up event listeners for tag chips.
 */
function attachReviewFormListeners() {
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const tagId = parseInt(chip.dataset.tagId);
      chip.classList.toggle('active');
      if (userEdits.tags.includes(tagId)) {
        userEdits.tags = userEdits.tags.filter(id => id !== tagId);
      } else {
        userEdits.tags.push(tagId);
      }
    });
  });
}

/**
 * readReviewFormEdits reads current values from the review form inputs.
 */
function readReviewFormEdits() {
  const nameInput = document.getElementById('input-place-name');
  const summaryInput = document.getElementById('input-summary');
  if (nameInput) userEdits.placeName = nameInput.value;
  if (summaryInput) userEdits.summary = summaryInput.value;
}

// ---- Action Choice ----

/**
 * renderActionChoice shows the two action buttons.
 *
 * @implements REQ-EXT-004, REQ-EXT-005, SCN-EXT-004-01, SCN-EXT-005-01
 */
function renderActionChoice() {
  app.innerHTML = `
    <div class="state active">
      <h3 class="mb-16 text-center">What would you like to do?</h3>
      <button id="btn-new-dream" class="btn-primary mb-8">Add as new dream</button>
      <button id="btn-add-existing" class="btn-secondary">Add to existing dream</button>
    </div>
  `;

  document.getElementById('btn-new-dream').addEventListener('click', () => {
    setState('new_dream');
  });

  document.getElementById('btn-add-existing').addEventListener('click', () => {
    setState('add_existing');
  });
}

// ---- New Dream ----

/**
 * saveAsNewDream creates a new dream pin and its resource.
 *
 * @implements REQ-EXT-004, SCN-EXT-004-01
 */
async function saveAsNewDream() {
  setState('saving');

  try {
    // Step 1: Create dream pin
    const pinRes = await fetch(`${API_BASE}/api/pins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        pinType: 'dream',
        placeName: userEdits.placeName,
        aiSummary: userEdits.summary,
        photoUrl: selectedImageUrl || null,
        photoSource: selectedImageUrl ? 'extension' : null,
        tags: userEdits.tags.map(id => ({ experienceTagId: id }))
      })
    });

    if (!pinRes.ok) {
      throw new Error(`Failed to create pin: ${pinRes.status}`);
    }

    const pinData = await pinRes.json();
    const newPinId = pinData.id || (pinData.pin && pinData.pin.id);

    // Step 2: Create resource
    await fetch(`${API_BASE}/api/pins/${newPinId}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        sourceUrl: extractedData.pageUrl,
        domainName: extractedData.domain,
        photoUrl: null,
        excerpt: (userEdits.summary || '').slice(0, 280)
      })
    });

    // Clear draft
    await chrome.storage.session.remove('draft');

    setState('success');
  } catch (err) {
    renderSavingError('new');
  }
}

// ---- Add to Existing ----

/**
 * renderAddExisting shows the searchable list of existing dream pins.
 *
 * @implements REQ-EXT-005, SCN-EXT-005-01
 */
async function renderAddExisting() {
  app.innerHTML = `
    <div class="state active text-center">
      <div class="spinner"></div>
      <p>Loading your dreams...</p>
    </div>
  `;

  try {
    // Fetch dream pins if not cached
    if (!dreamPinsCache) {
      // No userId param needed: backend defaults to req.user.id from JWT
      const res = await fetch(`${API_BASE}/api/pins?type=dream`, {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (!res.ok) throw new Error(`Failed to load dreams: ${res.status}`);
      const data = await res.json();
      dreamPinsCache = data.pins || data;
      // Cache in session storage
      await chrome.storage.session.set({ dreamPins: dreamPinsCache });
    }

    renderDreamList(dreamPinsCache);
  } catch (err) {
    app.innerHTML = `
      <div class="state active text-center">
        <p class="error-msg">Could not load your dreams.</p>
        <button id="btn-retry-dreams" class="btn-primary mt-16">Retry</button>
        <button id="btn-back-action" class="btn-secondary mt-8">Back</button>
      </div>
    `;
    document.getElementById('btn-retry-dreams').addEventListener('click', () => {
      dreamPinsCache = null;
      setState('add_existing');
    });
    document.getElementById('btn-back-action').addEventListener('click', () => {
      setState('action_choice');
    });
  }
}

/**
 * renderDreamList renders the filterable list of dream pins.
 */
function renderDreamList(pins) {
  selectedExistingPinId = null;

  const listHtml = buildDreamListHtml(pins);

  app.innerHTML = `
    <div class="state active">
      <h3 class="mb-8">Add to existing dream</h3>
      <input class="search-input" id="dream-search" type="text" placeholder="Search your dreams...">
      <div class="dream-list" id="dream-list">${listHtml}</div>
      <button id="btn-save-existing" class="btn-primary mt-8" disabled>Add to selected dream</button>
      <button id="btn-back-action" class="btn-secondary mt-8">Back</button>
    </div>
  `;

  // Search filter
  document.getElementById('dream-search').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = pins.filter(p =>
      (p.placeName || p.place_name || '').toLowerCase().includes(query)
    );
    document.getElementById('dream-list').innerHTML = buildDreamListHtml(filtered);
    attachDreamItemListeners();
  });

  attachDreamItemListeners();

  document.getElementById('btn-save-existing').addEventListener('click', () => {
    if (selectedExistingPinId) {
      saveToExistingDream(selectedExistingPinId);
    }
  });

  document.getElementById('btn-back-action').addEventListener('click', () => {
    setState('action_choice');
  });
}

/**
 * buildDreamListHtml generates the HTML for dream list items.
 */
function buildDreamListHtml(pins) {
  if (pins.length === 0) {
    return '<p style="color:#9ca3af;text-align:center;padding:16px;">No dreams found</p>';
  }

  return pins.map(pin => {
    const name = pin.placeName || pin.place_name || 'Untitled';
    const tags = pin.tags || [];
    const firstTag = tags[0];
    const tagEmoji = firstTag
      ? (EXPERIENCE_TAGS.find(t => t.id === firstTag.experienceTagId || t.id === firstTag.experience_tag_id || t.name === firstTag.name) || {}).emoji || ''
      : '';
    const thumbUrl = pin.photoUrl || pin.photo_url || '';
    const pinId = pin.id;
    const thumbHtml = thumbUrl
      ? `<img class="dream-thumb" src="${escapeAttr(thumbUrl)}" alt="">`
      : '';

    return `
      <div class="dream-item" data-pin-id="${pinId}">
        <span class="dream-emoji">${tagEmoji}</span>
        <span class="dream-name">${escapeHtml(name)}</span>
        ${thumbHtml}
      </div>
    `;
  }).join('');
}

/**
 * attachDreamItemListeners sets up click handlers for dream list items.
 */
function attachDreamItemListeners() {
  document.querySelectorAll('.dream-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.dream-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedExistingPinId = parseInt(item.dataset.pinId);
      const btn = document.getElementById('btn-save-existing');
      if (btn) btn.disabled = false;
    });
  });
}

/**
 * saveToExistingDream adds a resource to an existing dream pin.
 *
 * @implements REQ-EXT-005, SCN-EXT-005-01
 */
async function saveToExistingDream(pinId) {
  setState('saving');

  try {
    const res = await fetch(`${API_BASE}/api/pins/${pinId}/resources`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        sourceUrl: extractedData.pageUrl,
        domainName: extractedData.domain,
        photoUrl: selectedImageUrl || null,
        excerpt: (userEdits.summary || '').slice(0, 280)
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to add resource: ${res.status}`);
    }

    // Clear draft
    await chrome.storage.session.remove('draft');

    setState('success');
  } catch (err) {
    renderSavingError('existing');
  }
}

// ---- Saving / Success ----

/**
 * renderSavingSpinner shows the saving spinner.
 */
function renderSavingSpinner() {
  app.innerHTML = `
    <div class="state active text-center">
      <div class="spinner"></div>
      <p>Saving...</p>
    </div>
  `;
}

/**
 * renderSavingError shows save failure with retry option.
 */
function renderSavingError(mode) {
  app.innerHTML = `
    <div class="state active text-center">
      <p class="error-msg">Could not save. Check your connection.</p>
      <button id="btn-retry-save" class="btn-primary mt-16">Retry</button>
      <button id="btn-cancel-save" class="btn-secondary mt-8">Cancel</button>
    </div>
  `;

  document.getElementById('btn-retry-save').addEventListener('click', () => {
    if (mode === 'new') {
      saveAsNewDream();
    } else {
      saveToExistingDream(selectedExistingPinId);
    }
  });

  document.getElementById('btn-cancel-save').addEventListener('click', () => {
    setState('action_choice');
  });
}

/**
 * renderSuccess shows the success screen with auto-close.
 *
 * @implements REQ-EXT-004, REQ-EXT-005, REQ-EXT-006
 */
function renderSuccess() {
  let previewHtml = '';
  if (selectedImageUrl || userEdits.placeName) {
    const imgHtml = selectedImageUrl
      ? `<img src="${escapeAttr(selectedImageUrl)}" alt="">`
      : '';
    const tagsText = userEdits.tags.map(id => {
      const tag = EXPERIENCE_TAGS.find(t => t.id === id);
      return tag ? `${tag.emoji} ${tag.name}` : '';
    }).filter(Boolean).join(', ');

    previewHtml = `
      <div class="pin-preview">
        ${imgHtml}
        <div class="pin-name">${escapeHtml(userEdits.placeName)}</div>
        <div class="pin-tags">${escapeHtml(tagsText)}</div>
      </div>
    `;
  }

  app.innerHTML = `
    <div class="state active text-center">
      <div class="success-check">\u2713</div>
      <h3>Pinned to your dream board!</h3>
      ${previewHtml}
      <a href="${WEB_APP_URL}/" target="_blank" class="link mt-16" style="display:inline-block">View on board</a>
    </div>
  `;

  // Auto-close after 3 seconds
  autoCloseTimer = setTimeout(() => {
    window.close();
  }, 3000);
}

// ---- Draft Persistence ----

/**
 * saveDraft persists the current state to chrome.storage.session.
 *
 * @implements REQ-EXT-006
 */
function saveDraft(state) {
  chrome.storage.session.set({
    draft: {
      extractedData,
      selectedImageUrl,
      aiProposal,
      userEdits,
      state
    }
  });
}

// ---- Utility ----

/**
 * escapeHtml escapes HTML special characters for safe innerHTML insertion.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * escapeAttr escapes a string for use in an HTML attribute value.
 */
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- Start ----
init();
