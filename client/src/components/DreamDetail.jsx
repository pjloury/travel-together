// DreamDetail — right-side slide-in panel for viewing a dream pin.

import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

/**
 * Parse bullet lines from a dreamNote string.
 * Returns array of strings if "- item" format, otherwise null.
 */
function parseBullets(text) {
  if (!text) return null;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const bullets = lines.filter(l => l.startsWith('-') || l.startsWith('•') || l.startsWith('*'));
  if (bullets.length >= 1) {
    return bullets.map(l => l.replace(/^[-•*]\s*/, ''));
  }
  return null;
}

export default function DreamDetail({ pin, isOpen, onClose, onUpdated: _onUpdated, onPinChanged, onIWent, rank, noBackdrop, readOnly }) {
  const [addition, setAddition] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(pin?.placeName || '');
  const titleInputRef = useRef(null);

  // Inline note editing
  const [editingNote, setEditingNote] = useState(false);
  const [editNoteText, setEditNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaveError, setNoteSaveError] = useState('');

  // Optimistic local image + AI regen
  const [localImageUrl, setLocalImageUrl] = useState(null);
  const [generatingPhoto, setGeneratingPhoto] = useState(false);

  // AI suggestions
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);

  // Reset each time a new pin opens
  useEffect(() => {
    if (isOpen) {
      setAddition('');
      setSaving(false);
      setSaveError('');
      setSaved(false);
      setLocalImageUrl(pin?.unsplashImageUrl || pin?.photoUrl || null);
      setGeneratingPhoto(false);
      setSuggestions([]);
      setSuggestionsLoaded(false);
      setTitleText(pin?.placeName || '');
      setEditingTitle(false);
      setEditNoteText(pin?.dreamNote || pin?.aiSummary || '');
      setEditingNote(false);
      setNoteSaveError('');
    }
  }, [isOpen, pin?.id]);

  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [photoQuery, setPhotoQuery] = useState('');

  async function handleUnsplashPhoto(customQuery) {
    if (readOnly || generatingPhoto || !pin) return;
    setPhotoPromptOpen(false);
    setPhotoQuery('');
    setGeneratingPhoto(true);
    try {
      const body = customQuery ? { query: customQuery } : {};
      const res = await api.post(`/pins/${pin.id}/unsplash-photo`, body);
      const data = res.data || res;
      const newUrl = data.unsplashImageUrl;
      if (newUrl) {
        setLocalImageUrl(newUrl);
        if (onPinChanged) onPinChanged(pin.id, {
          unsplashImageUrl: newUrl,
          unsplashAttribution: data.unsplashAttribution,
          photoUrl: null,
          photoSource: 'unsplash',
        });
      }
    } catch { /* silent */ } finally {
      setGeneratingPhoto(false);
    }
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!pin) return null;

  const noteBullets = parseBullets(pin.dreamNote || pin.aiSummary);

  async function handleLoadSuggestions() {
    if (loadingSuggestions || suggestionsLoaded || !pin) return;
    setLoadingSuggestions(true);
    try {
      const res = await api.post(`/pins/${pin.id}/suggestions`);
      setSuggestions(res.data || []);
      setSuggestionsLoaded(true);
    } catch { /* silent */ }
    finally { setLoadingSuggestions(false); }
  }

  async function handleAcceptSuggestion(suggestion) {
    // Add suggestion as a bullet to the dream note
    const existing = pin.dreamNote || '';
    const newLine = `- ${suggestion.title}: ${suggestion.description}`;
    const updated = existing ? `${existing}\n${newLine}` : newLine;
    try {
      await api.put(`/pins/${pin.id}`, { dreamNote: updated });
      if (onPinChanged) onPinChanged(pin.id, { dreamNote: updated });
      // Remove from suggestions
      setSuggestions(prev => prev.filter(s => s.title !== suggestion.title));
    } catch { /* silent */ }
  }

  async function handleArchive() {
    if (readOnly) return;
    if (!window.confirm('Archive this dream? It won\'t appear on your board but can be restored later.')) return;
    try {
      await api.put(`/pins/${pin.id}`, { archived: true });
      if (onPinChanged) onPinChanged(pin.id, { archived: true });
      onClose();
    } catch { /* silent */ }
  }

  async function handleSaveTitle() {
    if (readOnly) return;
    const trimmed = titleText.trim();
    if (!trimmed || trimmed === pin.placeName) {
      setEditingTitle(false);
      setTitleText(pin.placeName || '');
      return;
    }
    try {
      await api.put(`/pins/${pin.id}`, { placeName: trimmed });
      if (onPinChanged) onPinChanged(pin.id, { placeName: trimmed });
      setEditingTitle(false);
    } catch { /* silent */ }
  }

  async function handleSaveNote() {
    const trimmed = editNoteText.trim();
    setNoteSaving(true);
    setNoteSaveError('');
    try {
      await api.put(`/pins/${pin.id}`, { dreamNote: trimmed || null });
      if (onPinChanged) onPinChanged(pin.id, { dreamNote: trimmed || null });
      setEditingNote(false);
    } catch (err) {
      setNoteSaveError(err.message || 'Could not save.');
    } finally {
      setNoteSaving(false);
    }
  }

  async function handleSaveAddition() {
    if (readOnly) return;
    if (!addition.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const existing = pin.dreamNote || '';
      const appended = existing
        ? `${existing}\n- ${addition.trim()}`
        : `- ${addition.trim()}`;
      await api.put(`/pins/${pin.id}`, { dreamNote: appended });
      setSaved(true);
      setAddition('');
      setTimeout(() => setSaved(false), 2000);
      if (onPinChanged) onPinChanged(pin.id, { dreamNote: appended });
    } catch (err) {
      setSaveError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleIWentClick() {
    if (onIWent) onIWent(pin);
    onClose();
  }

  const imageUrl = localImageUrl ?? (pin.unsplashImageUrl || pin.photoUrl || null);
  const gradientStart = pin.gradientStart || (pin.tags?.[0]?.gradientStart) || '#0E4D6E';
  const gradientEnd   = pin.gradientEnd   || (pin.tags?.[0]?.gradientEnd)   || '#1A8FBF';
  const emoji = pin.emoji || pin.tags?.[0]?.emoji || '✦';

  return (
    <>
      {/* Backdrop — hidden in map mode so the map stays visible */}
      {!noBackdrop && (
        <div
          className={`md-backdrop${isOpen ? ' md-backdrop-visible' : ''}`}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={`md-panel${isOpen ? ' md-panel-open' : ''}`}>

        {/* Header */}
        <div className="md-header">
          {!readOnly && (
            <button className="md-archive-btn" onClick={handleArchive} title="Archive this dream">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 4v9a1 1 0 001 1h10a1 1 0 001-1V4M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <button className="md-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {imageUrl ? (
            <div
              className={`md-hero-img${generatingPhoto ? ' md-hero-generating' : ''}`}
              style={{ backgroundImage: `url(${imageUrl})` }}
            />
          ) : (
            <div
              className={`md-hero-gradient${generatingPhoto ? ' md-hero-generating' : ''}`}
              style={{ background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})` }}
            >
              <span className="md-hero-emoji">{emoji}</span>
            </div>
          )}
          {/* Change photo button (own pins only) */}
          {!readOnly && (
            <div className="md-photo-actions">
              {generatingPhoto ? (
                <div className="md-regen-photo-btn" style={{ cursor: 'default' }}>
                  <span className="md-regen-spinner" /> Finding photo…
                </div>
              ) : photoPromptOpen ? (
                <div className="md-photo-prompt">
                  <input
                    className="md-photo-prompt-input"
                    placeholder="e.g. fjord vistas, temple at sunset…"
                    value={photoQuery}
                    onChange={e => setPhotoQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); handleUnsplashPhoto(photoQuery.trim() || null); }
                      if (e.key === 'Escape') { setPhotoPromptOpen(false); setPhotoQuery(''); }
                    }}
                    autoFocus
                  />
                  <button className="md-photo-prompt-go" onClick={() => handleUnsplashPhoto(photoQuery.trim() || null)}>
                    Find
                  </button>
                  <button className="md-photo-prompt-go" style={{ background: 'none', color: 'rgba(255,255,255,0.5)' }} onClick={() => { setPhotoPromptOpen(false); setPhotoQuery(''); }}>
                    ✕
                  </button>
                </div>
              ) : (
                <button className="md-regen-photo-btn" onClick={() => setPhotoPromptOpen(true)} title="Change cover photo">
                  📷 Change photo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="md-body">

          {/* Place + dream label */}
          <div className="md-title-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="md-dream-eyebrow" style={{ margin: 0 }}>Dream destination</div>
              {rank != null && <div className="md-rank-badge md-rank-badge-dream">#{rank}</div>}
            </div>
            {!readOnly && editingTitle ? (
              <div className="md-title-edit">
                <input
                  ref={titleInputRef}
                  className="md-title-input"
                  value={titleText}
                  onChange={e => setTitleText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle(); }
                    if (e.key === 'Escape') { setEditingTitle(false); setTitleText(pin.placeName || ''); }
                  }}
                  onBlur={handleSaveTitle}
                  autoFocus
                />
              </div>
            ) : (
              <h2
                className={`md-place${readOnly ? '' : ' md-place-editable'}`}
                onClick={readOnly ? undefined : () => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.focus(), 0); }}
                title={readOnly ? undefined : 'Click to edit'}
              >
                {pin.placeName}
              </h2>
            )}
          </div>

          {/* Tags */}
          {pin.tags && pin.tags.length > 0 && (
            <div className="md-chips-row">
              {pin.tags.map(t => (
                <span key={t.id || t.name} className="md-tag-chip">
                  {t.emoji ? `${t.emoji} ` : ''}{t.name}
                </span>
              ))}
            </div>
          )}

          {/* Dream note / bullets - editable */}
          <div className="md-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p className="md-section-label" style={{ marginBottom: 0 }}>Why you want to go</p>
              {!readOnly && !editingNote && (
                <button
                  className="md-highlights-edit-btn"
                  onClick={() => { setEditNoteText(pin.dreamNote || pin.aiSummary || ''); setEditingNote(true); }}
                >✏️</button>
              )}
            </div>
            {editingNote ? (
              <div>
                <textarea
                  className="md-highlights-textarea"
                  value={editNoteText}
                  onChange={e => setEditNoteText(e.target.value)}
                  rows={6}
                  placeholder="Why do you want to go here?"
                />
                {noteSaveError && <p className="md-save-error">{noteSaveError}</p>}
                <div className="md-save-row">
                  <button className="md-save-btn" onClick={handleSaveNote} disabled={noteSaving}>
                    {noteSaving ? 'Saving…' : 'Save'}
                  </button>
                  <button className="md-cancel-btn" onClick={() => { setEditingNote(false); setNoteSaveError(''); }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              (pin.dreamNote || pin.aiSummary) && (
                <div>
                  {noteBullets ? (
                    <ul className="md-bullet-list">
                      {noteBullets.map((item, i) => (
                        <li key={i} className="md-bullet-item">{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="md-body-text">{pin.dreamNote || pin.aiSummary}</p>
                  )}
                </div>
              )
            )}
          </div>

          {/* AI suggestions (own pins only) */}
          {!readOnly && (
            <div className="md-section">
              {!suggestionsLoaded && !loadingSuggestions && (
                <button className="md-suggestions-btn" onClick={handleLoadSuggestions}>
                  ✦ Suggest things to do
                </button>
              )}
              {loadingSuggestions && (
                <p className="md-suggestions-loading">Finding ideas…</p>
              )}
              {suggestions.length > 0 && (
                <div className="md-suggestions">
                  <p className="md-section-label">Ideas for you</p>
                  {suggestions.map((s, i) => (
                    <div key={i} className="md-suggestion-item">
                      <div className="md-suggestion-body">
                        <span className="md-suggestion-title">{s.title}</span>
                        <span className="md-suggestion-desc">{s.description}</span>
                      </div>
                      <button
                        className="md-suggestion-accept"
                        onClick={() => handleAcceptSuggestion(s)}
                        title="Add to this dream"
                      >+</button>
                    </div>
                  ))}
                </div>
              )}
              {suggestionsLoaded && suggestions.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>All suggestions added!</p>
              )}
            </div>
          )}

          {/* Add a reason (own pins only) */}
          {!readOnly && <div className="md-section md-add-section">
            <p className="md-section-label">Add to this dream</p>
            <textarea
              className="md-textarea"
              value={addition}
              onChange={e => setAddition(e.target.value)}
              placeholder="Another reason, a specific place, something you heard about…"
              rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveAddition(); }}
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
          </div>}

          {/* I went here CTA — terminal action of the detail scroll.
              Used to also live as a button on the dream-card itself
              (in the row gap between cards), but that read as floating
              chrome. Now it lives only here, as the last meaningful
              element below the dream's notes/photos/tags. */}
          {onIWent && (
            <div className="md-section md-iwent-section">
              <button className="md-iwent-btn" onClick={handleIWentClick}>
                ✓ I went here
              </button>
              <p className="md-iwent-caption">Convert this dream into a memory</p>
            </div>
          )}

          {/* Unsplash attribution */}
          {pin.unsplashAttribution && (
            <p className="md-attribution">{pin.unsplashAttribution}</p>
          )}
        </div>
      </aside>
    </>
  );
}
