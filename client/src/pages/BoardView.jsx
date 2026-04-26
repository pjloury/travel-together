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
import CountriesModal from '../components/CountriesModal';
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

  // Grid / map toggle
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
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

  // Fetch annotations for active tab
  useEffect(() => {
    if (!targetUserId) return;

    async function fetchAnnotations() {
      try {
        const tabParam = activeTab;
        let res;
        if (isOwnBoard) {
          res = await api.get(`/social/annotations?tab=${tabParam}`);
        } else {
          res = await api.get(`/social/annotations/${targetUserId}?tab=${tabParam}`);
        }
        setAnnotations(res.data || res || {});
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

  /**
   * Add a pin to Top 8 (append to end of current top list, capped at 8).
   */
  async function handleTop8Add(pinId) {
    const currentTop = activeTab === 'memory' ? memoryTop : dreamTop;
    const currentIds = (currentTop || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(tp => tp.pin?.id || tp.pinId)
      .filter(Boolean);
    if (currentIds.length >= 8) {
      showToast('Top 8 is full — remove one first');
      return;
    }
    const newIds = [...currentIds, pinId];
    try {
      await api.put('/pins/top', { tab: activeTab, pinIds: newIds });
      fetchData();
    } catch (err) {
      showToast(err.message || 'Could not update Top 8');
    }
  }

  /**
   * Remove a pin from Top 8.
   */
  async function handleTop8Remove(pinId) {
    const currentTop = activeTab === 'memory' ? memoryTop : dreamTop;
    const currentIds = (currentTop || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(tp => tp.pin?.id || tp.pinId)
      .filter(Boolean);
    const newIds = currentIds.filter(id => id !== pinId);
    try {
      await api.put('/pins/top', { tab: activeTab, pinIds: newIds });
      fetchData();
    } catch (err) {
      showToast(err.message || 'Could not update Top 8');
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

  // Keyboard arrow nav — works in both grid and map view
  useEffect(() => {
    function handleKey(e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // Don't steal keypresses when typing in an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
      e.preventDefault();
      const pins = activeTab === 'memory' ? memoryPins : dreamPins;
      if (!pins.length) return;
      // Derive current index from the open detail panel (works in both grid + map)
      const openPin = activeTab === 'memory' ? selectedMemory : selectedDream;
      const current = openPin ? pins.findIndex(p => p.id === openPin.id) : -1;
      const next = e.key === 'ArrowRight'
        ? Math.min(pins.length - 1, current + 1)
        : Math.max(0, current <= 0 ? 0 : current - 1);
      handleMapNav(next);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, memoryPins, dreamPins, selectedMemory, selectedDream]);

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
   * Handle "I went!" action on own dream pin.
   * @implements REQ-DREAM-005, SCN-DREAM-005-01
   */
  function handleIWent(pin) {
    setDreamConvertPin(pin);
    setDreamConvertOpen(true);
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
  const visibleMemoryPins = activeTab === 'memory'
    ? memoryPins.filter(p => !p.countryOnly)
    : memoryPins;
  const activePins = activeTab === 'memory' ? visibleMemoryPins : dreamPins;
  const activeTopPins = activeTab === 'memory' ? memoryTop : dreamTop;
  const displayName = isOwnBoard ? user?.displayName : (boardUser?.displayName || 'User');

  // Compute rank of a pin within the Top 8 sorted list (1-based, null if not in Top 8)
  function getPinRank(pinId) {
    if (!pinId || !activeTopPins || !activeTopPins.length) return null;
    const sorted = [...activeTopPins].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const idx = sorted.findIndex(tp => (tp.pin?.id || tp.pinId) === pinId);
    return idx === -1 ? null : idx + 1;
  }

  // Determine if inspire/iwent buttons should show on pins
  const showInspire = !isOwnBoard && isFriend && activeTab === 'dream';
  const showIWent = isOwnBoard && activeTab === 'dream';

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
              title="Grid view"
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
              title="Map view"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M5 1L1 3v10l4-2 5 2 4-2V1l-4 2-5-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
                <path d="M5 1v10M10 3v10" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            </button>
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
            /* When social mode is off (own board only), pass an empty
               annotations object so PinCard's friend-icons + count-badge
               don't render. We intentionally don't gate the data fetch —
               the toggle is meant to be cheap and instant. */
            annotations={isOwnBoard && !socialMode ? {} : annotations}
            showInspireButton={showInspire}
            onInspire={handleInspire}
            showIWentButton={showIWent}
            onIWent={handleIWent}
            onReorder={handleReorder}
            onTop8Add={handleTop8Add}
            onTop8Remove={handleTop8Remove}
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

        {/* Overlap section - friend's board */}
        {!isOwnBoard && isFriend && (
          <OverlapSection friendId={targetUserId} friendName={displayName} />
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
