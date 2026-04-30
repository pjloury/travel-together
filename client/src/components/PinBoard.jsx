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
 * @param {function} [props.onReorder] - Called with new ordered top pin ID array after drag
 */
export default function PinBoard({
  pins, topPins, tab, isOwnBoard, onAddPin, onPinPress, annotations,
  // When false, ignore the manual Top 8 ordering and render `pins` in
  // exactly the order the parent provides. The Memories tab uses this
  // when the user picks a chronological sort so Top 8 doesn't pin
  // themselves to the top regardless of the chosen order.
  respectManualOrder = true,
  showInspireButton, onInspire,
  onReorder,
  keyboardFocusedPinId,
}) {
  const [expanded, setExpanded] = useState(false);

  // Local ordered list of top pin IDs — drives drag state
  const [localTopIds, setLocalTopIds] = useState([]);
  const dragIdRef = useRef(null);
  const dragOverIdRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // FLIP animation: track DOM elements and pre-reorder positions
  const itemRefs = useRef({});       // pinId -> DOM element
  const prevPositions = useRef({}); // pinId -> {top, left} captured before reorder

  // Sync localTopIds from props whenever topPins/pins changes (and not mid-drag)
  useEffect(() => {
    if (dragIdRef.current) return; // don't reset during drag
    const fromTop = (topPins || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(tp => tp.pin?.id || tp.pinId)
      .filter(Boolean);
    if (fromTop.length > 0) {
      // Top-pinned IDs first, then any remaining pins not yet in the ordered set
      const topSet = new Set(fromTop);
      const remaining = (pins || []).filter(p => !topSet.has(p.id)).map(p => p.id);
      setLocalTopIds([...fromTop, ...remaining]);
    } else {
      // No explicit top-pin ordering yet — use natural pin order
      setLocalTopIds((pins || []).map(p => p.id));
    }
  }, [topPins, pins]);

  // FLIP step 3+4: after React commits the new order to DOM, animate each
  // tile from its old screen position to its new one.
  useEffect(() => {
    const prev = prevPositions.current;
    if (!prev || Object.keys(prev).length === 0) return;
    prevPositions.current = {};

    // Collect elements that actually moved
    const moves = [];
    Object.entries(itemRefs.current).forEach(([id, el]) => {
      if (!el || !prev[id]) return;
      const newRect = el.getBoundingClientRect();
      const deltaX = prev[id].left - newRect.left;
      const deltaY = prev[id].top - newRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
      moves.push({ el, deltaX, deltaY, sameRow: Math.abs(deltaY) < 5 });
    });

    if (moves.length === 0) return;

    // Invert: snap elements back to where they were (no transition yet)
    moves.forEach(({ el, deltaX, deltaY, sameRow }) => {
      el.style.transition = 'none';
      if (sameRow) {
        el.style.transform = `translateX(${deltaX}px)`;
      } else {
        // Cross-row: start invisible at old position
        el.style.opacity = '0';
        el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
      }
    });

    // Play: double-rAF ensures the browser processes the 'none' transition
    // before we switch to the animating transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        moves.forEach(({ el, sameRow }) => {
          if (sameRow) {
            el.style.transition = 'transform 0.28s ease';
            el.style.transform = 'translateX(0)';
          } else {
            el.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
            el.style.opacity = '1';
            el.style.transform = 'translate(0, 0)';
          }
          el.addEventListener('transitionend', () => {
            el.style.transition = '';
            el.style.transform = '';
            el.style.opacity = '';
          }, { once: true });
        });
      });
    });
  }, [localTopIds]);

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

    // FLIP step 1+2: snapshot positions BEFORE React updates the DOM
    const snapshot = {};
    Object.entries(itemRefs.current).forEach(([id, el]) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        snapshot[id] = { top: rect.top, left: rect.left };
      }
    });
    prevPositions.current = snapshot;

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

  function renderPinCard(pin, inTop8, rank) {
    return (
      <PinCard
        key={pin.id}
        pin={pin}
        isTop8={inTop8}
        rank={rank}
        onPress={onPinPress}
        annotation={annotations?.[pin.id]}
        showInspireButton={showInspireButton && pin.pinType === 'dream'}
        onInspire={onInspire}
        keyboardFocused={keyboardFocusedPinId === pin.id}
      />
    );
  }

  // Helper: build drag props for a grid item
  function dragProps(pinId) {
    if (!isOwnBoard) return {};
    return {
      draggable: true,
      onDragStart: (e) => handleDragStart(e, pinId),
      onDragOver:  (e) => handleDragOver(e, pinId),
      onDragLeave: handleDragLeave,
      onDrop:      (e) => handleDrop(e, pinId),
      onDragEnd:   handleDragEnd,
    };
  }

  // ── ≤8 pins: flat draggable grid, no "Top 8" heading ──
  if (!showTop8Concept) {
    // If the parent picked a non-default sort (e.g. chronological), use
    // the pins prop order verbatim. Otherwise use the user's saved
    // manual order from localTopIds.
    const displayPins = (respectManualOrder && localTopIds.length > 0)
      ? localTopIds.map(id => pinMap[id]).filter(Boolean)
      : (pins || []);

    return (
      <div className="pin-board">
        <div className="pin-board-section">
          <div className="pin-grid">
            {displayPins.map((pin, idx) => (
              <div
                key={pin.id}
                ref={el => { itemRefs.current[pin.id] = el; }}
                className={[
                  'pin-grid-item',
                  dragId === pin.id ? 'pin-grid-item-dragging' : '',
                  dragOverId === pin.id && dragId !== pin.id ? 'pin-grid-item-dragover' : '',
                ].filter(Boolean).join(' ')}
                {...dragProps(pin.id)}
              >
                {renderPinCard(pin, false, idx + 1)}
              </div>
            ))}

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

  // ── >8 pins: when the parent sort is non-default (chronological,
  // etc.), render a single flat sorted grid — no Top 8 split. The
  // user explicitly asked for date order; pinning the top 8 to the
  // top would defeat that. ──
  if (!respectManualOrder) {
    return (
      <div className="pin-board">
        <div className="pin-board-section">
          <div className="pin-grid">
            {(pins || []).map((pin, idx) => (
              <div key={pin.id} className="pin-grid-item">
                {renderPinCard(pin, false, idx + 1)}
              </div>
            ))}
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

  // ── >8 pins, manual rank order: Top 8 section + expandable remainder ──
  return (
    <div className="pin-board">
      {/* Top 8 section — draggable */}
      <div className="pin-board-section">
        <h3 className="pin-board-section-title">Top 8</h3>
        <div className="pin-grid">
          {orderedTopPins.map((pin, idx) => (
            <div
              key={pin.id}
              ref={el => { itemRefs.current[pin.id] = el; }}
              className={[
                'pin-grid-item',
                dragId === pin.id ? 'pin-grid-item-dragging' : '',
                dragOverId === pin.id && dragId !== pin.id ? 'pin-grid-item-dragover' : '',
              ].filter(Boolean).join(' ')}
              {...dragProps(pin.id)}
            >
              {renderPinCard(pin, true, idx + 1)}
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
