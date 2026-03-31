// PinBoard component - masonry/CSS grid layout of PinCard components.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-NAV-002, REQ-PROFILE-001, REQ-MEMORY-004, REQ-DREAM-004,
//             REQ-SOCIAL-003, REQ-DREAM-005

import { useState, useEffect, useRef } from 'react';
import PinCard from './PinCard';

/**
 * PinBoard renders a draggable grid of pins.
 *
 * When total pins ≤ 8: one flat draggable grid, no "Top 8" concept shown.
 * When total pins > 8: Top 8 section (draggable, "..." to remove) +
 *   "See all" expand section (remaining pins, "..." to add to Top 8).
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
 * @param {function} [props.onReorder] - Called with new ordered top pin ID array after drag
 * @param {function} [props.onTop8Add] - Called with pinId to add to Top 8
 * @param {function} [props.onTop8Remove] - Called with pinId to remove from Top 8
 */
export default function PinBoard({
  pins, topPins, tab, isOwnBoard, onAddPin, onPinPress, annotations,
  showInspireButton, onInspire, showIWentButton, onIWent,
  onReorder, onTop8Add, onTop8Remove,
}) {
  const [expanded, setExpanded] = useState(false);

  // Local ordered list of top pin IDs — drives drag state
  const [localTopIds, setLocalTopIds] = useState([]);
  const dragIdRef = useRef(null);
  const dragOverIdRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Sync localTopIds from props whenever topPins changes (and not mid-drag)
  useEffect(() => {
    if (dragIdRef.current) return; // don't reset during drag
    const ordered = (topPins || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(tp => tp.pin?.id || tp.pinId)
      .filter(Boolean);
    setLocalTopIds(ordered);
  }, [topPins]);

  const pinMap = {};
  (pins || []).forEach(p => { pinMap[p.id] = p; });

  const topPinIds = new Set(localTopIds);
  const orderedTopPins = localTopIds.map(id => pinMap[id]).filter(Boolean);
  const remainingPins = (pins || []).filter(p => !topPinIds.has(p.id));
  const totalCount = (pins || []).length;

  const isMemory = tab === 'memory';
  const tabLabel = isMemory ? 'memories' : 'dreams';
  const showTop8Concept = totalCount > 8;

  // ── Drag handlers (top section only) ──
  function handleDragStart(e, pinId) {
    dragIdRef.current = pinId;
    setDragId(pinId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, pinId) {
    e.preventDefault();
    if (dragIdRef.current && dragIdRef.current !== pinId) {
      dragOverIdRef.current = pinId;
      setDragOverId(pinId);
    }
  }

  function handleDragLeave() {
    dragOverIdRef.current = null;
    setDragOverId(null);
  }

  function handleDrop(e, targetId) {
    e.preventDefault();
    const fromId = dragIdRef.current;
    if (!fromId || fromId === targetId) return;
    setLocalTopIds(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromId);
      const toIdx = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      if (onReorder) setTimeout(() => onReorder(next), 0);
      return next;
    });
    dragIdRef.current = null;
    dragOverIdRef.current = null;
    setDragId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    dragIdRef.current = null;
    dragOverIdRef.current = null;
    setDragId(null);
    setDragOverId(null);
  }

  // Empty state
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
            textAlign: 'center',
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

  function renderPinCard(pin, inTop8) {
    return (
      <PinCard
        key={pin.id}
        pin={pin}
        isTop8={inTop8}
        onPress={onPinPress}
        annotation={annotations?.[pin.id]}
        showInspireButton={showInspireButton && pin.pinType === 'dream'}
        onInspire={onInspire}
        showIWentButton={showIWentButton && pin.pinType === 'dream'}
        onIWent={onIWent}
        // Top8 menu only when own board and top-8 concept is active (>8 pins)
        showTop8Menu={isOwnBoard && showTop8Concept}
        isInTop8={inTop8}
        onTop8Add={onTop8Add}
        onTop8Remove={onTop8Remove}
      />
    );
  }

  // ── ≤8 pins: flat draggable grid, no "Top 8" heading ──
  if (!showTop8Concept) {
    // For ≤8 we use localTopIds if populated (they've been reordered before),
    // otherwise fall back to the natural pin order
    const displayPins = localTopIds.length > 0
      ? localTopIds.map(id => pinMap[id]).filter(Boolean)
      : (pins || []);

    return (
      <div className="pin-board">
        <div className="pin-board-section">
          <div className="pin-grid">
            {displayPins.map(pin => (
              <div
                key={pin.id}
                className={`pin-grid-item${dragId === pin.id ? ' pin-grid-item-dragging' : ''}${dragOverId === pin.id && dragId !== pin.id ? ' pin-grid-item-dragover' : ''}`}
                draggable={isOwnBoard}
                onDragStart={isOwnBoard ? (e) => handleDragStart(e, pin.id) : undefined}
                onDragOver={isOwnBoard ? (e) => handleDragOver(e, pin.id) : undefined}
                onDragLeave={isOwnBoard ? handleDragLeave : undefined}
                onDrop={isOwnBoard ? (e) => handleDrop(e, pin.id) : undefined}
                onDragEnd={isOwnBoard ? handleDragEnd : undefined}
              >
                {renderPinCard(pin, false)}
              </div>
            ))}

            {/* Add tile when no pins have been organized into Top 8 yet */}
            {isOwnBoard && (
              <button className="pin-add-tile" onClick={onAddPin}>
                <span className="pin-add-tile-icon">+</span>
                <span className="pin-add-tile-label">
                  {isMemory ? 'Add a memory' : 'Add a dream'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── >8 pins: Top 8 section + expandable remainder ──
  return (
    <div className="pin-board">
      {/* Top 8 section — draggable */}
      <div className="pin-board-section">
        <h3 className="pin-board-section-title">Top 8</h3>
        <div className="pin-grid">
          {orderedTopPins.map(pin => (
            <div
              key={pin.id}
              className={`pin-grid-item${dragId === pin.id ? ' pin-grid-item-dragging' : ''}${dragOverId === pin.id && dragId !== pin.id ? ' pin-grid-item-dragover' : ''}`}
              draggable={isOwnBoard}
              onDragStart={isOwnBoard ? (e) => handleDragStart(e, pin.id) : undefined}
              onDragOver={isOwnBoard ? (e) => handleDragOver(e, pin.id) : undefined}
              onDragLeave={isOwnBoard ? handleDragLeave : undefined}
              onDrop={isOwnBoard ? (e) => handleDrop(e, pin.id) : undefined}
              onDragEnd={isOwnBoard ? handleDragEnd : undefined}
            >
              {renderPinCard(pin, true)}
            </div>
          ))}
        </div>
      </div>

      {/* Remaining pins */}
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
                {remainingPins.map(pin => (
                  <div key={pin.id} className="pin-grid-item">
                    {renderPinCard(pin, false)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
