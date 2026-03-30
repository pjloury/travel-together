// BoardView page - main app page, user's profile/board.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-001, REQ-NAV-002, REQ-NAV-003, REQ-NAV-004, REQ-NAV-007,
//             REQ-SOCIAL-001, REQ-SOCIAL-002, REQ-SOCIAL-003,
//             REQ-DISCOVERY-001, REQ-DISCOVERY-002,
//             REQ-DREAM-005

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import TabSwitcher from '../components/TabSwitcher';
import PinBoard from '../components/PinBoard';
import PinMap from '../components/PinMap';
import VoiceCapture from '../components/VoiceCapture';
import DreamPinCreator from '../components/DreamPinCreator';
import Top8Manager from '../components/Top8Manager';
import DreamConvertModal from '../components/DreamConvertModal';
import MemoryDetail from '../components/MemoryDetail';
import TravelTogetherSection from '../components/TravelTogetherSection';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

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
export default function BoardView({ deepLinkTab }) {
  const { userId: paramUserId } = useParams();
  const { user } = useAuth();

  const isOwnBoard = !paramUserId || paramUserId === user?.id;
  const targetUserId = paramUserId || user?.id;

  const [activeTab, setActiveTab] = useState(deepLinkTab || 'memory');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [memoryPins, setMemoryPins] = useState([]);
  const [dreamPins, setDreamPins] = useState([]);
  const [memoryTop, setMemoryTop] = useState([]);
  const [dreamTop, setDreamTop] = useState([]);
  const [annotations, setAnnotations] = useState({});
  const [boardUser, setBoardUser] = useState(null);
  const [memoryCount, setMemoryCount] = useState(0);
  const [dreamCount, setDreamCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Friendship check for non-own boards
  // @implements REQ-SOCIAL-003 (need isFriend to show inspire button)
  const [isFriend, setIsFriend] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);

  // Modal states
  const [voiceCaptureOpen, setVoiceCaptureOpen] = useState(false);
  const [dreamCreatorOpen, setDreamCreatorOpen] = useState(false);
  const [top8ManagerOpen, setTop8ManagerOpen] = useState(false);

  // Dream convert modal state
  // @implements REQ-DREAM-005
  const [dreamConvertOpen, setDreamConvertOpen] = useState(false);
  const [dreamConvertPin, setDreamConvertPin] = useState(null);

  // Memory detail modal state
  const [selectedMemory, setSelectedMemory] = useState(null);

  // Voice capture pre-seed data (for dream-to-memory voice path)
  const [voicePreSeed, setVoicePreSeed] = useState(null);

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

  // Fetch all data on mount and when target user changes
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const userIdParam = isOwnBoard ? '' : `&userId=${targetUserId}`;

      const [memRes, dreamRes, memTopRes, dreamTopRes] = await Promise.all([
        api.get(`/pins?type=memory${userIdParam}`),
        api.get(`/pins?type=dream${userIdParam}`),
        api.get(`/pins/top?tab=memory${isOwnBoard ? '' : `&userId=${targetUserId}`}`),
        api.get(`/pins/top?tab=dream${isOwnBoard ? '' : `&userId=${targetUserId}`}`),
      ]);

      setMemoryPins(memRes.data?.pins || memRes.pins || []);
      setDreamPins(dreamRes.data?.pins || dreamRes.pins || []);
      setMemoryCount(memRes.data?.memoryCount || memRes.data?.pins?.length || memRes.pins?.length || 0);
      setDreamCount(dreamRes.data?.dreamCount || dreamRes.data?.pins?.length || dreamRes.pins?.length || 0);
      setMemoryTop(memTopRes.data || memTopRes || []);
      setDreamTop(dreamTopRes.data || dreamTopRes || []);

      // If viewing another user, fetch their info
      if (!isOwnBoard) {
        setBoardUser(null); // Will be populated if we add a dedicated endpoint
      }
    } catch {
      // Silently handle - empty state will show
    } finally {
      setLoading(false);
    }
  }, [isOwnBoard, targetUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
  }

  function handleAddPin() {
    if (activeTab === 'memory') {
      setVoicePreSeed(null);
      setVoiceCaptureOpen(true);
    } else {
      setDreamCreatorOpen(true);
    }
  }

  function handlePinSaved() {
    fetchData();
  }

  function handlePinPress(pin) {
    if (pin.pinType === 'memory' && isOwnBoard) {
      setSelectedMemory(pin);
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
  function handleVoiceSaved() {
    fetchData();
    if (pendingDreamConversion) {
      // Follow-up prompt will be shown via pendingDreamConversion state
      showToast('Memory created!');
    } else {
      handlePinSaved();
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

  function handleDreamConvertSaved() {
    fetchData();
    showToast('Memory created!');
  }

  const activePins = activeTab === 'memory' ? memoryPins : dreamPins;
  const activeTopPins = activeTab === 'memory' ? memoryTop : dreamTop;
  const displayName = isOwnBoard ? user?.displayName : (boardUser?.displayName || 'User');

  // Determine if inspire/iwent buttons should show on pins
  const showInspire = !isOwnBoard && isFriend && activeTab === 'dream';
  const showIWent = isOwnBoard && activeTab === 'dream';

  if (loading) {
    return (
      <Layout>
        <div className="loading">Loading...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="board-view">
        {/* Other user name header — only when viewing someone else's board */}
        {!isOwnBoard && (
          <div className="board-other-user-header">
            <span className="board-other-display-name">{displayName}</span>
          </div>
        )}

        {/* Tab switcher + view toggle */}
        <div className="board-tab-row">
          <TabSwitcher activeTab={activeTab} onTabChange={handleTabChange} isOwnBoard={isOwnBoard} />
          <div className="board-tab-row-right">
            {isOwnBoard && (
              <button
                className="board-edit-top8-btn"
                onClick={() => setTop8ManagerOpen(true)}
              >
                Edit Top 8
              </button>
            )}
          <div className="board-view-toggle">
            <button
              className={`board-view-btn${viewMode === 'grid' ? ' board-view-btn-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              {/* grid icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="0" y="0" width="6" height="6" rx="0.5" fill="currentColor"/>
                <rect x="8" y="0" width="6" height="6" rx="0.5" fill="currentColor"/>
                <rect x="0" y="8" width="6" height="6" rx="0.5" fill="currentColor"/>
                <rect x="8" y="8" width="6" height="6" rx="0.5" fill="currentColor"/>
              </svg>
            </button>
            <button
              className={`board-view-btn${viewMode === 'map' ? ' board-view-btn-active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map view"
            >
              {/* globe icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <ellipse cx="7" cy="7" rx="2.5" ry="6" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2"/>
                <line x1="2" y1="4" x2="12" y2="4" stroke="currentColor" strokeWidth="1"/>
                <line x1="2" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="1"/>
              </svg>
            </button>
          </div>
          </div>
        </div>

        {/* Grid view */}
        {viewMode === 'grid' && (
          <>
            <PinBoard
              pins={activePins}
              topPins={activeTopPins}
              tab={activeTab}
              isOwnBoard={isOwnBoard}
              onAddPin={handleAddPin}
              onPinPress={handlePinPress}
              annotations={annotations}
              showInspireButton={showInspire}
              onInspire={handleInspire}
              showIWentButton={showIWent}
              onIWent={handleIWent}
            />
            {/* Travel Together section - own board, FUTURE tab */}
            {/* @implements REQ-SOCIAL-002, SCN-SOCIAL-002-01 */}
            {isOwnBoard && activeTab === 'dream' && (
              <TravelTogetherSection />
            )}
          </>
        )}

        {/* Map view */}
        {viewMode === 'map' && (
          <PinMap tab={activeTab} />
        )}

        {/* FAB for adding a pin - only shown on own board */}
        {isOwnBoard && (
          <button className="board-fab" onClick={handleAddPin} title={activeTab === 'memory' ? 'Add a memory' : 'Add a dream'}>
            +
          </button>
        )}

        {/* Toast */}
        {toast && (
          <div className="board-toast">{toast}</div>
        )}

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

        <Top8Manager
          isOpen={top8ManagerOpen}
          onClose={() => setTop8ManagerOpen(false)}
          memoryPins={memoryPins}
          dreamPins={dreamPins}
          memoryTop={memoryTop}
          dreamTop={dreamTop}
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

        {/* Memory detail modal */}
        {selectedMemory && (
          <MemoryDetail
            pin={selectedMemory}
            isOpen={!!selectedMemory}
            onClose={() => setSelectedMemory(null)}
            onUpdated={() => { setSelectedMemory(null); fetchData(); }}
          />
        )}
      </div>
    </Layout>
  );
}
