// MemoryDetail — right-side panel for viewing and editing a memory.

import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';

/**
 * Parse an aiSummary string into bullet items, or return null for plain text.
 */
function parseSummary(aiSummary) {
  if (!aiSummary) return null;
  const lines = aiSummary.split('\n').map(l => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(l => l.startsWith('\u2022') || l.startsWith('-') || l.startsWith('*'));
  if (bulletLines.length >= 2) {
    return bulletLines.map(l => l.replace(/^[\u2022\-*]\s*/, ''));
  }
  return null;
}

export default function MemoryDetail({ pin, isOpen, onClose, onUpdated }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [addition, setAddition] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef(null);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editRating, setEditRating] = useState(0);
  const [editYear, setEditYear] = useState('');
  const [editCompanions, setEditCompanions] = useState([]);
  const [editTags, setEditTags] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Companion search state
  const [companionSearch, setCompanionSearch] = useState('');
  const [companionResults, setCompanionResults] = useState([]);
  const [companionSearching, setCompanionSearching] = useState(false);
  const [showCompanionSearch, setShowCompanionSearch] = useState(false);
  const searchDebounceRef = useRef(null);

  // Reset internal state each time a new pin opens
  useEffect(() => {
    if (isOpen) {
      setShowTranscript(false);
      setAddition('');
      setSaving(false);
      setSaveError('');
      setSaved(false);
      setEditing(false);
      setEditError('');
      setShowTagPicker(false);
      setShowCompanionSearch(false);
      setCompanionSearch('');
      setCompanionResults([]);
    }
  }, [isOpen, pin?.id]);

  // Seed edit fields from pin
  useEffect(() => {
    if (pin) {
      setEditRating(pin.rating || 0);
      setEditYear(pin.visitYear ? String(pin.visitYear) : '');
      setEditCompanions(pin.companions || []);
      setEditTags(pin.tags ? pin.tags.map(t => t.name || t) : []);
    }
  }, [pin]);

  // Debounced user search for companion
  useEffect(() => {
    if (!companionSearch.trim()) {
      setCompanionResults([]);
      return;
    }
    clearTimeout(searchDebounceRef.current);
    setCompanionSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(companionSearch.trim())}`);
        setCompanionResults(res.data || []);
      } catch {
        setCompanionResults([]);
      } finally {
        setCompanionSearching(false);
      }
    }, 350);
  }, [companionSearch]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === 'Escape') { if (editing) setEditing(false); else onClose(); } }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, editing]);

  if (!pin) return null;

  const summaryBullets = parseSummary(pin.aiSummary);
  const hearts = pin.rating ? Array.from({ length: pin.rating }, () => '♥').join('') : null;

  // ---- Add note ----
  async function handleSaveAddition() {
    if (!addition.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const existing = pin.note || '';
      const updated = existing ? existing + '\n\n' + addition.trim() : addition.trim();
      await api.put(`/pins/${pin.id}`, { note: updated });
      setSaved(true);
      setAddition('');
      setTimeout(() => setSaved(false), 2000);
      if (onUpdated) onUpdated();
    } catch (err) {
      setSaveError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ---- Save edits ----
  async function handleSaveEdits() {
    setEditSaving(true);
    setEditError('');
    try {
      const tagPayload = tagNamesToPayload(editTags);
      await api.put(`/pins/${pin.id}`, {
        rating: editRating || null,
        visitYear: editYear ? parseInt(editYear, 10) : null,
        companions: editCompanions,
        tags: tagPayload,
      });
      setEditing(false);
      setShowTagPicker(false);
      setShowCompanionSearch(false);
      setCompanionSearch('');
      if (onUpdated) onUpdated();
    } catch (err) {
      setEditError(err.message || 'Could not save changes.');
    } finally {
      setEditSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditRating(pin.rating || 0);
    setEditYear(pin.visitYear ? String(pin.visitYear) : '');
    setEditCompanions(pin.companions || []);
    setEditTags(pin.tags ? pin.tags.map(t => t.name || t) : []);
    setShowTagPicker(false);
    setShowCompanionSearch(false);
    setCompanionSearch('');
    setEditError('');
  }

  // Companion helpers
  function isPresetActive(label) { return editCompanions.includes(label); }
  function togglePreset(label) {
    setEditCompanions(prev =>
      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
    );
  }
  function removeCompanion(name) {
    setEditCompanions(prev => prev.filter(x => x !== name));
  }
  function addUserCompanion(user) {
    const label = user.display_name || user.username;
    if (!editCompanions.includes(label)) {
      setEditCompanions(prev => [...prev, label]);
    }
    setCompanionSearch('');
    setCompanionResults([]);
    setShowCompanionSearch(false);
  }

  const noCompanionResults = companionSearch.trim().length > 1 && !companionSearching && companionResults.length === 0;

  return (
    <>
      <style>{`
        /* Edit mode styles */
        .md-edit-toggle {
          background: none;
          border: 1px solid rgba(250,250,250,0.2);
          color: rgba(250,250,250,0.6);
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.18s;
          letter-spacing: 0.04em;
        }
        .md-edit-toggle:hover {
          border-color: rgba(250,250,250,0.45);
          color: rgba(250,250,250,0.9);
        }
        .md-edit-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(250,250,250,0.35);
          margin-bottom: 8px;
          font-weight: 500;
        }
        .md-edit-section {
          border-top: 1px solid rgba(250,250,250,0.08);
          padding-top: 16px;
          margin-top: 16px;
        }
        /* Editable rating */
        .md-edit-hearts {
          display: flex;
          gap: 4px;
        }
        .md-edit-heart-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 20px;
          padding: 2px;
          opacity: 0.4;
          transition: opacity 0.15s, transform 0.15s;
        }
        .md-edit-heart-btn.filled { opacity: 1; }
        .md-edit-heart-btn:hover { transform: scale(1.15); opacity: 1; }
        /* Editable year */
        .md-edit-year-input {
          background: rgba(250,250,250,0.08);
          border: 1px solid rgba(250,250,250,0.2);
          border-radius: 6px;
          color: rgba(250,250,250,0.9);
          padding: 7px 10px;
          font-size: 14px;
          width: 100px;
          outline: none;
        }
        .md-edit-year-input:focus { border-color: rgba(201,168,76,0.5); }
        /* Companions in edit mode */
        .md-edit-preset-row { display: flex; gap: 8px; margin-bottom: 10px; }
        .md-edit-preset-btn {
          flex: 1;
          padding: 8px 0;
          border-radius: 8px;
          border: 1.5px solid rgba(250,250,250,0.2);
          background: rgba(250,250,250,0.06);
          color: rgba(250,250,250,0.65);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.18s;
        }
        .md-edit-preset-btn.active {
          background: var(--gold);
          color: var(--black);
          border-color: var(--gold);
          font-weight: 700;
        }
        .md-edit-companion-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .md-edit-companion-chip {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 8px 4px 10px;
          border-radius: 16px;
          background: rgba(201,168,76,0.12);
          border: 1px solid rgba(201,168,76,0.35);
          color: var(--gold);
          font-size: 13px;
        }
        .md-edit-chip-remove {
          background: none; border: none; cursor: pointer;
          color: inherit; opacity: 0.6; padding: 0; font-size: 14px;
        }
        .md-edit-chip-remove:hover { opacity: 1; }
        .md-edit-search-wrap { position: relative; }
        .md-edit-search-input {
          width: 100%;
          background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18);
          border-radius: 8px;
          color: rgba(250,250,250,0.9);
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
        }
        .md-edit-search-input:focus { border-color: rgba(201,168,76,0.4); }
        .md-edit-search-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-edit-search-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #1c1c1c; border: 1px solid rgba(250,250,250,0.12);
          border-radius: 8px; overflow: hidden; z-index: 200;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .md-edit-search-result {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; cursor: pointer; transition: background 0.12s;
        }
        .md-edit-search-result:hover { background: rgba(250,250,250,0.07); }
        .md-edit-result-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(201,168,76,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; overflow: hidden; flex-shrink: 0;
        }
        .md-edit-result-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .md-edit-no-results { padding: 10px 12px; font-size: 12px; color: rgba(250,250,250,0.4); }
        .md-add-friend-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 7px;
          border: 1px dashed rgba(250,250,250,0.25);
          background: transparent; color: rgba(250,250,250,0.5);
          font-size: 12px; cursor: pointer; transition: all 0.18s; margin-top: 4px;
        }
        .md-add-friend-btn:hover { border-color: rgba(250,250,250,0.45); color: rgba(250,250,250,0.8); }
        /* Tags edit */
        .md-edit-tags-toggle {
          display: inline-flex; align-items: center; gap: 5px;
          background: none; border: 1px dashed rgba(250,250,250,0.25);
          color: rgba(250,250,250,0.5); font-size: 12px;
          padding: 5px 11px; border-radius: 7px; cursor: pointer;
          transition: all 0.18s; margin-top: 6px;
        }
        .md-edit-tags-toggle:hover { border-color: var(--gold); color: var(--gold); }
        /* Edit actions */
        .md-edit-actions {
          display: flex; gap: 8px; align-items: center;
          padding-top: 16px; margin-top: 4px;
          border-top: 1px solid rgba(250,250,250,0.08);
        }
        .md-edit-save-btn {
          flex: 1; padding: 10px; border-radius: 8px;
          background: var(--gold); color: var(--black);
          border: none; font-size: 13px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.04em;
        }
        .md-edit-save-btn:disabled { opacity: 0.5; cursor: default; }
        .md-edit-cancel-btn {
          padding: 10px 16px; border-radius: 8px;
          background: transparent; color: rgba(250,250,250,0.55);
          border: 1px solid rgba(250,250,250,0.18);
          font-size: 13px; cursor: pointer;
        }
        .md-edit-error { font-size: 12px; color: #ff6b6b; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`md-backdrop${isOpen ? ' md-backdrop-visible' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside className={`md-panel${isOpen ? ' md-panel-open' : ''}`}>

        {/* Header */}
        <div className="md-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'absolute', top: 12, left: 12, right: 12, zIndex: 10 }}>
            <button className="md-close" onClick={onClose} aria-label="Close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            {!editing && (
              <button className="md-edit-toggle" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>

          {/* Hero image or gradient */}
          {pin.imageUrl ? (
            <div
              className="md-hero-img"
              style={{ backgroundImage: `url(${pin.imageUrl})` }}
            />
          ) : (
            <div
              className="md-hero-gradient"
              style={{
                background: pin.gradientStart && pin.gradientEnd
                  ? `linear-gradient(135deg, ${pin.gradientStart}, ${pin.gradientEnd})`
                  : 'linear-gradient(135deg, #4a3728, #8B6914)',
              }}
            >
              <span className="md-hero-emoji">{pin.emoji || '🌍'}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="md-body">

          {/* Place + meta */}
          <div className="md-title-block">
            <h2 className="md-place">{pin.placeName}</h2>

            {/* VIEW mode meta row */}
            {!editing && (
              <div className="md-meta-row">
                {pin.visitYear && <span className="md-meta-item">{pin.visitYear}</span>}
                {hearts && <span className="md-meta-item md-hearts">{hearts}</span>}
              </div>
            )}

            {/* EDIT mode: year + rating inline */}
            {editing && (
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginTop: 10, flexWrap: 'wrap' }}>
                <div>
                  <p className="md-edit-label">Year visited</p>
                  <input
                    type="number"
                    className="md-edit-year-input"
                    value={editYear}
                    onChange={e => setEditYear(e.target.value)}
                    placeholder="e.g. 2024"
                    min="1900"
                    max="2100"
                  />
                </div>
                <div>
                  <p className="md-edit-label">Rating</p>
                  <div className="md-edit-hearts">
                    {[1,2,3,4,5].map(v => (
                      <button
                        key={v}
                        type="button"
                        className={`md-edit-heart-btn ${v <= editRating ? 'filled' : ''}`}
                        onClick={() => setEditRating(v === editRating ? 0 : v)}
                      >
                        {v <= editRating ? '❤️' : '🫶'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* VIEW companions */}
          {!editing && pin.companions && pin.companions.length > 0 && (
            <div className="md-chips-row">
              {pin.companions.map(c => (
                <span key={c} className="md-chip">{c}</span>
              ))}
            </div>
          )}

          {/* EDIT companions */}
          {editing && (
            <div className="md-edit-section">
              <p className="md-edit-label">With whom</p>

              <div className="md-edit-preset-row">
                <button
                  type="button"
                  className={`md-edit-preset-btn ${isPresetActive('Solo') ? 'active' : ''}`}
                  onClick={() => togglePreset('Solo')}
                >🧍 Solo</button>
                <button
                  type="button"
                  className={`md-edit-preset-btn ${isPresetActive('Family') ? 'active' : ''}`}
                  onClick={() => togglePreset('Family')}
                >👨‍👩‍👧 Family</button>
              </div>

              {editCompanions.filter(c => c !== 'Solo' && c !== 'Family').length > 0 && (
                <div className="md-edit-companion-chips">
                  {editCompanions.filter(c => c !== 'Solo' && c !== 'Family').map(c => (
                    <span key={c} className="md-edit-companion-chip">
                      {c}
                      <button type="button" className="md-edit-chip-remove" onClick={() => removeCompanion(c)}>×</button>
                    </span>
                  ))}
                </div>
              )}

              {showCompanionSearch ? (
                <div className="md-edit-search-wrap">
                  <input
                    autoFocus
                    type="text"
                    className="md-edit-search-input"
                    placeholder="Search by name or username…"
                    value={companionSearch}
                    onChange={e => setCompanionSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') { setShowCompanionSearch(false); setCompanionSearch(''); }
                    }}
                  />
                  {companionSearch.trim().length > 0 && (
                    <div className="md-edit-search-dropdown">
                      {companionSearching && <div className="md-edit-no-results">Searching…</div>}
                      {!companionSearching && companionResults.map(user => (
                        <div
                          key={user.id}
                          className="md-edit-search-result"
                          onClick={() => addUserCompanion(user)}
                        >
                          <div className="md-edit-result-avatar">
                            {user.avatar_url
                              ? <img src={user.avatar_url} alt={user.display_name} />
                              : (user.display_name || user.username || '?')[0].toUpperCase()
                            }
                          </div>
                          <div>
                            <div style={{ fontSize: 13, color: 'rgba(250,250,250,0.9)', fontWeight: 500 }}>
                              {user.display_name || user.username}
                            </div>
                            {user.username && (
                              <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.4)' }}>@{user.username}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {noCompanionResults && (
                        <div className="md-edit-no-results">No users found</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="md-add-friend-btn"
                  onClick={() => setShowCompanionSearch(true)}
                >
                  + Add a friend
                </button>
              )}
            </div>
          )}

          {/* VIEW tags */}
          {!editing && pin.tags && pin.tags.length > 0 && (
            <div className="md-chips-row">
              {pin.tags.map(t => (
                <span key={t.id || t.name} className="md-tag-chip">
                  {t.emoji ? `${t.emoji} ` : ''}{t.name}
                </span>
              ))}
            </div>
          )}

          {/* EDIT tags */}
          {editing && (
            <div className="md-edit-section">
              <p className="md-edit-label">Tags</p>
              {!showTagPicker ? (
                <>
                  {editTags.length > 0 && (
                    <div className="md-chips-row" style={{ marginBottom: 8 }}>
                      {editTags.map(t => (
                        <span key={t} className="md-tag-chip" style={{ position: 'relative', paddingRight: 8 }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="md-edit-tags-toggle"
                    onClick={() => setShowTagPicker(true)}
                  >
                    ✏️ Edit tags
                  </button>
                </>
              ) : (
                <>
                  <TagPicker
                    selectedTags={editTags}
                    onTagsChange={setEditTags}
                  />
                  <button
                    type="button"
                    className="md-edit-tags-toggle"
                    style={{ marginTop: 8 }}
                    onClick={() => setShowTagPicker(false)}
                  >
                    Done selecting tags
                  </button>
                </>
              )}
            </div>
          )}

          {/* Summary */}
          {pin.aiSummary && (
            <div className="md-section">
              <p className="md-section-label">Highlights</p>
              {summaryBullets ? (
                <ul className="md-bullet-list">
                  {summaryBullets.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="md-body-text">{pin.aiSummary}</p>
              )}
            </div>
          )}

          {/* Note */}
          {pin.note && (
            <div className="md-section">
              <p className="md-section-label">Notes</p>
              <p className="md-body-text md-note-text">{pin.note}</p>
            </div>
          )}

          {/* EDIT save/cancel */}
          {editing && (
            <div className="md-edit-actions">
              <button
                type="button"
                className="md-edit-cancel-btn"
                onClick={cancelEdit}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="md-edit-save-btn"
                onClick={handleSaveEdits}
                disabled={editSaving}
              >
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              {editError && <span className="md-edit-error">{editError}</span>}
            </div>
          )}

          {/* Add more (view mode only) */}
          {!editing && (
            <div className="md-section md-add-section">
              <p className="md-section-label">Add to this memory</p>
              <textarea
                ref={textareaRef}
                className="md-textarea"
                value={addition}
                onChange={e => setAddition(e.target.value)}
                placeholder="More details, a follow-up thought, something you forgot to mention…"
                rows={3}
              />
              <div className="md-add-actions">
                {saveError && <span className="md-save-error">{saveError}</span>}
                {saved && <span className="md-save-ok">Saved</span>}
                <button
                  className="md-save-btn"
                  onClick={handleSaveAddition}
                  disabled={!addition.trim() || saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}

          {/* Transcript (collapsible) */}
          {pin.transcript && (
            <div className="md-section">
              <button
                className="md-transcript-toggle"
                onClick={() => setShowTranscript(v => !v)}
              >
                {showTranscript ? 'Hide transcript' : 'Show original transcript'}
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: showTranscript ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showTranscript && (
                <p className="md-transcript-text">{pin.transcript}</p>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
