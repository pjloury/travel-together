// BoardView page - main app page, user's profile/board.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-001, REQ-NAV-002, REQ-NAV-003, REQ-NAV-004, REQ-NAV-007,
//             REQ-SOCIAL-001, REQ-SOCIAL-002, REQ-SOCIAL-003,
//             REQ-DISCOVERY-001, REQ-DISCOVERY-002,
//             REQ-DREAM-005

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import useLoadingPhrases from '../hooks/useLoadingPhrases';
import TabSwitcher from '../components/TabSwitcher';
import PinBoard from '../components/PinBoard';
import PinMap from '../components/PinMap';
import VoiceCapture from '../components/VoiceCapture';
import DreamPinCreator from '../components/DreamPinCreator';
import DreamConvertModal from '../components/DreamConvertModal';
import MemoryDetail from '../components/MemoryDetail';
import DreamDetail from '../components/DreamDetail';
import TravelTogetherSection from '../components/TravelTogetherSection';
import OverlapSection from '../components/OverlapSection';
import MultiFriendCompare from '../components/MultiFriendCompare';
import CountriesModal from '../components/CountriesModal';
import WishlistModal from '../components/WishlistModal';
import WelcomeModal from '../components/WelcomeModal';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { countryFlag, countryFlagFromPlace } from '../utils/countryFlag';

// Module-level cache — survives React route navigations so the board loads instantly on revisit.
// Keyed by "own" or userId. Refreshes in background on every mount.
const boardCache = new Map();

const BOARD_LOADING_PHRASES = [
  'Unpacking your suitcase of memories...',
  'Dusting off the travel journals...',
  'Pinning postcards to the board...',
  'Sorting photos by golden hour quality...',
  'Recalling that unforgettable meal...',
  'Tracing routes on the map...',
  'Counting passport stamps...',
  'Rewinding to that perfect sunset...',
  'Gathering your travel stories...',
  'Polishing the globe...',
];

/**
 * BoardView is the main app page. This IS the user's profile.
 *
 * @implements REQ-NAV-001 (PAST/FUTURE tab switcher; memory board IS the profile)
 * @implements REQ-NAV-002 (Top 8 above fold; All view below)
 * @implements REQ-NAV-003 (instant SPA switch, no reload)
 * @implements REQ-NAV-004 (tab memory stored server-side; deep links override)
 * @implements REQ-NAV-007 (friends management accessible but not primary tab)
 * @implements REQ-SOCIAL-001 (social annotations on own pins)
 * @implements REQ-SOCIAL-002 (Travel Together section on own FUTURE tab)
 * @implements REQ-SOCIAL-003 (inspire button on friend dream pins)
 * @implements REQ-DISCOVERY-001 ("Sarah has been to Tokyo" on dream pins)
 * @implements REQ-DISCOVERY-002 ("3 friends dream of visiting Patagonia" on memory pins)
 * @implements REQ-DREAM-005 ("I went!" dream-to-memory conversion)
 *
 * Own board (/): full interactions - add pins, edit Top 8, see all social annotations.
 * Other user's board (/user/:userId): view-only; non-friends see Top 8 only; friends see all.
 *
 * @param {Object} props
 * @param {'memory'|'dream'} [props.deepLinkTab] - Deep link tab override (from /past or /future routes)
 */

/**
 * MapNavStrip — floating prev/next navigator overlaid on the map.
 * Shows the current pin name and position in list; arrow buttons step through.
 */
function MapNavStrip({ pins, focusIndex, onNav, tab }) {
  const touchStartX = useRef(null);
  const hasFocus = focusIndex !== null;
  const count = pins.length;
  const current = hasFocus ? pins[focusIndex] : null;
  const label = current?.placeName || (tab === 'dream' ? 'Browse dreams' : 'Browse memories');
  const displayIndex = hasFocus ? focusIndex : -1;

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    const next = hasFocus ? focusIndex + (dx < 0 ? 1 : -1) : 0;
    onNav(Math.max(0, Math.min(next, count - 1)));
  }

  return (
    <div
      className="map-nav-strip"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        className="map-nav-arrow"
        onClick={() => onNav(hasFocus ? Math.max(0, focusIndex - 1) : count - 1)}
        disabled={hasFocus && focusIndex === 0}
        aria-label="Previous"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <div className="map-nav-center" onClick={() => !hasFocus && onNav(0)}>
        {hasFocus ? (
          <>
            <span className="map-nav-name">{label}</span>
            <span className="map-nav-count">{displayIndex + 1} / {count}</span>
          </>
        ) : (
          <span className="map-nav-hint">
            {tab === 'dream' ? '✦' : '📍'} Tap to browse {count} {tab === 'dream' ? 'dreams' : 'memories'}
          </span>
        )}
      </div>

      <button
        className="map-nav-arrow"
        onClick={() => onNav(hasFocus ? Math.min(count - 1, focusIndex + 1) : 0)}
        disabled={hasFocus && focusIndex === count - 1}
        aria-label="Next"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

export default function BoardView({ deepLinkTab }) {
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const isOwnBoard = !paramUserId || paramUserId === user?.id;
  const targetUserId = paramUserId || user?.id;

  const urlTab = searchParams.get('tab');
  const [activeTab, setActiveTabRaw] = useState(urlTab === 'dream' ? 'dream' : (deepLinkTab || 'memory'));

  // Sync tab to URL
  function setActiveTab(tab) {
    setActiveTabRaw(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'dream') next.set('tab', 'dream');
      else next.delete('tab');
      return next;
    }, { replace: true });
  }
  const [memoryPins, setMemoryPins] = useState([]);
  const [dreamPins, setDreamPins] = useState([]);
  const [memoryTop, setMemoryTop] = useState([]);
  const [dreamTop, setDreamTop] = useState([]);
  const [annotations, setAnnotations] = useState({});
  const [boardUser, setBoardUser] = useState(null);
  const [_memoryCount, setMemoryCount] = useState(0);
  const [_dreamCount, setDreamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const boardPhrases = useMemo(() => BOARD_LOADING_PHRASES, []);
  const loadingPhrase = useLoadingPhrases(boardPhrases, loading);

  // Friendship check for non-own boards
  // @implements REQ-SOCIAL-003 (need isFriend to show inspire button)
  const [isFriend, setIsFriend] = useState(false);

  // Public profile data for non-friends viewing another user's board
  const [publicProfile, setPublicProfile] = useState(null); // eslint-disable-line no-unused-vars
  const [friendRequestSent, setFriendRequestSent] = useState(false); // eslint-disable-line no-unused-vars

  // Toast state
  const [toast, setToast] = useState(null);

  // Modal states
  const [voiceCaptureOpen, setVoiceCaptureOpen] = useState(false);
  const [dreamCreatorOpen, setDreamCreatorOpen] = useState(false);

  // Dream convert modal state
  // @implements REQ-DREAM-005
  const [dreamConvertOpen, setDreamConvertOpen] = useState(false);
  const [dreamConvertPin, setDreamConvertPin] = useState(null);
  const [undoConvert, setUndoConvert] = useState(null); // TT16: { memoryId, dreamId, dreamArchived }
  const [undoConvertTimer, setUndoConvertTimer] = useState(null);

  // Memory/dream detail panels
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [selectedDream, setSelectedDream] = useState(null);

  // Welcome modal for first-time users — only show after data loads (no flicker)
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCountriesModal, setShowCountriesModal] = useState(false);
  const [showWishlistModal, setShowWishlistModal] = useState(false);
  const [wishlist, setWishlist] = useState([]); // [{ country, flag, countryCode }]

  // Two-plane keyboard navigation. Default state is the "tab plane":
  // arrow Left/Right swaps PAST↔FUTURE. Pressing ArrowDown promotes
  // the user into the "grid plane" — keyboardFocusIndex becomes 0
  // and the focused card renders a slight lifted highlight. Within
  // the grid plane, arrow keys move between cards; ArrowUp from the
  // top row pops back out to the tab plane; Enter opens the detail
  // panel for the focused card. null === tab plane.
  const [keyboardFocusIndex, setKeyboardFocusIndex] = useState(null);

  // Grid / map toggle. Hotkeys: G = grid, M = map. Bound at the page
  // level below; skipped when an input/textarea is focused so they
  // don't fire while typing in the search box, modal forms, etc.
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  // Memory sort — 'rank' (manual: top 8 first then most recently added),
  // 'visit-desc' (newest visit first), 'visit-asc' (oldest visit first).
  // Persisted in localStorage so the user's preference sticks per session.
  const [memorySort, setMemorySort] = useState(() => {
    if (typeof window === 'undefined') return 'rank';
    const v = window.localStorage.getItem('tt_memory_sort');
    return v === 'visit-desc' || v === 'visit-asc' ? v : 'rank';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tt_memory_sort', memorySort);
    }
  }, [memorySort]);
  // Social mode — when ON, friend overlap avatars + commonality badges
  // render on each pin card (own board only). When OFF, the card is just
  // your own pin with no social layer. Persisted in localStorage so the
  // user's preference sticks across visits.
  const [socialMode, setSocialMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const v = window.localStorage.getItem('tt_social_mode');
    return v === null ? true : v === '1';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('tt_social_mode', socialMode ? '1' : '0');
    }
  }, [socialMode]);

  // Hotkey: M toggles between grid and map. Lower- and upper-case both
  // fire so caps-lock doesn't trip users up. Skipped when an editable
  // surface owns focus so we don't intercept normal typing.
  useEffect(() => {
    function isEditable(el) {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function handleKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(document.activeElement)) return;
      if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setViewMode(v => v === 'map' ? 'grid' : 'map');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Map pin navigation — index into activePins
  const [mapFocusIndex, setMapFocusIndex] = useState(null);

  // Voice capture pre-seed data (for dream-to-memory voice path)
  const [_voicePreSeed, setVoicePreSeed] = useState(null);

  // Pending dream conversion follow-up (voice path)
  // @implements REQ-DREAM-005, SCN-DREAM-005-02
  const [pendingDreamConversion, setPendingDreamConversion] = useState(null);

  // Show toast helper
  function showToast(message, duration = 3000) {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  }

  // Load initial tab preference (own board only, no deep link)
  useEffect(() => {
    if (isOwnBoard && !deepLinkTab) {
      api.get('/users/preferences').then(res => {
        if (res.data?.lastTab || res.lastTab) {
          setActiveTab(res.data?.lastTab || res.lastTab);
        }
      }).catch(() => {
        // Default to 'memory' if preferences fail
      });
    }
  }, [isOwnBoard, deepLinkTab]);

  // Check friendship when viewing another user's board
  useEffect(() => {
    if (isOwnBoard || !targetUserId) {
      setIsFriend(false);
      return;
    }

    async function checkFriendship() {
      try {
        const res = await api.get('/friends');
        const friends = res.data || res || [];
        const friendIds = friends.map(f => f.friendId || f.id);
        setIsFriend(friendIds.includes(targetUserId));
      } catch {
        setIsFriend(false);
      }
    }

    checkFriendship();
  }, [isOwnBoard, targetUserId]);

  // Fetch public profile when viewing a non-friend's board
  useEffect(() => {
    if (isOwnBoard || !targetUserId) {
      setPublicProfile(null);
      return;
    }

    async function fetchPublicProfile() {
      try {
        const res = await api.get(`/users/${targetUserId}/public-profile`);
        setPublicProfile(res.data || res);
      } catch {
        setPublicProfile(null);
      }
    }

    fetchPublicProfile();
  }, [isOwnBoard, targetUserId]);

  // ── Board data cache ──
  // Persists across route navigations so switching tabs is instant.
  // Key: "own" or userId. Data refreshes in background on every mount.
  const cacheKey = isOwnBoard ? 'own' : targetUserId;

  const fetchData = useCallback(async () => {
    // Show cached data instantly (no loading spinner on revisit)
    const cached = boardCache.get(cacheKey);
    if (cached) {
      setMemoryPins(cached.memoryPins);
      setDreamPins(cached.dreamPins);
      setMemoryCount(cached.memoryCount);
      setDreamCount(cached.dreamCount);
      setMemoryTop(cached.memoryTop);
      setDreamTop(cached.dreamTop);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // Phase 1: Load active tab (single API call — pins + top combined)
    const userIdParam = isOwnBoard ? '' : `&userId=${targetUserId}`;
    const currentTab = activeTab;

    try {
      const activeRes = await api.get(`/pins/board?tab=${currentTab}${userIdParam}`);
      const activePins = activeRes.pins || [];
      const activeTop = (activeRes.topPins || []).map(tp => ({ sortOrder: tp.sortOrder, pinId: tp.pinId }));

      if (currentTab === 'memory') {
        setMemoryPins(activePins);
        setMemoryCount(activeRes.pinCount || activePins.length);
        setMemoryTop(activeTop);
      } else {
        setDreamPins(activePins);
        setDreamCount(activeRes.pinCount || activePins.length);
        setDreamTop(activeTop);
      }
      setLoading(false);

      // Phase 2: Lazy-load the other tab in background (single call)
      const otherTab = currentTab === 'memory' ? 'dream' : 'memory';
      const otherRes = await api.get(`/pins/board?tab=${otherTab}${userIdParam}`);
      const otherPins = otherRes.pins || [];
      const otherTop = (otherRes.topPins || []).map(tp => ({ sortOrder: tp.sortOrder, pinId: tp.pinId }));

      if (otherTab === 'memory') {
        setMemoryPins(otherPins);
        setMemoryCount(otherRes.pinCount || otherPins.length);
        setMemoryTop(otherTop);
      } else {
        setDreamPins(otherPins);
        setDreamCount(otherRes.pinCount || otherPins.length);
        setDreamTop(otherTop);
      }

      // Update full cache
      const mPins = currentTab === 'memory' ? activePins : otherPins;
      const dPins = currentTab === 'dream' ? activePins : otherPins;
      boardCache.set(cacheKey, {
        memoryPins: mPins, dreamPins: dPins,
        memoryCount: currentTab === 'memory' ? (activeRes.pinCount || activePins.length) : (otherRes.pinCount || otherPins.length),
        dreamCount: currentTab === 'dream' ? (activeRes.pinCount || activePins.length) : (otherRes.pinCount || otherPins.length),
        memoryTop: currentTab === 'memory' ? activeTop : otherTop,
        dreamTop: currentTab === 'dream' ? activeTop : otherTop,
      });

      if (!isOwnBoard) setBoardUser(null);
    } catch {
      // Silently handle - cached or empty state will show
    } finally {
      setLoading(false);
    }
  }, [isOwnBoard, targetUserId, cacheKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Wishlist for the FUTURE-tab "wishlist bar". Own board only — friends'
  // wishlists aren't surfaced on each other's boards. Loaded once per
  // mount and refreshed when the modal triggers a write.
  const fetchWishlist = useCallback(async () => {
    if (!isOwnBoard) { setWishlist([]); return; }
    try {
      const res = await api.get('/wishlist');
      const items = res.data || res;
      const mapped = (Array.isArray(items) ? items : []).map(it => ({
        country: it.countryName,
        countryCode: it.countryCode,
        flag: countryFlag(it.countryName) || '🌐',
      }));
      setWishlist(mapped);
    } catch {
      setWishlist([]);
    }
  }, [isOwnBoard]);
  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  // Show welcome modal after first load completes (prevents flicker with loading spinner)
  useEffect(() => {
    if (!loading && isOwnBoard && !localStorage.getItem('tt_welcome_seen')) {
      setShowWelcome(true);
    }
  }, [loading, isOwnBoard]);

  // Sync open detail panel when pin list refreshes (so panel never shows stale data)
  useEffect(() => {
    if (selectedMemory) {
      const fresh = memoryPins.find(p => p.id === selectedMemory.id);
      if (fresh && fresh !== selectedMemory) setSelectedMemory(fresh);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryPins]);

  useEffect(() => {
    if (selectedDream) {
      const fresh = dreamPins.find(p => p.id === selectedDream.id);
      if (fresh && fresh !== selectedDream) setSelectedDream(fresh);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dreamPins]);

  // Targeted pin update — surgically patches a single pin in state without
  // triggering a full fetchData/loading cycle. Used for optimistic UI updates.
  const handlePinChanged = useCallback((pinId, updates) => {
    // If pin was archived, remove it from the list instead of updating
    if (updates.archived) {
      setMemoryPins(prev => prev.filter(p => p.id !== pinId));
      setDreamPins(prev => prev.filter(p => p.id !== pinId));
      setSelectedMemory(prev => prev?.id === pinId ? null : prev);
      setSelectedDream(prev => prev?.id === pinId ? null : prev);
    } else {
      const apply = p => p.id === pinId ? { ...p, ...updates } : p;
      setMemoryPins(prev => prev.map(apply));
      setDreamPins(prev => prev.map(apply));
      setSelectedMemory(prev => prev?.id === pinId ? { ...prev, ...updates } : prev);
      setSelectedDream(prev => prev?.id === pinId ? { ...prev, ...updates } : prev);
    }
    // Update sub-pins on map when locations change
    if (updates.locations && viewMode === 'map') {
      setFocusedPinLocations(updates.locations);
    }
    // Invalidate cache so next mount gets fresh data
    boardCache.delete(cacheKey);
  }, [cacheKey, viewMode]);

  // Fetch annotations for active tab.
  //
  // Two endpoints, two response shapes:
  //   /social/annotations         (own board)
  //     → { data: { annotations: { [pinId]: { friends: [...], count } } } }
  //   /social/annotations/:userId (friend board)
  //     → { data: { [pinId]: { viewerDreams, viewerHasBeen, ... } } }
  //
  // PinCard renders the badge from `friendsDreamingCount` (memory tab)
  // or `friendsBeenCount` (dream tab), and the popover from
  // `friendsDreaming` / `friendsBeen` arrays. The own-board endpoint
  // returns a generic `{ friends, count }` so we translate per-tab
  // here. The friend-board endpoint isn't a friend-overlap concept so
  // it passes through as-is for whatever consumer needs it.
  useEffect(() => {
    if (!targetUserId) return;

    async function fetchAnnotations() {
      try {
        const tabParam = activeTab;
        if (isOwnBoard) {
          const res = await api.get(`/social/annotations?tab=${tabParam}`);
          // Server wraps: data.annotations.{pinId} → { friends, count }
          const raw = res.data?.annotations || res.annotations || {};
          const isMemoryTab = tabParam === 'memory';
          const translated = {};
          for (const [pinId, val] of Object.entries(raw)) {
            if (!val || !val.count) continue;
            if (isMemoryTab) {
              translated[pinId] = {
                friendsDreaming: val.friends || [],
                friendsDreamingCount: val.count,
              };
            } else {
              translated[pinId] = {
                friendsBeen: val.friends || [],
                friendsBeenCount: val.count,
              };
            }
          }
          setAnnotations(translated);
        } else {
          const res = await api.get(`/social/annotations/${targetUserId}?tab=${tabParam}`);
          setAnnotations(res.data || {});
        }
      } catch {
        setAnnotations({});
      }
    }

    fetchAnnotations();
  }, [activeTab, targetUserId, isOwnBoard]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    setMapFocusIndex(null);
    setSelectedMemory(null);
    setSelectedDream(null);
  }

  function handleAddPin() {
    if (activeTab === 'memory') {
      setVoicePreSeed(null);
      setVoiceCaptureOpen(true);
    } else {
      setDreamCreatorOpen(true);
    }
  }

  function handlePinSaved(newPin) {
    // Optimistic update in map view: immediately add the pin to state so the
    // map marker appears without waiting for fetchData() to complete.
    if (viewMode === 'map' && newPin && newPin.id) {
      if (newPin.pinType === 'dream') {
        setDreamPins(prev => [newPin, ...prev]);
      } else {
        setMemoryPins(prev => [newPin, ...prev]);
      }
    }
    boardCache.delete(cacheKey);
    fetchData();
    // Re-fetch after a delay to catch async location normalization
    setTimeout(() => fetchData(), 4000);
  }

  /**
   * Save a new top-pin order after drag-and-drop reorder.
   * Called by PinBoard with the new ordered array of pin IDs.
   */
  async function handleReorder(newPinIds) {
    // Optimistic update: reorder parent state in-place so nothing re-mounts.
    // PinBoard's localTopIds is already showing the new order visually.
    const currentTop = activeTab === 'memory' ? memoryTop : dreamTop;
    const setTop = activeTab === 'memory' ? setMemoryTop : setDreamTop;
    const pinMap = {};
    currentTop.forEach(tp => { pinMap[tp.pin?.id || tp.pinId] = tp; });
    const reordered = newPinIds
      .map((id, idx) => ({ ...(pinMap[id] || { pinId: id }), sortOrder: idx }))
      .filter(Boolean);
    setTop(reordered);

    try {
      // Only send the first 8 to the server (Top 8 limit)
      await api.put('/pins/top', { tab: activeTab, pinIds: newPinIds.slice(0, 8) });
      // Success — local state already correct, no fetchData() needed.
    } catch {
      // Revert to server truth on failure.
      fetchData();
    }
  }

  const [focusedPinLocations, setFocusedPinLocations] = useState([]);

  function handlePinPress(pin) {
    setFocusedPinLocations([]); // reset
    if (pin.pinType === 'memory') {
      setSelectedMemory(pin);
      if (viewMode === 'map') {
        const idx = memoryPins.findIndex(p => p.id === pin.id);
        if (idx !== -1) setMapFocusIndex(idx);
      }
    } else if (pin.pinType === 'dream') {
      setSelectedDream(pin);
      if (viewMode === 'map') {
        const idx = dreamPins.findIndex(p => p.id === pin.id);
        if (idx !== -1) setMapFocusIndex(idx);
      }
    }
    // Fetch locations for sub-pin display on map
    if (viewMode === 'map') {
      api.get(`/pins/${pin.id}`).then(res => {
        const full = res.data || res;
        setFocusedPinLocations(full.locations || []);
      }).catch(() => {});
    }
  }

  // Keyboard arrow nav. Three modes:
  //   1. Detail panel open → ←/→ cycles pins (existing behavior).
  //   2. Detail closed, tab plane (keyboardFocusIndex === null)
  //         ←/→ swaps PAST/FUTURE
  //         ↓     promotes focus into the grid (index 0)
  //   3. Detail closed, grid plane (keyboardFocusIndex >= 0)
  //         ←/→/↑/↓ move between cards (↑ at row 0 returns to tab plane)
  //         Enter   opens the detail panel for the focused card
  //         Esc     exits grid plane
  useEffect(() => {
    function isEditable(el) {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    }
    // Read the live grid track count from CSS so navigation respects
    // whatever auto-fill resolved to at the current viewport width.
    function getGridColumnCount() {
      const grid = document.querySelector('.pin-grid');
      if (!grid) return 1;
      const cols = window.getComputedStyle(grid).gridTemplateColumns;
      if (!cols) return 1;
      return Math.max(1, cols.split(' ').filter(Boolean).length);
    }

    function handleKey(e) {
      if (isEditable(document.activeElement)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const pins = activeTab === 'memory' ? memoryPins : dreamPins;
      const detailOpen = !!(selectedMemory || selectedDream);

      // Mode 1: detail panel open → existing prev/next pin cycling.
      if (detailOpen) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (!pins.length) return;
        e.preventDefault();
        const openPin = activeTab === 'memory' ? selectedMemory : selectedDream;
        const current = openPin ? pins.findIndex(p => p.id === openPin.id) : -1;
        const next = e.key === 'ArrowRight'
          ? Math.min(pins.length - 1, current + 1)
          : Math.max(0, current <= 0 ? 0 : current - 1);
        handleMapNav(next);
        return;
      }

      // Modes 2 + 3 only really make sense in the grid view; the map view
      // has its own focus model via mapFocusIndex.
      if (viewMode !== 'grid') return;

      // Mode 2: tab plane.
      if (keyboardFocusIndex === null) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const nextTab = activeTab === 'memory' ? 'dream' : 'memory';
          setActiveTab(nextTab);
          return;
        }
        if (e.key === 'ArrowDown' && pins.length > 0) {
          e.preventDefault();
          setKeyboardFocusIndex(0);
        }
        return;
      }

      // Mode 3: grid plane.
      const idx = keyboardFocusIndex;
      const cols = getGridColumnCount();
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setKeyboardFocusIndex(Math.max(0, idx - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setKeyboardFocusIndex(Math.min(pins.length - 1, idx + 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setKeyboardFocusIndex(Math.min(pins.length - 1, idx + cols));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = idx - cols;
        if (next < 0) setKeyboardFocusIndex(null);
        else setKeyboardFocusIndex(next);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const pin = pins[idx];
        if (pin) handlePinPress(pin);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setKeyboardFocusIndex(null);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, memoryPins, dreamPins, selectedMemory, selectedDream,
       keyboardFocusIndex, viewMode]);

  // Drop the keyboard focus when the underlying inputs change shape so
  // the lifted highlight doesn't cling to a now-stale index.
  useEffect(() => { setKeyboardFocusIndex(null); }, [activeTab, viewMode]);
  useEffect(() => {
    if (selectedMemory || selectedDream) setKeyboardFocusIndex(null);
  }, [selectedMemory, selectedDream]);

  // (Country flag click now opens the CountriesModal — see country bar.
  //  The previous "switch to map and zoom to that country's pin" flow was
  //  replaced because users requested tapping anywhere on the bar to open
  //  the map+list modal.)

  // Navigate to a specific index in the active pins list (map mode)
  function handleMapNav(newIndex) {
    const pins = activePins;
    if (!pins.length) return;
    const clamped = Math.max(0, Math.min(newIndex, pins.length - 1));
    setMapFocusIndex(clamped);
    const pin = pins[clamped];
    if (pin.pinType === 'memory') {
      setSelectedMemory(pin);
      setSelectedDream(null);
    } else {
      setSelectedDream(pin);
      setSelectedMemory(null);
    }
  }

  /**
   * Handle "I'm interested too!" action on a friend's dream pin.
   * @implements REQ-SOCIAL-003, SCN-SOCIAL-003-01
   */
  async function handleInspire(pinId) {
    try {
      await api.post(`/social/inspire/${pinId}`);
      showToast('Dream saved to your board!');
    } catch (err) {
      // Handle 409 gracefully (already inspired)
      if (err.message && (err.message.includes('already') || err.message.includes('duplicate'))) {
        showToast('You already have this dream');
      } else {
        showToast(err.message || 'Could not save dream. Please try again.');
      }
    }
  }

  /**
   * Handle "Add friend" from public profile card.
   * Sends a friend request to the user whose board is being viewed.
   */
  async function handleAddFriend() {
    try {
      await api.post('/friends/request', { userId: targetUserId });
      setFriendRequestSent(true);
      showToast('Friend request sent!');
    } catch (err) {
      if (err.message && err.message.includes('already')) {
        setFriendRequestSent(true);
        showToast('Friend request already sent');
      } else {
        showToast(err.message || 'Could not send friend request');
      }
    }
  }

  /**
   * Handle voice capture pre-seed from dream conversion.
   * Opens VoiceCapture with pre-filled data.
   */
  function handleOpenVoiceCapturePreSeeded(preSeedData) {
    setVoicePreSeed(preSeedData);
    setDreamConvertOpen(false);
    setVoiceCaptureOpen(true);
  }

  /**
   * Handle voice path chosen from DreamConvertModal.
   * Stores pending dream conversion info so the follow-up prompt
   * shows after voice capture saves.
   * @implements REQ-DREAM-005, SCN-DREAM-005-01
   */
  function handleVoicePath(dreamPin) {
    setPendingDreamConversion({
      dreamPinId: dreamPin.id,
      dreamPlaceName: dreamPin.placeName,
    });
    setVoicePreSeed({
      placeName: dreamPin.placeName,
      tags: dreamPin.tags ? dreamPin.tags.map(t => t.name) : [],
    });
    setDreamConvertOpen(false);
    setDreamConvertPin(null);
    setVoiceCaptureOpen(true);
  }

  /**
   * Handle VoiceCapture onSaved — if a dream conversion is pending,
   * show the follow-up prompt instead of just refreshing.
   */
  function handleVoiceSaved(newPin) {
    if (pendingDreamConversion) {
      fetchData();
      // Follow-up prompt will be shown via pendingDreamConversion state
      showToast('Memory created!');
    } else {
      handlePinSaved(newPin);
    }
  }

  /**
   * Handle "Keep as dream" in follow-up prompt.
   * @implements SCN-DREAM-005-02
   */
  function handleFollowUpKeep() {
    setPendingDreamConversion(null);
  }

  /**
   * Handle "Mark as visited" in follow-up prompt.
   * Archives the dream pin via the convert endpoint.
   * @implements SCN-DREAM-005-02
   */
  async function handleFollowUpArchive() {
    if (!pendingDreamConversion) return;
    try {
      await api.post(`/pins/${pendingDreamConversion.dreamPinId}/convert`, { keepDream: false });
    } catch {
      // Silently handle
    }
    setPendingDreamConversion(null);
    fetchData();
  }

  // TT16: undo after dream → memory conversion
  function handleDreamConvertSaved(convertInfo) {
    fetchData();
    if (convertInfo?.memoryId) {
      setUndoConvert(convertInfo);
      const timer = setTimeout(() => setUndoConvert(null), 8000);
      setUndoConvertTimer(prev => { if (prev) clearTimeout(prev); return timer; });
    } else {
      showToast('Memory created! 🎉');
    }
  }

  async function handleUndoConvert() {
    if (!undoConvert) return;
    if (undoConvertTimer) { clearTimeout(undoConvertTimer); setUndoConvertTimer(null); }
    try {
      if (undoConvert.memoryId) await api.delete(`/pins/${undoConvert.memoryId}`);
      if (undoConvert.dreamArchived && undoConvert.dreamId) {
        await api.put(`/pins/${undoConvert.dreamId}`, { archived: false });
      }
    } catch { /* silent */ }
    setUndoConvert(null);
    fetchData();
  }

  // Memory pins flagged country_only are hidden from the grid + map (they
  // exist purely to mark a country on the country bar / map). They still
  // contribute to countryFlagList below via the FULL memoryPins array.
  // Memoized so PinMap's [pins] effect doesn't re-fire on unrelated renders.
  const visibleMemoryPins = useMemo(() => (
    activeTab === 'memory'
      ? memoryPins.filter(p => !p.countryOnly)
      : memoryPins
  ), [activeTab, memoryPins]);

  // Apply the memory sort. Server returns "rank" order by default
  // (top 8 first, then created_at desc) — only re-sort client-side
  // when the user picks chronological. Tie-breaker keeps server order
  // by id so the result is stable.
  function applyMemorySort(pins, mode) {
    if (mode === 'rank' || activeTab !== 'memory') return pins;
    const dir = mode === 'visit-asc' ? 1 : -1;
    return [...pins].sort((a, b) => {
      // Pins without a visit_year fall back to created_at so they don't
      // all clump at one end of the list.
      const aKey = a.visitYear || (a.createdAt ? new Date(a.createdAt).getFullYear() : 0);
      const bKey = b.visitYear || (b.createdAt ? new Date(b.createdAt).getFullYear() : 0);
      if (aKey !== bKey) return (aKey - bKey) * dir;
      // Stable tie-break by created_at within the same year
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (aT - bT) * dir;
    });
  }
  // Memoize so the array reference stays stable across unrelated re-renders.
  // PinMap's marker-rebuild effect depends on `pins` reference; a fresh
  // array each render would re-run fitBounds and yank a focused pin's
  // zoom back to the all-pin world view.
  const activePins = useMemo(() => (
    activeTab === 'memory'
      ? applyMemorySort(visibleMemoryPins, memorySort)
      : dreamPins
  ), [activeTab, visibleMemoryPins, memorySort, dreamPins]);
  const activeTopPins = activeTab === 'memory' ? memoryTop : dreamTop;
  // Display name resolution. Use the relevant user only — never let
  // the friend's profile fall back to MY username (a previous fix
  // accidentally leaked the viewer's username when boardUser was
  // mid-fetch). Empty string while loading; the layout reserves
  // space until the data arrives.
  const displayName = isOwnBoard
    ? (user?.displayName || user?.username || '')
    : (boardUser?.displayName || boardUser?.username || '');

  // Compute rank of a pin within the Top 8 sorted list (1-based, null if not in Top 8)
  function getPinRank(pinId) {
    if (!pinId || !activeTopPins || !activeTopPins.length) return null;
    const sorted = [...activeTopPins].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex(tp => (tp.pin?.id || tp.pinId) === pinId);
    return idx === -1 ? null : idx + 1;
  }

  // Determine if the inspire button should show on pins.
  // (The I-went button moved into DreamDetail bottom scroll; no longer
  //  pin-card chrome.)
  const showInspire = !isOwnBoard && isFriend && activeTab === 'dream';

  // Compute unique countries across all memories.
  // Sources (in priority order):
  //   1. pin.countries[]  — explicit multi-country array (e.g. multi-stop trips)
  //   2. pin.normalizedCountry — single primary country
  //   3. pin.locations[].normalizedCountry — stop-level countries
  //   4. countryFlagFromPlace(loc.placeName) — parsed fallback
  const { countryCount, countryFlagList } = (() => {
    const seen = new Set();
    const flags = [];
    memoryPins.forEach(pin => {
      const add = (country) => {
        if (!country || seen.has(country)) return;
        const f = countryFlag(country);
        if (f) { seen.add(country); flags.push({ country, flag: f }); }
      };
      // Multi-country array first (covers multi-stop trips)
      (pin.countries || []).forEach(add);
      // Primary country fallback
      add(pin.normalizedCountry);
      // Stop-level countries
      (pin.locations || []).forEach(loc => {
        if (loc.normalizedCountry) {
          add(loc.normalizedCountry);
        } else if (loc.placeName) {
          const parsed = countryFlagFromPlace(loc.placeName);
          if (parsed) add(parsed.country);
        }
      });
    });
    return { countryCount: seen.size, countryFlagList: flags };
  })();

  if (loading) {
    return (
      <Layout>
        <div className="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
          <div className="loading-spinner-sm" />
          <p className="loading-phrase">{loadingPhrase}</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="board-view">
        {/* Public profile card — shown when viewing a non-friend's board */}
        {!isOwnBoard && !isFriend && publicProfile && (
          <div className="public-profile-card">
            <div className="public-profile-avatar">
              {publicProfile.avatarUrl
                ? <img src={publicProfile.avatarUrl} alt={publicProfile.displayName} />
                : <span className="public-profile-avatar-fallback">
                    {(publicProfile.displayName || '?').charAt(0).toUpperCase()}
                  </span>
              }
            </div>
            <h2 className="public-profile-name">{publicProfile.displayName}</h2>
            {publicProfile.username && (
              <span className="public-profile-username">@{publicProfile.username}</span>
            )}
            <div className="public-profile-stats">
              <div className="public-profile-stat">
                <span className="public-profile-stat-value">{publicProfile.countryCount}</span>
                <span className="public-profile-stat-label">{publicProfile.countryCount === 1 ? 'country' : 'countries'}</span>
              </div>
              <div className="public-profile-stat">
                <span className="public-profile-stat-value">{publicProfile.memoryCount}</span>
                <span className="public-profile-stat-label">{publicProfile.memoryCount === 1 ? 'memory' : 'memories'}</span>
              </div>
              <div className="public-profile-stat">
                <span className="public-profile-stat-value">{publicProfile.dreamCount}</span>
                <span className="public-profile-stat-label">{publicProfile.dreamCount === 1 ? 'dream' : 'dreams'}</span>
              </div>
            </div>
            <button
              className="public-profile-add-friend"
              onClick={handleAddFriend}
              disabled={friendRequestSent}
            >
              {friendRequestSent ? 'Request sent' : 'Add friend'}
            </button>
          </div>
        )}

        {/* Other user name header — only when viewing a friend's board */}
        {!isOwnBoard && isFriend && (
          <div className="board-other-user-header">
            <span className="board-other-display-name">{displayName}</span>
            {boardUser?.username && (
              <span className="board-other-username">@{boardUser.username}</span>
            )}
          </div>
        )}

        {/* Board content — hidden for non-friends viewing another user's board */}
        {(isOwnBoard || isFriend) && <>

        {/* Tab switcher + view toggle */}
        <div className="board-tab-row">
          <TabSwitcher activeTab={activeTab} onTabChange={handleTabChange} isOwnBoard={isOwnBoard} />
          <div className="board-view-toggle">
            <button
              className={`board-view-btn${viewMode === 'grid' ? ' board-view-btn-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view — press M to toggle"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <rect x="0" y="0" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="9" y="0" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="0" y="9" width="6" height="6" rx="1" fill="currentColor"/>
                <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={`board-view-btn${viewMode === 'map' ? ' board-view-btn-active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map view — press M to toggle"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5 1L1 3v10l4-2 5 2 4-2V1l-4 2-5-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                <path d="M5 1v10M10 3v10" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            </button>
            <kbd className="board-view-hint" title="Press M to toggle">M</kbd>
            {/* Memory sort selector — own board, memory tab, grid view.
                Lets the user flip between manual rank (server default —
                top 8 first, then most-recently-added) and chronological
                visit order in either direction. */}
            {isOwnBoard && activeTab === 'memory' && viewMode === 'grid' && (
              <select
                className="board-sort-select"
                value={memorySort}
                onChange={(e) => setMemorySort(e.target.value)}
                title="Sort memories"
              >
                <option value="rank">Rank (manual)</option>
                <option value="visit-desc">Newest visit</option>
                <option value="visit-asc">Oldest visit</option>
              </select>
            )}
            {/* Social mode toggle — own board only.
                ON: show friend-overlap avatars + commonality badges on
                each pin so you can see who else has been to / dreams of
                the same places.
                OFF: just your own pins, no social layer. */}
            {isOwnBoard && (
              <button
                className={`board-view-btn board-social-toggle${socialMode ? ' board-view-btn-active' : ''}`}
                onClick={() => setSocialMode(v => !v)}
                title={socialMode ? 'Hide friend overlap (social mode on)' : 'Show friend overlap (social mode off)'}
                aria-pressed={socialMode}
              >
                {/* Two overlapping circles glyph for "social/people".
                    Filled when ON, outline-only when OFF — gives the
                    user a clear visual signal that the icon is a toggle. */}
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <circle
                    cx="5.5" cy="6" r="3"
                    stroke="currentColor" strokeWidth="1.2"
                    fill={socialMode ? 'var(--gold)' : 'none'}
                  />
                  <circle
                    cx="9.5" cy="9" r="3"
                    stroke="currentColor" strokeWidth="1.2"
                    fill={socialMode ? 'var(--gold)' : 'none'}
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Wishlist bar — FUTURE tab, own board. Mirrors the country bar
            below: tappable, opens the WishlistModal (map + list view).
            Always shown (even when empty) on own board so the user can
            discover the wishlist surface without already having one. */}
        {activeTab === 'dream' && isOwnBoard && (
          <button
            type="button"
            className="board-country-bar board-country-bar-clickable board-wishlist-bar"
            onClick={() => setShowWishlistModal(true)}
            aria-label={`Open wishlist (${wishlist.length} ${wishlist.length === 1 ? 'country' : 'countries'})`}
          >
            <span className="board-country-flags">
              {wishlist.length > 0 ? (
                <>
                  {wishlist.slice(0, 8).map(({ country, flag }) => (
                    <span
                      key={country}
                      className="board-country-flag"
                      title={country}
                    >{flag}</span>
                  ))}
                  {wishlist.length > 8 && (
                    <span className="board-country-more">+{wishlist.length - 8}</span>
                  )}
                </>
              ) : (
                <span className="board-country-flag" aria-hidden>✨</span>
              )}
            </span>
            <span className="board-country-label">
              {wishlist.length === 0
                ? 'Add countries to your wishlist'
                : `${wishlist.length} on wishlist`}
            </span>
          </button>
        )}

        {/* Country indicator — memories tab only.
            Whole bar is one big button that opens the countries modal
            (map + list view). Flags are decorative inside the button. */}
        {activeTab === 'memory' && countryCount > 0 && (
          <button
            type="button"
            className="board-country-bar board-country-bar-clickable"
            onClick={() => setShowCountriesModal(true)}
            aria-label={`Open ${countryCount} ${countryCount === 1 ? 'country' : 'countries'} visited`}
          >
            <span className="board-country-flags">
              {countryFlagList.slice(0, 8).map(({ country, flag }) => (
                <span
                  key={country}
                  className="board-country-flag"
                  title={country}
                >{flag}</span>
              ))}
              {countryCount > 8 && (
                <span className="board-country-more">+{countryCount - 8}</span>
              )}
            </span>
            <span className="board-country-label">
              {countryCount} {countryCount === 1 ? 'country' : 'countries'}
            </span>
          </button>
        )}

        {viewMode === 'grid' ? (
          <PinBoard
            pins={activePins}
            topPins={activeTopPins}
            tab={activeTab}
            isOwnBoard={isOwnBoard}
            onAddPin={handleAddPin}
            onPinPress={handlePinPress}
            /* When the user picked a chronological sort on memories,
               tell PinBoard to render in the parent-provided order
               instead of forcing Top 8 to the top. */
            respectManualOrder={!(activeTab === 'memory' && memorySort !== 'rank')}
            /* When social mode is off (own board only), pass an empty
               annotations object so PinCard's friend-icons + count-badge
               don't render. We intentionally don't gate the data fetch —
               the toggle is meant to be cheap and instant. */
            annotations={isOwnBoard && !socialMode ? {} : annotations}
            showInspireButton={showInspire}
            onInspire={handleInspire}
            keyboardFocusedPinId={
              keyboardFocusIndex != null ? activePins[keyboardFocusIndex]?.id : null
            }
            /* I-went CTA now lives in the DreamDetail bottom scroll —
               see DreamDetail.jsx — so we no longer pass showIWent /
               onIWent to PinBoard / PinCard. The detail panel's
               onIWent prop below is still wired. */
            onReorder={handleReorder}
          />
        ) : (
          <div style={{ position: 'relative' }} onClick={(e) => {
            // Close detail panel when clicking the map area (not a marker)
            if (e.target.closest('.leaflet-marker-icon') || e.target.closest('.md-panel')) return;
            if (selectedMemory) setSelectedMemory(null);
            if (selectedDream) setSelectedDream(null);
          }}>
            <PinMap
              pins={activePins}
              tab={activeTab}
              onPinPress={handlePinPress}
              focusedPin={mapFocusIndex !== null ? activePins[mapFocusIndex] : null}
              focusedPinLocations={focusedPinLocations}
              onMapClick={() => { setSelectedMemory(null); setSelectedDream(null); }}
            />

            {/* Map navigation strip */}
            {activePins.length > 0 && (
              <MapNavStrip
                pins={activePins}
                focusIndex={mapFocusIndex}
                onNav={handleMapNav}
                tab={activeTab}
              />
            )}
          </div>
        )}

        {/* Travel Together section - own board, FUTURE tab */}
        {/* @implements REQ-SOCIAL-002, SCN-SOCIAL-002-01 */}
        {isOwnBoard && activeTab === 'dream' && (
          <TravelTogetherSection />
        )}

        {/* Overlap section - friend's board (single-friend pair) */}
        {!isOwnBoard && isFriend && (
          <OverlapSection friendId={targetUserId} friendName={displayName} />
        )}

        {/* Multi-friend compare — layer additional friends to find
            shared destinations + advisor opportunities. Lives below
            the single-friend overlap so it's an explicit "go deeper"
            affordance. */}
        {!isOwnBoard && isFriend && (
          <MultiFriendCompare initialFriendId={targetUserId} initialFriendName={displayName} />
        )}

        {/* FAB for adding a pin - only shown on own board */}
        {isOwnBoard && (
          <button className="board-fab" onClick={handleAddPin} title={activeTab === 'memory' ? 'Add a memory' : 'Add a dream'}>
            +
          </button>
        )}

        </>}

        {/* Toast */}
        {toast && (
          <div className="board-toast">{toast}</div>
        )}

        {/* TT16: undo bar after dream conversion */}
        {undoConvert && (
          <div className="board-undo-bar">
            <span>✓ Memory created!</span>
            <button className="board-undo-btn" onClick={handleUndoConvert}>Undo</button>
          </div>
        )}

        {/* Detail panels */}
        <MemoryDetail
          pin={selectedMemory}
          isOpen={!!selectedMemory}
          onClose={() => setSelectedMemory(null)}
          onUpdated={fetchData}
          onPinChanged={handlePinChanged}
          rank={getPinRank(selectedMemory?.id)}
          noBackdrop={viewMode === 'map'}
          readOnly={!isOwnBoard}
        />
        <DreamDetail
          pin={selectedDream}
          isOpen={!!selectedDream}
          onClose={() => setSelectedDream(null)}
          onUpdated={fetchData}
          onPinChanged={handlePinChanged}
          rank={getPinRank(selectedDream?.id)}
          noBackdrop={viewMode === 'map'}
          readOnly={!isOwnBoard}
          onIWent={isOwnBoard ? (pin) => { setSelectedDream(null); setDreamConvertPin(pin); setDreamConvertOpen(true); } : null}
        />

        {/* Modals */}
        <VoiceCapture
          isOpen={voiceCaptureOpen}
          onClose={() => { setVoiceCaptureOpen(false); setVoicePreSeed(null); }}
          onSaved={handleVoiceSaved}
          /* When the voice capture is the second half of a dream→memory
             conversion (handleVoicePath stored the dream id in
             pendingDreamConversion), thread the source dream id so the
             server fans out 'friend_converted' notifications. */
          convertedFromDreamId={pendingDreamConversion?.dreamPinId}
        />

        <DreamPinCreator
          isOpen={dreamCreatorOpen}
          onClose={() => setDreamCreatorOpen(false)}
          onSaved={handlePinSaved}
        />

        {/* Dream-to-memory conversion modal */}
        {/* @implements REQ-DREAM-005, SCN-DREAM-005-01, SCN-DREAM-005-02 */}
        <DreamConvertModal
          isOpen={dreamConvertOpen}
          dreamPin={dreamConvertPin}
          onClose={() => { setDreamConvertOpen(false); setDreamConvertPin(null); }}
          onOpenVoiceCapture={handleOpenVoiceCapturePreSeeded}
          onVoicePath={handleVoicePath}
          onSaved={handleDreamConvertSaved}
        />

        {/* Countries modal */}
        {showCountriesModal && (
          <CountriesModal
            countries={countryFlagList}
            onClose={() => setShowCountriesModal(false)}
            onCountryAdded={() => { boardCache.delete(cacheKey); fetchData(); }}
            onCountryRemoved={async (countryName) => {
              // Find the user's memory pins whose placeName matches the
              // country exactly (case-insensitive) — these are the pins
              // created via the modal's quick-add path. Delete them.
              // Pins where the country is a side-effect of a city-level
              // visit (e.g. "Ankara, Turkey") are intentionally NOT
              // touched — those carry richer memory content.
              const target = (countryName || '').trim().toLowerCase();
              const matches = memoryPins.filter(p => {
                const name = (p.placeName || '').trim().toLowerCase();
                return name === target;
              });
              if (matches.length === 0) return false;
              try {
                await Promise.all(matches.map(p => api.delete(`/pins/${p.id}`)));
                boardCache.delete(cacheKey);
                fetchData();
                return true;
              } catch {
                return false;
              }
            }}
          />
        )}

        {/* Wishlist modal — FUTURE-tab analog to CountriesModal. */}
        {showWishlistModal && (
          <WishlistModal
            wishlist={wishlist}
            visited={countryFlagList}
            onClose={() => setShowWishlistModal(false)}
            onWishlistAdded={fetchWishlist}
            onWishlistRemoved={fetchWishlist}
          />
        )}

        {/* Welcome modal for first-time users */}
        {showWelcome && (
          <WelcomeModal onDismiss={() => setShowWelcome(false)} />
        )}

        {/* Dream conversion follow-up prompt (voice path) */}
        {/* @implements REQ-DREAM-005, SCN-DREAM-005-02 */}
        {pendingDreamConversion && (
          <div className="dream-followup-toast">
            <p>Keep your dream pin for {pendingDreamConversion.dreamPlaceName} or mark it visited?</p>
            <div className="dream-followup-actions">
              <button className="dream-followup-keep" onClick={handleFollowUpKeep}>
                Keep as dream
              </button>
              <button className="dream-followup-archive" onClick={handleFollowUpArchive}>
                Mark as visited
              </button>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
