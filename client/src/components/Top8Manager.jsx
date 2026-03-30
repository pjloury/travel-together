// Top8Manager component - edit mode panel for managing Top 8 pins.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-PROFILE-001, SCN-PROFILE-001-01

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';

const MAX_TOP8 = 8;

/**
 * Top8Manager is an edit mode panel for selecting and ordering Top 8 pins.
 *
 * @implements REQ-PROFILE-001 (Top 8 per tab, server-persisted, cap enforced)
 * @implements SCN-PROFILE-001-01 (drag-reorder via HTML5 drag-and-drop + touch support, cap enforced)
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the panel is open
 * @param {function} props.onClose - Close the panel
 * @param {Array} props.memoryPins - All user's memory pins
 * @param {Array} props.dreamPins - All user's dream pins
 * @param {Array} props.memoryTop - Current memory Top 8 (sorted by sortOrder)
 * @param {Array} props.dreamTop - Current dream Top 8 (sorted by sortOrder)
 * @param {function} props.onSaved - Callback after save
 */
export default function Top8Manager({ isOpen, onClose, memoryPins, dreamPins, memoryTop, dreamTop, onSaved }) {
  const [tab, setTab] = useState('memory');
  const [selectedMemoryIds, setSelectedMemoryIds] = useState([]);
  const [selectedDreamIds, setSelectedDreamIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [capWarning, setCapWarning] = useState('');

  // Drag-and-drop state (HTML5)
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Touch drag state
  const touchStartRef = useRef(null);
  const touchItemRef = useRef(null);
  const itemRefsRef = useRef([]);

  useEffect(() => {
    if (isOpen) {
      // Initialize from current Top 8
      setSelectedMemoryIds((memoryTop || []).sort((a, b) => a.sortOrder - b.sortOrder).map(tp => tp.pin?.id).filter(Boolean));
      setSelectedDreamIds((dreamTop || []).sort((a, b) => a.sortOrder - b.sortOrder).map(tp => tp.pin?.id).filter(Boolean));
      setError('');
      setCapWarning('');
      setDragIndex(null);
      setDragOverIndex(null);
    }
  }, [isOpen, memoryTop, dreamTop]);

  const pins = tab === 'memory' ? (memoryPins || []) : (dreamPins || []);
  const selectedIds = tab === 'memory' ? selectedMemoryIds : selectedDreamIds;
  const setSelectedIds = tab === 'memory' ? setSelectedMemoryIds : setSelectedDreamIds;

  function togglePin(pinId) {
    setCapWarning('');
    if (selectedIds.includes(pinId)) {
      setSelectedIds(selectedIds.filter(id => id !== pinId));
    } else {
      if (selectedIds.length >= MAX_TOP8) {
        setCapWarning('Remove one first');
        return;
      }
      setSelectedIds([...selectedIds, pinId]);
    }
  }

  // HTML5 Drag-and-drop handlers
  // @implements SCN-PROFILE-001-01 (drag-reorder)
  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDragLeave() {
    setDragOverIndex(null);
  }

  function handleDrop(index) {
    if (dragIndex !== null && dragIndex !== index) {
      const newIds = [...selectedIds];
      const [removed] = newIds.splice(dragIndex, 1);
      newIds.splice(index, 0, removed);
      setSelectedIds(newIds);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // Touch drag handlers for mobile
  // @implements SCN-PROFILE-001-01 (touch support: swap on touch move past halfway point)
  const handleTouchStart = useCallback((e, index) => {
    const touch = e.touches[0];
    touchStartRef.current = { y: touch.clientY, index };
    touchItemRef.current = index;
    setDragIndex(index);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (touchStartRef.current === null) return;
    const touch = e.touches[0];
    const currentY = touch.clientY;

    // Find which item we're over based on position
    const refs = itemRefsRef.current;
    for (let i = 0; i < refs.length; i++) {
      if (!refs[i]) continue;
      const rect = refs[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (currentY >= rect.top && currentY <= rect.bottom) {
        if (i !== touchItemRef.current) {
          // Swap when touch passes halfway point of adjacent item
          const fromIndex = touchItemRef.current;
          setSelectedIds(prev => {
            const newIds = [...prev];
            const [removed] = newIds.splice(fromIndex, 1);
            newIds.splice(i, 0, removed);
            return newIds;
          });
          touchItemRef.current = i;
          setDragOverIndex(i);
        }
        break;
      }
    }
  }, [setSelectedIds]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    touchItemRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      // Save both tabs
      await api.put('/pins/top', { tab: 'memory', pinIds: selectedMemoryIds });
      await api.put('/pins/top', { tab: 'dream', pinIds: selectedDreamIds });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  // Build pin lookup
  const allPins = [...(memoryPins || []), ...(dreamPins || [])];
  const pinMap = {};
  allPins.forEach(p => { pinMap[p.id] = p; });

  const selectedPinObjects = selectedIds.map(id => pinMap[id]).filter(Boolean);
  const unselectedPins = pins.filter(p => !selectedIds.includes(p.id));

  return (
    <div className="top8-modal">
      <div className="top8-content">
        <button className="top8-close" onClick={onClose}>&times;</button>
        <h2 className="top8-title">Edit Top 8</h2>

        {/* Tab switcher inside Top8Manager */}
        <div className="top8-tab-switcher">
          <button
            className={`top8-tab ${tab === 'memory' ? 'top8-tab-active' : ''}`}
            onClick={() => { setTab('memory'); setCapWarning(''); }}
          >
            PAST
          </button>
          <button
            className={`top8-tab ${tab === 'dream' ? 'top8-tab-active' : ''}`}
            onClick={() => { setTab('dream'); setCapWarning(''); }}
          >
            FUTURE
          </button>
        </div>

        {/* Currently selected Top 8 with drag-and-drop */}
        <div className="top8-selected">
          <h3>Selected ({selectedIds.length}/{MAX_TOP8})</h3>
          {capWarning && <p className="top8-cap-warning">{capWarning}</p>}
          {selectedPinObjects.length === 0 && (
            <p className="top8-empty-hint">Tap pins below to add to your Top 8</p>
          )}
          {selectedPinObjects.map((pin, index) => (
            <div
              key={pin.id}
              ref={el => { itemRefsRef.current[index] = el; }}
              className={`top8-item top8-item-selected${dragOverIndex === index && dragIndex !== index ? ' top8-drop-target' : ''}`}
              draggable={true}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              onTouchStart={(e) => handleTouchStart(e, index)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={dragIndex === index ? { opacity: 0.4 } : undefined}
            >
              <span className="top8-item-drag-handle">{'\u2630'}</span>
              <span className="top8-item-order">{index + 1}</span>
              <span className="top8-item-name">{pin.placeName}</span>
              <div className="top8-item-actions">
                <button className="top8-remove-btn" onClick={() => togglePin(pin.id)}>
                  {'\u2715'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* All pins to choose from */}
        <div className="top8-all-pins">
          <h3>All {tab === 'memory' ? 'memories' : 'dreams'}</h3>
          <div className="top8-pin-list">
            {unselectedPins.map(pin => (
              <div
                key={pin.id}
                className="top8-item top8-item-available"
                onClick={() => togglePin(pin.id)}
              >
                <span className="top8-item-star">{'\u2606'}</span>
                <span className="top8-item-name">{pin.placeName}</span>
                {pin.tags && pin.tags.length > 0 && (
                  <span className="top8-item-tag">{pin.tags[0].emoji}</span>
                )}
              </div>
            ))}
            {unselectedPins.length === 0 && pins.length > 0 && (
              <p className="top8-all-selected">All pins are in your Top 8!</p>
            )}
            {pins.length === 0 && (
              <p className="top8-no-pins">No {tab === 'memory' ? 'memories' : 'dreams'} yet</p>
            )}
          </div>
        </div>

        {error && <p className="top8-error">{error}</p>}

        <button
          className="top8-save-btn"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Order'}
        </button>
      </div>
    </div>
  );
}
