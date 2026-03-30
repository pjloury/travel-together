// PinBoard component - masonry/CSS grid layout of PinCard components.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-002, REQ-PROFILE-001, REQ-MEMORY-004, REQ-DREAM-004,
//             REQ-SOCIAL-003, REQ-DREAM-005

import { useState } from 'react';
import PinCard from './PinCard';

/**
 * PinBoard renders a masonry grid of pins with Top 8 section and expandable "See all".
 *
 * @implements REQ-NAV-002 (Top 8 above fold; All view below)
 * @implements REQ-PROFILE-001 (Top 8 per tab)
 * @implements REQ-MEMORY-004 (user browses memories in visual grid)
 * @implements REQ-DREAM-004 (user browses/filters dream pins)
 * @implements REQ-SOCIAL-003 (passes inspire button props to PinCard)
 * @implements REQ-DREAM-005 (passes I went button props to PinCard)
 *
 * @param {Object} props
 * @param {Array} props.pins - All pins for this tab
 * @param {Array} props.topPins - Ordered Top 8 pins (with sortOrder)
 * @param {'memory'|'dream'} props.tab - Current tab
 * @param {boolean} props.isOwnBoard - Whether this is the user's own board
 * @param {function} props.onAddPin - Callback for add pin CTA
 * @param {function} props.onPinPress - Callback when a pin is pressed
 * @param {Object} [props.annotations] - Map of pinId -> annotation data
 * @param {boolean} [props.showInspireButton] - Pass to PinCards for friend dream pins
 * @param {function} [props.onInspire] - Callback for inspire action
 * @param {boolean} [props.showIWentButton] - Pass to PinCards for own dream pins
 * @param {function} [props.onIWent] - Callback for I went action
 */
export default function PinBoard({ pins, topPins, tab, isOwnBoard, onAddPin, onPinPress, annotations, showInspireButton, onInspire, showIWentButton, onIWent }) {
  const [expanded, setExpanded] = useState(false);

  const topPinIds = new Set((topPins || []).map(tp => tp.pin?.id || tp.pinId));
  const orderedTopPins = (topPins || [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(tp => tp.pin)
    .filter(Boolean);

  const remainingPins = (pins || []).filter(p => !topPinIds.has(p.id));
  const totalCount = (pins || []).length;

  const isMemory = tab === 'memory';
  const tabLabel = isMemory ? 'memories' : 'dreams';

  // Empty state per QG-VISUAL-003, SC-SOLO-002
  if (totalCount === 0) {
    return (
      <div className="pin-board-empty">
        <div className="empty-state-card">
          <div className="empty-state-illustration" style={{
            background: isMemory
              ? 'linear-gradient(135deg, #8B4513, #D2691E)'
              : 'linear-gradient(135deg, #0E4D6E, #1A8FBF)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center'
          }}>
            <span className="empty-state-emoji">{isMemory ? '\uD83C\uDF0D' : '\u2728'}</span>
          </div>
          <p className="empty-state-prompt">
            {isMemory
              ? 'Where have you been? Add your first memory.'
              : 'Where do you dream of going? Pin your first dream.'}
          </p>
          {isOwnBoard && (
            <button className="empty-state-cta" onClick={onAddPin}>
              {isMemory ? 'Add a memory' : 'Add a dream'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // If fewer than 8 pins, show all in Top 8 section
  const displayTopPins = orderedTopPins.length > 0 ? orderedTopPins : pins.slice(0, 8);

  function renderPinCard(pin, isTop8Pin) {
    return (
      <PinCard
        key={pin.id}
        pin={pin}
        isTop8={isTop8Pin}
        onPress={onPinPress}
        annotation={annotations?.[pin.id]}
        showInspireButton={showInspireButton && pin.pinType === 'dream'}
        onInspire={onInspire}
        showIWentButton={showIWentButton && pin.pinType === 'dream'}
        onIWent={onIWent}
      />
    );
  }

  // Show an "add" tile in the grid when no Top 8 is curated yet (own board only)
  const showAddTile = isOwnBoard && orderedTopPins.length === 0;

  return (
    <div className="pin-board">
      {/* Top 8 section */}
      <div className="pin-board-section">
        <h3 className="pin-board-section-title">
          {orderedTopPins.length > 0 ? 'Top 8' : `Your ${tabLabel}`}
        </h3>
        <div className="pin-grid">
          {displayTopPins.map((pin) => renderPinCard(pin, topPinIds.has(pin.id)))}

          {showAddTile && (
            <button className="pin-add-tile" onClick={onAddPin}>
              <span className="pin-add-tile-icon">+</span>
              <span className="pin-add-tile-label">
                {isMemory ? 'Add a memory' : 'Add a dream'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Expand section: remaining pins beyond Top 8 */}
      {remainingPins.length > 0 && (
        <div className="pin-board-expand-section">
          {!expanded ? (
            <button
              className="pin-board-expand-btn"
              onClick={() => setExpanded(true)}
            >
              See all {totalCount} {tabLabel} &rarr;
            </button>
          ) : (
            <div className="pin-board-section">
              <h3 className="pin-board-section-title">All {tabLabel}</h3>
              <div className="pin-grid">
                {remainingPins.map((pin) => renderPinCard(pin, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
