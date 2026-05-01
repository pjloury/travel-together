// PinCard component - visual card for a single memory or dream pin.
//
// Spec: docs/app/spec.md Section 4, Section 7 (Unsplash/gradient fallback), Section 9 (tag taxonomy)
// @implements REQ-MEMORY-002, REQ-DREAM-002, REQ-MEMORY-006, REQ-DREAM-003,
//             REQ-SOCIAL-003, REQ-DREAM-005, REQ-DISCOVERY-001, REQ-DISCOVERY-002

import { useRef, useEffect, useState } from 'react';
import { countryFlag, countryFlagFromPlace } from '../utils/countryFlag';

/**
 * PinCard renders a single pin as a visual card.
 *
 * @param {Object} props
 * @param {Object} props.pin - Pin data object
 * @param {boolean} props.isTop8 - Whether this pin is in the Top 8
 * @param {function} props.onPress - Click handler
 * @param {function} props.onLongPress - Long press handler
 * @param {Object} [props.annotation] - Social annotation data (friendsDreamingCount, friendsBeenCount, etc.)
 * @param {boolean} [props.showInspireButton] - Show "I'm interested too!" button (friend dream pins)
 * @param {function} [props.onInspire] - Callback when inspire button is clicked
 * @param {Object} [props.annotationDetail] - Detailed annotation data
 */

const DEFAULT_EMOJI = '🌍';

// Curated gradient palette — rich mid-tones with enough depth for white text.
const CARD_GRADIENTS = [
  ['#6B4A18', '#B8860B'],
  ['#1E4A6E', '#2E7AB0'],
  ['#5C2010', '#A03A20'],
  ['#1E4A38', '#2E7A55'],
  ['#4A1A3C', '#823065'],
  ['#2A3A60', '#3A5A98'],
  ['#5A3A18', '#906028'],
  ['#1A4848', '#2A7870'],
  ['#3A3A12', '#6A6420'],
  ['#5A1E38', '#902A58'],
];

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
  if (pin.tags && pin.tags.length > 0) {
    const tag = pin.tags[0];
    if (tag.gradientStart && tag.gradientEnd) {
      return `linear-gradient(145deg, ${tag.gradientStart}, ${tag.gradientEnd})`;
    }
  }
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
    hearts.push('❤️');
  }
  return <span className="pin-rating">{hearts.join('')}</span>;
}

/** Build natural-language tooltip text from been + dreaming friend lists. */
function buildTooltipText(been, dreaming) {
  const firstName = (f) => (f.displayName || 'Friend').split(' ')[0];
  const beenNames = been.map(firstName);
  const dreamNames = dreaming.map(firstName);

  const join = (names) => {
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  };

  if (been.length > 0 && dreaming.length === 0) {
    if (been.length === 2) return `${beenNames[0]} and ${beenNames[1]} have both been here`;
    return `${join(beenNames)} ${been.length === 1 ? 'has' : 'have'} been here`;
  }
  if (dreaming.length > 0 && been.length === 0) {
    if (dreaming.length === 2) return `${dreamNames[0]} and ${dreamNames[1]} both want to go here`;
    return `${join(dreamNames)} ${dreaming.length === 1 ? 'wants' : 'want'} to go here`;
  }
  // Mixed: both been and dreaming
  const beenPart = `${join(beenNames)} ${been.length === 1 ? 'has' : 'have'} been`;
  const dreamPart = `${join(dreamNames)} ${dreaming.length === 1 ? 'wants' : 'want'} to go`;
  return `${beenPart} · ${dreamPart}`;
}

/**
 * Build annotation detail from the annotation object provided by the API.
 * Returns { been, dreaming, friends, count } — both arrays populated when present.
 */
function buildAnnotationDetail(annotation) {
  if (!annotation) return null;

  const mapFriend = (f, i) => {
    if (typeof f === 'string') return { userId: `friend-${i}`, displayName: f, avatarUrl: null };
    return {
      userId: f.userId || f.id || `friend-${i}`,
      displayName: f.displayName || 'Friend',
      avatarUrl: f.avatarUrl || null,
    };
  };

  const been = (annotation.friendsBeen || []).map(mapFriend);
  const dreaming = (annotation.friendsDreaming || []).map(mapFriend);

  if (been.length === 0 && dreaming.length === 0) return null;

  // friends = combined list for legacy callers; been first
  const friends = [...been, ...dreaming];
  return {
    been,
    dreaming,
    friends,
    count: (annotation.friendsBeenCount || been.length) + (annotation.friendsDreamingCount || dreaming.length),
  };
}

export default function PinCard({ pin, isTop8: _isTop8, rank, onPress, onLongPress, annotation, showInspireButton, onInspire, annotationDetail, keyboardFocused }) {
  const image = getCardImage(pin);
  const isMemory = pin.pinType === 'memory';
  const isDream = pin.pinType === 'dream';

  const allFlags = (() => {
    const seen = new Set();
    const flags = [];
    const add = (country) => {
      if (!country || seen.has(country)) return;
      const f = countryFlag(country);
      if (f) { seen.add(country); flags.push(f); }
    };
    (pin.countries || []).forEach(add);
    add(pin.normalizedCountry);
    if (pin.placeName) {
      const parsed = countryFlagFromPlace(pin.placeName);
      if (parsed) add(parsed.country);
    }
    (pin.locations || []).forEach(loc => {
      if (loc.normalizedCountry) {
        add(loc.normalizedCountry);
      } else if (loc.placeName) {
        const parsed = countryFlagFromPlace(loc.placeName);
        if (parsed) add(parsed.country);
      }
    });
    return flags;
  })();

  const cardRef = useRef(null);
  useEffect(() => {
    if (keyboardFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [keyboardFocused]);

  const [showFriendTooltip, setShowFriendTooltip] = useState(false);

  // Must be computed before allFriendIcons/tooltipText below
  const effectiveAnnotationDetail = annotationDetail || buildAnnotationDetail(annotation);

  // Combine been + dreaming icons, max 3 total (been first)
  const allFriendIcons = effectiveAnnotationDetail ? [
    ...(effectiveAnnotationDetail.been || []).slice(0, 3).map(f => ({ ...f, iconType: 'been' })),
    ...(effectiveAnnotationDetail.dreaming || []).slice(0, 3).map(f => ({ ...f, iconType: 'dreaming' })),
  ].slice(0, 3) : [];

  const tooltipText = allFriendIcons.length > 0
    ? buildTooltipText(
        (effectiveAnnotationDetail?.been || []).slice(0, 3),
        (effectiveAnnotationDetail?.dreaming || []).slice(0, 3)
      )
    : null;

  const friendIconsGroup = allFriendIcons.length > 0 ? (
    <div
      className="pin-card-friend-icons"
      onMouseEnter={() => setShowFriendTooltip(true)}
      onMouseLeave={() => setShowFriendTooltip(false)}
    >
      {allFriendIcons.map((f, i) => {
        const name = f.displayName || f.display_name || '?';
        return (
          <div key={i} className={`pin-card-friend-icon pin-card-friend-icon-${f.iconType}`}>
            {f.avatarUrl || f.avatar_url
              ? <img src={f.avatarUrl || f.avatar_url} alt="" />
              : <span>{name.charAt(0)}</span>
            }
          </div>
        );
      })}
    </div>
  ) : null;

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

  return (
    <div
      ref={cardRef}
      className={`pin-card ${isMemory ? 'pin-card-memory' : 'pin-card-dream'}${keyboardFocused ? ' pin-card-keyboard-focus' : ''}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      role="button"
      tabIndex={0}
    >
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

      {image ? (
        <div className="pin-card-image" style={{ backgroundImage: `url(${image})` }}>
          <div className="pin-card-overlay">
            <div className="pin-card-meta pin-card-meta-top">
              <h3 className="pin-card-place">{rank != null && rank <= 8 ? `#${rank} ` : ''}{pin.placeName}</h3>
            </div>
            {(pin.tags?.length > 0 || allFriendIcons.length > 0) && (
              <div className="pin-card-meta pin-card-meta-bottom">
                {friendIconsGroup}
                {pin.tags && pin.tags.length > 0 && (
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
                )}
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
          {(pin.tags?.length > 0 || allFriendIcons.length > 0) && (
            <div className="pin-card-meta pin-card-meta-gradient pin-card-meta-bottom">
              {friendIconsGroup}
              {pin.tags && pin.tags.length > 0 && (
                <div className="pin-card-tags">
                  {pin.tags.map((tag, i) => (
                    <span key={tag.id || i} className="pin-tag-chip">
                      {tag.emoji ? `${tag.emoji} ` : ''}{tag.shortName || tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* Combined friend tooltip — rendered at card root, centered horizontally
          so it won't clip at card edges; card overflow:visible lets it bleed over */}
      {showFriendTooltip && tooltipText && (
        <div className="pin-card-friend-tooltip">{tooltipText}</div>
      )}

      {showInspireButton && isDream && (
        <button className="pin-inspire-btn" onClick={handleInspireClick}>
          {'✨'} I&apos;m interested too!
        </button>
      )}
    </div>
  );
}
