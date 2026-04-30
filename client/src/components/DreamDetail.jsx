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

  // Multi-photo carousel — mirrors MemoryDetail's photos UX. Photos
  // upload via /api/pins/:id/photos and persist on the pin row.
  const [photos, setPhotos] = useState(pin?.photos || []);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [openPhotoMenu, setOpenPhotoMenu] = useState(null);
  const fileInputRef = useRef(null);
  const carouselRef = useRef(null);
  const slideRefs = useRef({});

  // AI suggestions — carousel + accept/reject feedback loop. The
  // accepted/rejected sets are sent to the server on Regenerate so the
  // next batch is biased away from rejected style and toward accepted
  // vibes. Carousel index points at the currently visible card.
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [acceptedTitles, setAcceptedTitles] = useState([]);
  const [rejectedTitles, setRejectedTitles] = useState([]);

  // "Want to go with" companions — V1 lite picker. Searches existing
  // travel-together users via /search/users; falls back to a free-form
  // text companion ("Mom", "Sam from work") when nothing matches. The
  // pin's companions field is just an array of display names so the
  // payload + storage shape mirrors MemoryDetail's companions flow.
  const [companions, setCompanions] = useState([]);
  const [companionQuery, setCompanionQuery] = useState('');
  const [companionResults, setCompanionResults] = useState([]);
  const [companionSearching, setCompanionSearching] = useState(false);
  const [companionPickerOpen, setCompanionPickerOpen] = useState(false);
  const companionDebounceRef = useRef(null);

  // Reset each time a new pin opens
  useEffect(() => {
    if (isOpen) {
      setAddition('');
      setSaving(false);
      setSaveError('');
      setSaved(false);
      setLocalImageUrl(pin?.unsplashImageUrl || pin?.photoUrl || null);
      setGeneratingPhoto(false);
      setPhotos(pin?.photos || []);
      setPhotoIndex(0);
      setOpenPhotoMenu(null);
      // Lazy-fetch full pin to populate photos if list endpoint
      // didn't include them (mirrors MemoryDetail behavior).
      if (!pin?.photos || pin.photos.length === 0) {
        api.get(`/pins/${pin.id}`).then(res => {
          const full = res.data || res;
          if (full?.photos?.length > 0) setPhotos(full.photos);
        }).catch(() => {});
      }
      setSuggestions([]);
      setSuggestionsLoaded(false);
      setSuggestionIndex(0);
      setAcceptedTitles([]);
      setRejectedTitles([]);
      setTitleText(pin?.placeName || '');
      setEditingTitle(false);
      setEditNoteText(pin?.dreamNote || pin?.aiSummary || '');
      setEditingNote(false);
      setNoteSaveError('');
      setCompanions(pin?.companions || []);
      setCompanionQuery('');
      setCompanionResults([]);
      setCompanionPickerOpen(false);
    }
  }, [isOpen, pin?.id]);

  // Debounced companion search.
  useEffect(() => {
    if (!companionQuery.trim()) { setCompanionResults([]); return; }
    clearTimeout(companionDebounceRef.current);
    setCompanionSearching(true);
    companionDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(companionQuery.trim())}`);
        setCompanionResults(res.data || res || []);
      } catch {
        setCompanionResults([]);
      } finally {
        setCompanionSearching(false);
      }
    }, 250);
    return () => clearTimeout(companionDebounceRef.current);
  }, [companionQuery]);

  async function persistCompanions(next) {
    if (!pin) return;
    setCompanions(next);
    try {
      await api.put(`/pins/${pin.id}`, { companions: next });
      if (onPinChanged) onPinChanged(pin.id, { companions: next });
    } catch {
      // Roll back on error so the chip set matches reality.
      setCompanions(pin.companions || []);
    }
  }

  function addCompanion(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    if (companions.includes(trimmed)) {
      setCompanionQuery('');
      setCompanionResults([]);
      return;
    }
    persistCompanions([...companions, trimmed]);
    setCompanionQuery('');
    setCompanionResults([]);
  }

  // When the typed text looks like an email and there's no existing TT
  // user match, send a real invitation referencing this specific dream
  // (subject + body call out the destination + dreamNote). The server
  // also appends the email to companions so the chip lands locally.
  async function inviteCompanionByEmail(email) {
    if (!pin) return;
    const trimmed = (email || '').trim();
    if (!trimmed) return;
    setCompanionQuery('');
    setCompanionResults([]);
    setCompanions(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    try {
      await api.post('/invites/dream-companion', { email: trimmed, pinId: pin.id });
      // Server's UPDATE pin.companions is the source of truth — pull
      // it back through onPinChanged so any other open surface
      // reflects the new companion.
      if (onPinChanged) onPinChanged(pin.id, {
        companions: companions.includes(trimmed) ? companions : [...companions, trimmed],
      });
    } catch {
      setCompanions(prev => prev.filter(c => c !== trimmed));
    }
  }

  // Tiny inline detector — keep in sync with the server-side regex.
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function looksLikeEmail(s) { return EMAIL_RE.test((s || '').trim()); }

  function removeCompanion(name) {
    persistCompanions(companions.filter(c => c !== name));
  }

  // ---- Photos (carousel + upload) ----
  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !pin) return;
    setUploadingPhotos(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('photos', f));
      const res = await api.postFormData(`/pins/${pin.id}/photos`, formData);
      const data = res.data || res;
      const updated = data.photos || [];
      setPhotos(updated);
      setPhotoIndex(Math.max(0, updated.length - files.length));
      if (onPinChanged) onPinChanged(pin.id, { photos: updated });
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPhotos(false);
      e.target.value = '';
    }
  }

  async function handlePhotoDelete(photoId) {
    if (!pin) return;
    setOpenPhotoMenu(null);
    const prev = photos;
    const optimistic = photos.filter(p => p.id !== photoId);
    setPhotos(optimistic);
    setPhotoIndex(i => Math.max(0, Math.min(i, optimistic.length - 1)));
    try {
      const res = await api.delete(`/pins/${pin.id}/photos/${photoId}`);
      const data = res.data || res;
      const updated = data.photos || optimistic;
      setPhotos(updated);
      if (onPinChanged) onPinChanged(pin.id, { photos: updated });
    } catch {
      setPhotos(prev);
    }
  }

  async function handleSetCover(photo) {
    if (!pin || !photo?.photoUrl) return;
    setOpenPhotoMenu(null);
    const payload = {
      photoUrl: photo.photoUrl,
      photoSource: photo.photoSource || 'upload',
      unsplashImageUrl: null,
      unsplashAttribution: null,
    };
    const prevCover = localImageUrl;
    setLocalImageUrl(photo.photoUrl);
    try {
      await api.put(`/pins/${pin.id}`, payload);
      if (onPinChanged) onPinChanged(pin.id, payload);
    } catch {
      setLocalImageUrl(prevCover);
    }
  }

  function orderPhotosCoverFirst(list, coverUrl) {
    if (!Array.isArray(list) || list.length < 2 || !coverUrl) return list || [];
    const idx = list.findIndex(p => p && p.photoUrl === coverUrl);
    if (idx <= 0) return list;
    return [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)];
  }

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

  async function handleLoadSuggestions(opts = {}) {
    if (loadingSuggestions || !pin) return;
    if (suggestionsLoaded && !opts.regenerate) return;
    setLoadingSuggestions(true);
    try {
      const res = await api.post(`/pins/${pin.id}/suggestions`, {
        accepted: acceptedTitles,
        rejected: rejectedTitles,
      });
      const fresh = res.data || res || [];
      setSuggestions(fresh);
      setSuggestionsLoaded(true);
      setSuggestionIndex(0);
    } catch { /* silent */ }
    finally { setLoadingSuggestions(false); }
  }

  async function handleAcceptSuggestion(suggestion) {
    const existing = pin.dreamNote || '';
    const newLine = `- ${suggestion.title}: ${suggestion.description}`;
    const updated = existing ? `${existing}\n${newLine}` : newLine;
    try {
      await api.put(`/pins/${pin.id}`, { dreamNote: updated });
      if (onPinChanged) onPinChanged(pin.id, { dreamNote: updated });
      setAcceptedTitles(prev => prev.includes(suggestion.title) ? prev : [...prev, suggestion.title]);
      // Drop the accepted card from the carousel; keep the index in
      // bounds so the next card slides into view.
      setSuggestions(prev => {
        const next = prev.filter(s => s.title !== suggestion.title);
        setSuggestionIndex(i => Math.min(i, Math.max(0, next.length - 1)));
        return next;
      });
    } catch { /* silent */ }
  }

  function handleRejectSuggestion(suggestion) {
    setRejectedTitles(prev => prev.includes(suggestion.title) ? prev : [...prev, suggestion.title]);
    setSuggestions(prev => {
      const next = prev.filter(s => s.title !== suggestion.title);
      setSuggestionIndex(i => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
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

          {/* Hero / carousel — mirrors MemoryDetail. With 2+ photos
              we render a horizontal carousel including a "+ Add more"
              tile; with 0–1 photos we keep the single hero (gradient
              fallback when neither cover nor uploaded photo is set). */}
          {(() => {
            const orderedPhotos = orderPhotosCoverFirst(photos, localImageUrl);
            const activeIdx = Math.max(0, Math.min(photoIndex, orderedPhotos.length - 1));
            if (orderedPhotos.length >= 2) {
              const scrollToSlide = (i) => {
                const node = slideRefs.current[i];
                if (node && node.scrollIntoView) {
                  node.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
                }
              };
              return (
                <div className={`md-hero-img md-carousel${generatingPhoto ? ' md-hero-generating' : ''}`}>
                  <div
                    className="md-carousel-track"
                    ref={carouselRef}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      const w = el.clientWidth || 1;
                      const i = Math.round(el.scrollLeft / w);
                      const clamped = Math.max(0, Math.min(i, orderedPhotos.length - 1));
                      if (clamped !== photoIndex) setPhotoIndex(clamped);
                    }}
                  >
                    {orderedPhotos.map((p, i) => (
                      <div
                        key={p.id || i}
                        ref={el => { slideRefs.current[i] = el; }}
                        className="md-carousel-slide"
                        style={{ backgroundImage: `url(${p.photoUrl})` }}
                      >
                        {!readOnly && (
                          <div className="md-photo-menu-wrap">
                            <button
                              className="md-photo-menu-btn"
                              onClick={() => setOpenPhotoMenu(openPhotoMenu === p.id ? null : p.id)}
                              aria-label="Photo actions"
                              title="Photo actions"
                            >⋯</button>
                            {openPhotoMenu === p.id && (
                              <div className="md-photo-menu" onMouseLeave={() => setOpenPhotoMenu(null)}>
                                <button
                                  className="md-photo-menu-item"
                                  onClick={() => handleSetCover(p)}
                                  disabled={localImageUrl === p.photoUrl}
                                >
                                  {localImageUrl === p.photoUrl ? '✓ Cover' : 'Set as cover'}
                                </button>
                                <button
                                  className="md-photo-menu-item md-photo-menu-item-danger"
                                  onClick={() => handlePhotoDelete(p.id)}
                                >Remove</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {!readOnly && (
                      <div
                        ref={el => { slideRefs.current[orderedPhotos.length] = el; }}
                        className="md-carousel-slide md-carousel-add-tile"
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                        title="Add more photos"
                      >
                        <span className="md-carousel-add-icon">+</span>
                        <span className="md-carousel-add-label">{uploadingPhotos ? 'Uploading…' : 'Add more'}</span>
                      </div>
                    )}
                  </div>
                  <button
                    className="md-carousel-prev"
                    onClick={() => { const ni = (activeIdx - 1 + orderedPhotos.length) % orderedPhotos.length; setPhotoIndex(ni); scrollToSlide(ni); }}
                    aria-label="Previous photo"
                  >&#8249;</button>
                  <button
                    className="md-carousel-next"
                    onClick={() => { const max = orderedPhotos.length + (readOnly ? 0 : 1); const ni = (activeIdx + 1) % max; setPhotoIndex(ni >= orderedPhotos.length ? 0 : ni); scrollToSlide(ni); }}
                    aria-label="Next photo"
                  >&#8250;</button>
                  <div className="md-carousel-dots">
                    {orderedPhotos.map((_, i) => (
                      <button
                        key={i}
                        className={`md-carousel-dot${i === activeIdx ? ' active' : ''}`}
                        onClick={() => { setPhotoIndex(i); scrollToSlide(i); }}
                        aria-label={`Photo ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              );
            }
            const heroUrl = orderedPhotos.length === 1
              ? orderedPhotos[0].photoUrl
              : imageUrl;
            return heroUrl ? (
              <div
                className={`md-hero-img${generatingPhoto ? ' md-hero-generating' : ''}`}
                style={{ backgroundImage: `url(${heroUrl})` }}
              />
            ) : (
              <div
                className={`md-hero-gradient${generatingPhoto ? ' md-hero-generating' : ''}`}
                style={{ background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})` }}
              >
                <span className="md-hero-emoji">{emoji}</span>
              </div>
            );
          })()}

          {/* Hidden file input — shared by overlay button + carousel tile */}
          {!readOnly && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handlePhotoUpload}
            />
          )}

          {/* Cover-photo control — bottom-RIGHT. Triggers the Unsplash
              search; when a search is in flight we replace the button
              with the prompt input + spinner. */}
          {!readOnly && (
            <div className="md-photo-actions md-photo-actions-cover">
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

          {/* Add-photos affordance — bottom-LEFT, only when there
              are <2 photos. With 2+ photos the carousel's "+ Add more"
              tile picks up uploads instead, avoiding two stacked
              affordances at the same anchor. */}
          {!readOnly && photos.length < 2 && !photoPromptOpen && !generatingPhoto && (
            <div className="md-photo-actions md-photo-actions-upload">
              <button
                className="md-regen-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhotos}
                title="Upload your own photos"
              >
                {uploadingPhotos ? 'Uploading…' : '📎 Add photos'}
              </button>
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

          {/* Want to go with — tag a friend (or invite by name) so this
              dream is connected to who you'd want to share it with.
              V1 lite: searches existing TT users and supports free-form
              names. Stays consistent with MemoryDetail's companions
              chip pattern. */}
          {!readOnly && (
            <div className="md-section md-companions-section">
              <p className="md-section-label">Want to go with</p>
              {companions.length > 0 && (
                <div className="md-companions-chips">
                  {companions.map(c => (
                    <span key={c} className="md-companion-chip">
                      {c}
                      <button
                        className="md-companion-chip-remove"
                        title={`Remove ${c}`}
                        onClick={() => removeCompanion(c)}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              {companionPickerOpen ? (
                <div className="md-companion-picker">
                  <input
                    className="md-companion-input"
                    placeholder="Search a friend or type a name…"
                    value={companionQuery}
                    onChange={e => setCompanionQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const top = companionResults[0];
                        if (top) {
                          addCompanion(top.displayName || top.username);
                        } else if (looksLikeEmail(companionQuery)) {
                          inviteCompanionByEmail(companionQuery);
                        } else {
                          addCompanion(companionQuery);
                        }
                      } else if (e.key === 'Escape') {
                        setCompanionPickerOpen(false);
                        setCompanionQuery('');
                      }
                    }}
                    autoFocus
                  />
                  {companionSearching && (
                    <div className="md-companion-hint">Searching…</div>
                  )}
                  {!companionSearching && companionResults.length > 0 && (
                    <div className="md-companion-results">
                      {companionResults.slice(0, 5).map(u => (
                        <button
                          key={u.id || u.username}
                          className="md-companion-result"
                          onClick={() => addCompanion(u.displayName || u.username)}
                        >
                          {u.avatarUrl
                            ? <img src={u.avatarUrl} alt="" className="md-companion-avatar" />
                            : <span className="md-companion-avatar md-companion-avatar-placeholder">
                                {(u.displayName || u.username || '?').charAt(0).toUpperCase()}
                              </span>
                          }
                          <span>{u.displayName || u.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!companionSearching && companionQuery.trim() && companionResults.length === 0 && (
                    looksLikeEmail(companionQuery) ? (
                      <button
                        className="md-companion-fallback md-companion-fallback-invite"
                        onClick={() => inviteCompanionByEmail(companionQuery)}
                        title="Send a Travel Together invite that references this dream"
                      >
                        ✉ Invite {companionQuery.trim()} to plan this trip
                      </button>
                    ) : (
                      <button
                        className="md-companion-fallback"
                        onClick={() => addCompanion(companionQuery)}
                      >
                        + Add "{companionQuery.trim()}" as a companion
                      </button>
                    )
                  )}
                </div>
              ) : (
                <button
                  className="md-companion-add-btn"
                  onClick={() => setCompanionPickerOpen(true)}
                >
                  + Tag a friend
                </button>
              )}
            </div>
          )}

          {/* AI suggestions carousel — own pins only.
              Each card has a photo, title, description, and ✓/✗
              accept/reject buttons. Rejected suggestions are NOT
              dropped from history; they're sent to the server on
              Regenerate as a "do not repeat / avoid the style" hint
              alongside accepted titles which steer toward similar
              vibes. */}
          {!readOnly && (
            <div className="md-section md-suggestions-section">
              {!suggestionsLoaded && !loadingSuggestions && (
                <button className="md-suggestions-btn" onClick={() => handleLoadSuggestions()}>
                  ✦ Suggest things to do
                </button>
              )}
              {loadingSuggestions && (
                <p className="md-suggestions-loading">Finding ideas…</p>
              )}
              {!loadingSuggestions && suggestions.length > 0 && (() => {
                const idx = Math.min(suggestionIndex, suggestions.length - 1);
                const s = suggestions[idx];
                return (
                  <>
                    <div className="md-suggestion-carousel-header">
                      <p className="md-section-label" style={{ margin: 0 }}>Ideas for you</p>
                      <span className="md-suggestion-counter">
                        {idx + 1} / {suggestions.length}
                      </span>
                    </div>
                    <div className="md-suggestion-card">
                      {s.imageUrl ? (
                        <div
                          className="md-suggestion-card-img"
                          style={{ backgroundImage: `url(${s.imageUrl})` }}
                        />
                      ) : (
                        <div
                          className="md-suggestion-card-img md-suggestion-card-img-fallback"
                          style={{ background: `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})` }}
                        >
                          <span className="md-suggestion-card-emoji">✦</span>
                        </div>
                      )}
                      <div className="md-suggestion-card-body">
                        {s.category && (
                          <span className="md-suggestion-card-category">{s.category}</span>
                        )}
                        <h4 className="md-suggestion-card-title">{s.title}</h4>
                        <p className="md-suggestion-card-desc">{s.description}</p>
                        <div className="md-suggestion-card-actions">
                          <button
                            className="md-suggestion-action md-suggestion-action-reject"
                            onClick={() => handleRejectSuggestion(s)}
                            title="Not for me"
                          >✕ Skip</button>
                          <button
                            className="md-suggestion-action md-suggestion-action-accept"
                            onClick={() => handleAcceptSuggestion(s)}
                            title="Add to this dream"
                          >✓ Add to dream</button>
                        </div>
                      </div>
                    </div>
                    <div className="md-suggestion-carousel-nav">
                      <button
                        className="md-suggestion-nav-btn"
                        onClick={() => setSuggestionIndex(i => Math.max(0, i - 1))}
                        disabled={idx === 0}
                        aria-label="Previous suggestion"
                      >‹</button>
                      <div className="md-suggestion-carousel-dots">
                        {suggestions.map((_, i) => (
                          <button
                            key={i}
                            className={`md-suggestion-dot${i === idx ? ' md-suggestion-dot-active' : ''}`}
                            onClick={() => setSuggestionIndex(i)}
                            aria-label={`Go to suggestion ${i + 1}`}
                          />
                        ))}
                      </div>
                      <button
                        className="md-suggestion-nav-btn"
                        onClick={() => setSuggestionIndex(i => Math.min(suggestions.length - 1, i + 1))}
                        disabled={idx === suggestions.length - 1}
                        aria-label="Next suggestion"
                      >›</button>
                    </div>
                    <button
                      className="md-suggestions-regen-btn"
                      onClick={() => handleLoadSuggestions({ regenerate: true })}
                      disabled={loadingSuggestions}
                      title={
                        acceptedTitles.length || rejectedTitles.length
                          ? 'Regenerate using your feedback so far'
                          : 'Get a fresh batch'
                      }
                    >
                      ↻ Regenerate
                      {(acceptedTitles.length || rejectedTitles.length) ? (
                        <span className="md-suggestions-regen-meta">
                          {acceptedTitles.length} kept · {rejectedTitles.length} skipped
                        </span>
                      ) : null}
                    </button>
                  </>
                );
              })()}
              {suggestionsLoaded && suggestions.length === 0 && !loadingSuggestions && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {acceptedTitles.length || rejectedTitles.length
                      ? 'No more — regenerate for fresh ideas based on what you kept and skipped.'
                      : 'All suggestions added!'}
                  </p>
                  <button
                    className="md-suggestions-regen-btn"
                    onClick={() => handleLoadSuggestions({ regenerate: true })}
                    disabled={loadingSuggestions}
                  >
                    ↻ Regenerate
                  </button>
                </>
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
