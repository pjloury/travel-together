// PinCard component - visual card for a single memory or dream pin.
//
// Spec: docs/app/spec.md Section 4, Section 7 (Unsplash/gradient fallback), Section 9 (tag taxonomy)
// @implements REQ-MEMORY-002, REQ-DREAM-002, REQ-MEMORY-006, REQ-DREAM-003,
//             REQ-SOCIAL-003, REQ-DREAM-005, REQ-DISCOVERY-001, REQ-DISCOVERY-002

import { useState, useRef, useEffect } from 'react';
import { countryFlag, countryFlagFromPlace } from '../utils/countryFlag';

/**
 * PinCard renders a single pin as a visual card.
 *
 * @implements REQ-MEMORY-002 (memories displayed as visual cards with AI summary, image-forward)
 * @implements REQ-DREAM-002 (dream pins as visual pinboard with Unsplash + gradient/emoji fallback)
 * @implements REQ-MEMORY-006 (warm visual treatment for memories)
 * @implements REQ-DREAM-003 (large imagery, minimal chrome for dreams)
 * @implements REQ-SOCIAL-003 (inspire button on friend dream pins)
 * @implements REQ-DREAM-005 (I went button on own dream pins)
 * @implements REQ-DISCOVERY-001 ("Sarah has been to Tokyo" on dream pins)
 * @implements REQ-DISCOVERY-002 ("3 friends dream of visiting Patagonia" on memory pins)
 *
 * @param {Object} props
 * @param {Object} props.pin - Pin data object
 * @param {boolean} props.isTop8 - Whether this pin is in the Top 8
 * @param {function} props.onPress - Click handler
 * @param {function} props.onLongPress - Long press handler
 * @param {Object} [props.annotation] - Social annotation data (friendsDreamingCount, friendsBeenCount, etc.)
 * @param {boolean} [props.showInspireButton] - Show "I'm interested too!" button (friend dream pins)
 * @param {function} [props.onInspire] - Callback when inspire button is clicked
 * @param {boolean} [props.showIWentButton] - Show "I went!" button (own dream pins)
 * @param {function} [props.onIWent] - Callback when I went button is clicked
 * @param {Object} [props.annotationDetail] - Detailed annotation data { friends: [...], count: N }
 */

const DEFAULT_EMOJI = '\uD83C\uDF0D';

// Curated gradient palette — rich mid-tones with enough depth for white text.
// Think travel-poster warmth: amber, teal, terracotta, slate, plum, sage.
const CARD_GRADIENTS = [
  ['#6B4A18', '#B8860B'],  // Warm amber / gold (reference tone)
  ['#1E4A6E', '#2E7AB0'],  // Rich cerulean
  ['#5C2010', '#A03A20'],  // Terracotta / burnt sienna
  ['#1E4A38', '#2E7A55'],  // Deep forest
  ['#4A1A3C', '#823065'],  // Dusty plum
  ['#2A3A60', '#3A5A98'],  // Slate blue
  ['#5A3A18', '#906028'],  // Warm leather / umber
  ['#1A4848', '#2A7870'],  // Deep teal
  ['#3A3A12', '#6A6420'],  // Olive / sage
  ['#5A1E38', '#902A58'],  // Deep rose
];

/** Stable hash of a string → non-negative integer */
function hashId(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function getCardImage(pin) {
  if (pin.photoUrl) return pin.photoUrl;
  if (pin.unsplashImageUrl) return pin.unsplashImageUrl;
  return null;
}

function getFallbackGradient(pin) {
  // Tag gradient takes priority (tags carry curated brand colors)
  if (pin.tags && pin.tags.length > 0) {
    const tag = pin.tags[0];
    if (tag.gradientStart && tag.gradientEnd) {
      return `linear-gradient(145deg, ${tag.gradientStart}, ${tag.gradientEnd})`;
    }
  }
  // Deterministic dark gradient — consistent per pin, varies across cards
  const [start, end] = CARD_GRADIENTS[hashId(pin.id) % CARD_GRADIENTS.length];
  return `linear-gradient(145deg, ${start}, ${end})`;
}

function getFallbackEmoji(pin) {
  if (pin.tags && pin.tags.length > 0 && pin.tags[0].emoji) {
    return pin.tags[0].emoji;
  }
  return DEFAULT_EMOJI;
}

function renderRating(rating) {
  if (!rating) return null;
  const hearts = [];
  for (let i = 0; i < rating; i++) {
    hearts.push('\u2764\uFE0F');
  }
  return <span className="pin-rating">{hearts.join('')}</span>;
}

export default function PinCard({ pin, isTop8: _isTop8, rank, onPress, onLongPress, annotation, showInspireButton, onInspire, showIWentButton, onIWent, annotationDetail, showTop8Menu, isInTop8, onTop8Add, onTop8Remove }) {
  const image = getCardImage(pin);
  const isMemory = pin.pinType === 'memory';
  const isDream = pin.pinType === 'dream';

  // Collect all unique country flags across primary pin + stop locations.
  // Falls back to parsing country from placeName (e.g. "Petra, Jordan" → Jordan)
  // when normalizedCountry hasn't been geocoded yet.
  const allFlags = (() => {
    const seen = new Set();
    const flags = [];
    const add = (country) => {
      if (!country || seen.has(country)) return;
      const f = countryFlag(country);
      if (f) { seen.add(country); flags.push(f); }
    };
    // Multi-country array first (covers multi-stop trips)
    (pin.countries || []).forEach(add);
    add(pin.normalizedCountry);
    (pin.locations || []).forEach(loc => {
      if (loc.normalizedCountry) {
        add(loc.normalizedCountry);
      } else if (loc.placeName) {
        // Fallback: extract country from "City, Country" format
        const parsed = countryFlagFromPlace(loc.placeName);
        if (parsed) add(parsed.country);
      }
    });
    return flags;
  })();

  // Social badge counts
  const friendsDreamingCount = annotation?.friendsDreamingCount || 0;
  const friendsBeenCount = annotation?.friendsBeenCount || 0;
  // On memory cards: show friendsDreamingCount
  // On dream cards: show friendsVisitedCount (friendsBeenCount)
  const socialBadgeCount = isMemory ? friendsDreamingCount : friendsBeenCount;

  // @implements REQ-DISCOVERY-001, REQ-DISCOVERY-002 (annotation popover state)
  const [showAnnotationPopover, setShowAnnotationPopover] = useState(false);
  const popoverRef = useRef(null);

  // Top 8 context menu
  const [showTop8Popup, setShowTop8Popup] = useState(false);
  const top8PopupRef = useRef(null);

  useEffect(() => {
    if (!showTop8Popup) return;
    function handleClickOutside(e) {
      if (top8PopupRef.current && !top8PopupRef.current.contains(e.target)) {
        setShowTop8Popup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTop8Popup]);

  // Close popover on outside click
  useEffect(() => {
    if (!showAnnotationPopover) return;
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowAnnotationPopover(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAnnotationPopover]);

  let longPressTimer = null;

  function handlePointerDown() {
    if (onLongPress) {
      longPressTimer = setTimeout(() => {
        onLongPress(pin);
        longPressTimer = null;
      }, 500);
    }
  }

  function handlePointerUp() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function handleClick() {
    if (onPress) onPress(pin);
  }

  function handleInspireClick(e) {
    e.stopPropagation();
    if (onInspire) onInspire(pin.id);
  }

  function handleIWentClick(e) {
    e.stopPropagation();
    if (onIWent) onIWent(pin);
  }

  function handleBadgeClick(e) {
    e.stopPropagation();
    if (annotationDetail && annotationDetail.friends && annotationDetail.friends.length > 0) {
      setShowAnnotationPopover(!showAnnotationPopover);
    }
  }

  // Build annotation detail from annotation prop if annotationDetail not explicitly provided
  const effectiveAnnotationDetail = annotationDetail || buildAnnotationDetail(annotation);

  return (
    <div
      className={`pin-card ${isMemory ? 'pin-card-memory' : 'pin-card-dream'}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="button"
      tabIndex={0}
    >
      {/* Friend commonality avatars — top-right, same size as emoji */}
      {socialBadgeCount > 0 && effectiveAnnotationDetail?.friends?.length > 0 && (
        <div className="pin-card-friend-icons">
          {effectiveAnnotationDetail.friends.slice(0, 3).map((f, i) => (
            <div key={i} className="pin-card-friend-icon" title={f.displayName || f.display_name}>
              {f.avatarUrl || f.avatar_url
                ? <img src={f.avatarUrl || f.avatar_url} alt="" />
                : <span>{(f.displayName || f.display_name || '?').charAt(0)}</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Country flag(s) — up to 5 shown, +N overflow for larger trips */}
      {allFlags.length > 0 && (
        <div className="pin-card-flags">
          {allFlags.slice(0, 5).map((flag, i) => (
            <span key={i} className="pin-card-flag-item">{flag}</span>
          ))}
          {allFlags.length > 5 && (
            <span className="pin-card-flag-overflow">+{allFlags.length - 5}</span>
          )}
        </div>
      )}

      {/* Top 8 context menu "..." */}
      {showTop8Menu && (
        <div className="pin-top8-menu-wrap" ref={top8PopupRef}>
          <button
            className="pin-top8-menu-btn"
            onClick={(e) => { e.stopPropagation(); setShowTop8Popup(v => !v); }}
            aria-label="Pin options"
          >
            ···
          </button>
          {showTop8Popup && (
            <div className="pin-top8-popup">
              {isInTop8 ? (
                <button
                  className="pin-top8-popup-item"
                  onClick={(e) => { e.stopPropagation(); setShowTop8Popup(false); if (onTop8Remove) onTop8Remove(pin.id); }}
                >
                  Remove from Top 8
                </button>
              ) : (
                <button
                  className="pin-top8-popup-item"
                  onClick={(e) => { e.stopPropagation(); setShowTop8Popup(false); if (onTop8Add) onTop8Add(pin.id); }}
                >
                  Add to Top 8
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Image or gradient fallback */}
      {image ? (
        <div className="pin-card-image" style={{ backgroundImage: `url(${image})` }}>
          <div className="pin-card-overlay">
            <div className="pin-card-meta pin-card-meta-top">
              <h3 className="pin-card-place">{rank != null && rank <= 8 ? `#${rank} ` : ''}{pin.placeName}</h3>
            </div>
            {pin.tags && pin.tags.length > 0 && (
              <div className="pin-card-meta pin-card-meta-bottom">
                <div className="pin-card-tags">
                  {pin.tags.slice(0, 3).map((tag, i) => (
                    <span key={tag.id || i} className="pin-tag-chip">
                      {tag.emoji ? `${tag.emoji} ` : ''}{tag.shortName || tag.name}
                    </span>
                  ))}
                  {pin.tags.length > 3 && (
                    <span className="pin-tag-overflow" title={pin.tags.slice(3).map(t => t.name).join(', ')}>
                      +{pin.tags.length - 3}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="pin-card-gradient" style={{ background: getFallbackGradient(pin) }}>
          <div className="pin-card-emoji">{getFallbackEmoji(pin)}</div>
          <div className="pin-card-meta pin-card-meta-gradient pin-card-meta-top">
            <h3 className="pin-card-place">{pin.placeName}</h3>
          </div>
          {pin.tags && pin.tags.length > 0 && (
            <div className="pin-card-meta pin-card-meta-gradient pin-card-meta-bottom">
              <div className="pin-card-tags">
                {pin.tags.map((tag, i) => (
                  <span key={tag.id || i} className="pin-tag-chip">
                    {tag.emoji ? `${tag.emoji} ` : ''}{tag.shortName || tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Memory-specific: visit year, rating, summary */}
      {isMemory && (
        <div className="pin-card-info pin-card-info-memory">
          <div className="pin-card-info-row">
            {pin.visitYear && <span className="pin-visit-year">{pin.visitYear}</span>}
            {renderRating(pin.rating)}
          </div>
          {pin.aiSummary && (
            <p className="pin-summary">{pin.aiSummary}</p>
          )}
        </div>
      )}

      {/* Rank is now prefixed in the card title text */}

      {/* Social badge - tappable with popover */}
      {/* @implements REQ-DISCOVERY-001, REQ-DISCOVERY-002 */}
      {socialBadgeCount > 0 && (
        <span
          className="pin-social-badge pin-social-badge-tappable"
          onClick={handleBadgeClick}
          role="button"
          tabIndex={0}
        >
          {'\uD83D\uDC65'} {socialBadgeCount}
        </span>
      )}

      {/* Annotation popover */}
      {showAnnotationPopover && effectiveAnnotationDetail && effectiveAnnotationDetail.friends && effectiveAnnotationDetail.friends.length > 0 && (
        <div className="pin-annotation-popover" ref={popoverRef}>
          {effectiveAnnotationDetail.friends.slice(0, 3).map((friend, i) => (
            <div key={friend.userId || i} className="pin-annotation-friend">
              {friend.avatarUrl ? (
                <img src={friend.avatarUrl} alt={friend.displayName} className="pin-annotation-avatar" />
              ) : (
                <div className="pin-annotation-avatar-placeholder">
                  {friend.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="pin-annotation-name">{friend.displayName}</span>
            </div>
          ))}
          {effectiveAnnotationDetail.count > 3 && (
            <div className="pin-annotation-more">
              and {effectiveAnnotationDetail.count - 3} more
            </div>
          )}
        </div>
      )}

      {/* Inspired by label */}
      {pin.inspiredByDisplayName && (
        <span className="pin-inspired-by">Inspired by {pin.inspiredByDisplayName}</span>
      )}

      {/* "I'm interested too!" button for friend dream pins */}
      {/* @implements REQ-SOCIAL-003, SCN-SOCIAL-003-01 */}
      {showInspireButton && isDream && (
        <button className="pin-inspire-btn" onClick={handleInspireClick}>
          {'\u2728'} I'm interested too!
        </button>
      )}

      {/* "I went!" button for own dream pins */}
      {/* @implements REQ-DREAM-005, SCN-DREAM-005-01 */}
      {showIWentButton && isDream && (
        <button className="pin-iwent-btn" onClick={handleIWentClick}>
          {'\uD83C\uDF89'} I went!
        </button>
      )}
    </div>
  );
}

/**
 * Build annotation detail from the annotation object provided by the API.
 * Extracts friend list from friendsBeen or friendsDreaming arrays.
 */
function buildAnnotationDetail(annotation) {
  if (!annotation) return null;

  // From dream tab annotations: friendsBeen has objects with id/displayName
  if (annotation.friendsBeen && annotation.friendsBeen.length > 0) {
    return {
      friends: annotation.friendsBeen.map(f => ({
        userId: f.id,
        displayName: f.displayName,
        avatarUrl: f.avatarUrl || null,
      })),
      count: annotation.friendsBeenCount || annotation.friendsBeen.length,
    };
  }

  // From memory tab annotations: friendsDreaming is array of names
  if (annotation.friendsDreaming && annotation.friendsDreaming.length > 0) {
    return {
      friends: annotation.friendsDreaming.map((name, i) => ({
        userId: `friend-${i}`,
        displayName: typeof name === 'string' ? name : name.displayName || 'Friend',
        avatarUrl: typeof name === 'object' ? name.avatarUrl : null,
      })),
      count: annotation.friendsDreamingCount || annotation.friendsDreaming.length,
    };
  }

  return null;
}
