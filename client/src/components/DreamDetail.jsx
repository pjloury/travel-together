// DreamDetail — right-side slide-in panel for viewing a dream pin.

import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import useDropdownKeyboard from '../hooks/useDropdownKeyboard';

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

export default function DreamDetail({ pin, isOpen, onClose, onUpdated: _onUpdated, onPinChanged, onIWent, rank, noBackdrop, readOnly, annotation }) {
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

  // Multi-photo carousel — mirrors MemoryDetail's photos UX.
  const [photos, setPhotos] = useState(pin?.photos || []);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [openPhotoMenu, setOpenPhotoMenu] = useState(null);
  const fileInputRef = useRef(null);
  const carouselRef = useRef(null);
  const slideRefs = useRef({});

  // AI suggestions carousel + accept/reject feedback loop.
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsLoaded, setSuggestionsLoaded] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [acceptedTitles, setAcceptedTitles] = useState([]);
  const [rejectedTitles, setRejectedTitles] = useState([]);

  // companions — underlying data (array of display names / emails)
  const [companions, setCompanions] = useState([]);

  // Photo prompt (must be before early return — rules-of-hooks)
  const [photoPromptOpen, setPhotoPromptOpen] = useState(false);
  const [photoQuery, setPhotoQuery] = useState('');

  // ---- Full tag-a-friend flow (mirrors MemoryDetail exactly) ----
  const [showTagFriend, setShowTagFriend] = useState(false);
  const [tagFriendQuery, setTagFriendQuery] = useState('');
  const [tagFriendResults, setTagFriendResults] = useState([]);
  const [tagFriendSearching, setTagFriendSearching] = useState(false);
  const [tagFriendStep, setTagFriendStep] = useState('search'); // 'search' only used for now
  const [tagFriendInviteEmail, setTagFriendInviteEmail] = useState('');
  const [tagFriendFlash, setTagFriendFlash] = useState(null);
  const [pendingTags, setPendingTags] = useState([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteUrlCopied, setInviteUrlCopied] = useState(false);
  const [tagFriendInviteSending, setTagFriendInviteSending] = useState(false);
  const tagFriendDebounceRef = useRef(null);
  const tagFriendInputRef = useRef(null);

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
      // Reset tag-friend state
      setShowTagFriend(false);
      setTagFriendQuery('');
      setTagFriendResults([]);
      setTagFriendStep('search');
      setTagFriendInviteEmail('');
      setTagFriendFlash(null);
      setInviteUrl('');
      setInviteUrlCopied(false);
    }
  }, [isOpen, pin?.id]);

  // Debounced tag-friend user search
  useEffect(() => {
    if (!tagFriendQuery.trim()) { setTagFriendResults([]); return; }
    clearTimeout(tagFriendDebounceRef.current);
    setTagFriendSearching(true);
    tagFriendDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(tagFriendQuery.trim())}`);
        setTagFriendResults(res.data || []);
      } catch {
        setTagFriendResults([]);
      } finally {
        setTagFriendSearching(false);
      }
    }, 350);
    return () => clearTimeout(tagFriendDebounceRef.current);
  }, [tagFriendQuery]);

  // Auto-clear flash banner after 3s
  useEffect(() => {
    if (!tagFriendFlash) return;
    const t = setTimeout(() => setTagFriendFlash(null), 3000);
    return () => clearTimeout(t);
  }, [tagFriendFlash]);

  // Fetch pending tags when panel opens (own pins only)
  useEffect(() => {
    if (!isOpen || readOnly || !pin?.id) { setPendingTags([]); return; }
    let cancelled = false;
    api.get(`/pins/${pin.id}/pending-tags`)
      .then(res => { if (!cancelled) setPendingTags(res.data?.pendingTags || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isOpen, readOnly, pin?.id]);

  // Auto-seed invite email when query is an email with no results
  useEffect(() => {
    const noResults = tagFriendQuery.trim().length > 1 && !tagFriendSearching && tagFriendResults.length === 0;
    const looksLikeEmailNow = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tagFriendQuery.trim());
    if (noResults && looksLikeEmailNow && !tagFriendInviteEmail) {
      setTagFriendInviteEmail(tagFriendQuery.trim());
    }
  }, [tagFriendQuery, tagFriendSearching, tagFriendResults.length, tagFriendInviteEmail]);

  // Hook must be before early return (rules-of-hooks)
  const tagFriendKb = useDropdownKeyboard(tagFriendResults.length, () => {}, () => {});

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showTagFriend) { closeTagFriend(); return; }
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, showTagFriend]);

  if (!pin) return null;

  // ---- Derived tag-friend values ----
  const tagFriendNoResults = tagFriendQuery.trim().length > 1 && !tagFriendSearching && tagFriendResults.length === 0;
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tagFriendQuery.trim());
  const inviteEmailPrefill = tagFriendInviteEmail || (looksLikeEmail ? tagFriendQuery.trim() : '');
  const inviteEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmailPrefill.trim());

  // ---- Companion helpers ----
  async function persistCompanions(next) {
    if (!pin) return;
    setCompanions(next);
    try {
      await api.put(`/pins/${pin.id}`, { companions: next });
      if (onPinChanged) onPinChanged(pin.id, { companions: next });
    } catch {
      setCompanions(pin.companions || []);
    }
  }

  function removeCompanion(name) {
    persistCompanions(companions.filter(c => c !== name));
  }

  // ---- Tag-friend helpers ----
  function closeTagFriend() {
    setShowTagFriend(false);
    setTagFriendQuery('');
    setTagFriendResults([]);
    setTagFriendStep('search');
    setTagFriendInviteEmail('');
    setTagFriendFlash(null);
  }

  async function refreshPendingTags() {
    if (!pin?.id || readOnly) return;
    try {
      const res = await api.get(`/pins/${pin.id}/pending-tags`);
      setPendingTags(res.data?.pendingTags || []);
    } catch { /* silent */ }
  }

  async function handleTagFriendSelect(user) {
    const label = user.display_name || user.username;
    if (companions.includes(label)) {
      setTagFriendFlash({ kind: 'already', name: label });
      setTagFriendQuery('');
      setTagFriendResults([]);
      return;
    }
    const updated = [...companions, label];
    try {
      await api.put(`/pins/${pin.id}`, { companions: updated });
      if (onPinChanged) onPinChanged(pin.id, { companions: updated });
      setCompanions(updated);
      setTagFriendFlash({ kind: 'tagged', name: label });
    } catch { /* silent */ }
    setTagFriendQuery('');
    setTagFriendResults([]);
    setTimeout(() => tagFriendInputRef.current?.focus(), 0);
  }

  async function handleTagFriendInvite() {
    const email = inviteEmailPrefill.trim();
    if (!email) return;
    setTagFriendInviteSending(true);
    try {
      // Use dream-companion invite so the email references this specific dream
      await api.post('/invites/dream-companion', { email, pinId: pin.id });
      // Also record a pending tag so it shows in the pending list
      await api.post(`/pins/${pin.id}/pending-tags`, { email, label: tagFriendQuery.trim() }).catch(() => {});
    } catch { /* non-fatal */ }
    finally { setTagFriendInviteSending(false); }
    if (!companions.includes(email)) setCompanions(prev => [...prev, email]);
    if (onPinChanged) onPinChanged(pin.id, { companions: companions.includes(email) ? companions : [...companions, email] });
    refreshPendingTags();
    setTagFriendFlash({ kind: 'invited', email });
    setTagFriendQuery('');
    setTagFriendResults([]);
    setTagFriendInviteEmail('');
    setTimeout(() => tagFriendInputRef.current?.focus(), 0);
  }

  async function handleResendPendingTag(tagId, email) {
    try {
      await api.post(`/pins/pending-tags/${tagId}/resend`);
      if (email) await api.post('/invites/send', { email }).catch(() => {});
      setTagFriendFlash({ kind: 'invited', email });
      refreshPendingTags();
    } catch { /* silent */ }
  }

  async function handleCancelPendingTag(tagId) {
    try {
      await api.delete(`/pins/pending-tags/${tagId}`);
      setPendingTags(prev => prev.filter(p => p.id !== tagId));
    } catch { /* silent */ }
  }

  async function handleCopyInviteUrl() {
    if (!pin?.id) return;
    setInviteUrlCopied(false);
    try {
      let token;
      const existing = pendingTags.find(p => p.token && !p.email);
      if (existing) {
        token = existing.token;
      } else {
        const res = await api.post(`/pins/${pin.id}/invite-token`);
        token = res.data?.token;
        refreshPendingTags();
      }
      if (!token) return;
      const url = `${window.location.origin}/m/${token}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setInviteUrlCopied(true);
        setTimeout(() => setInviteUrlCopied(false), 2500);
      } catch { /* clipboard may be denied */ }
    } catch { /* silent */ }
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

  // Social annotation — friends who've been here (on dream cards)
  const friendsBeenHere = annotation?.friendsBeen || annotation?.friendsDreaming || [];

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

          {/* Hero / carousel */}
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

          {/* Cover-photo control — bottom-RIGHT */}
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

          {/* Add-photos affordance — bottom-LEFT, only when there are <2 photos */}
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

          {/* Social: friends who've already been here */}
          {friendsBeenHere.length > 0 && (
            <div className="md-section md-social-section">
              <p className="md-section-label" style={{ marginBottom: 8 }}>
                {friendsBeenHere.length === 1 ? '1 friend' : `${friendsBeenHere.length} friends`} ha{friendsBeenHere.length === 1 ? 's' : 've'} been here
              </p>
              <div className="md-social-friends">
                {friendsBeenHere.slice(0, 6).map((f, i) => {
                  const name = f.displayName || f.display_name || '?';
                  return (
                    <div key={f.userId || f.id || i} className="md-social-friend" title={name}>
                      {f.avatarUrl || f.avatar_url
                        ? <img src={f.avatarUrl || f.avatar_url} alt={name} />
                        : <span>{name.charAt(0).toUpperCase()}</span>
                      }
                    </div>
                  );
                })}
                {friendsBeenHere.length > 6 && (
                  <div className="md-social-friend md-social-friend-overflow">
                    +{friendsBeenHere.length - 6}
                  </div>
                )}
              </div>
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

          {/* Tag a friend — full flow matching MemoryDetail exactly */}
          {!readOnly && (
            <div className="md-section md-companions-section">
              {/* Companion chips — removable */}
              {companions.length > 0 && (
                <div className="md-companions-chips" style={{ marginBottom: 8 }}>
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

              {!showTagFriend ? (
                <div className="md-tag-friend-row">
                  <button
                    type="button"
                    className="md-tag-friend-btn"
                    onClick={() => { setShowTagFriend(true); setTimeout(() => tagFriendInputRef.current?.focus(), 50); }}
                  >
                    👤 Tag a friend
                  </button>
                </div>
              ) : (
                <div className="md-tf-wrap">
                  <div className="md-tf-header">
                    <span className="md-tf-title">Tag friends</span>
                    <button type="button" className="md-tf-close-btn" onClick={closeTagFriend}>Done</button>
                  </div>

                  {/* Shareable invite URL */}
                  <div className="md-tf-share-row">
                    <button
                      type="button"
                      className="md-tf-share-btn"
                      onClick={handleCopyInviteUrl}
                      title="Copy a shareable invite link"
                    >
                      {inviteUrlCopied ? '✓ Link copied' : '🔗 Copy invite link'}
                    </button>
                    {inviteUrl && !inviteUrlCopied && (
                      <input
                        type="text"
                        className="md-tf-share-url"
                        readOnly
                        value={inviteUrl}
                        onFocus={(e) => e.target.select()}
                      />
                    )}
                  </div>

                  {/* Pending invites */}
                  {pendingTags.length > 0 && (
                    <div className="md-tf-pending">
                      <p className="md-tf-pending-title">Pending invites</p>
                      {pendingTags.map(p => (
                        <div key={p.id} className="md-tf-pending-row">
                          <span className="md-tf-pending-label">
                            {p.email
                              ? <>📧 {p.label || p.email}{p.label && <span className="md-tf-pending-sub"> · {p.email}</span>}</>
                              : <>🔗 Shareable link · {p.sendCount} {p.sendCount === 1 ? 'view' : 'views'}</>
                            }
                          </span>
                          <span className="md-tf-pending-actions">
                            {p.email && (
                              <button
                                type="button"
                                className="md-tf-pending-btn"
                                onClick={() => handleResendPendingTag(p.id, p.email)}
                              >Resend</button>
                            )}
                            <button
                              type="button"
                              className="md-tf-pending-btn md-tf-pending-cancel"
                              onClick={() => handleCancelPendingTag(p.id)}
                              title="Cancel this invite"
                            >×</button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Flash confirmation */}
                  {tagFriendFlash && (
                    <div className={`md-tf-flash md-tf-flash-${tagFriendFlash.kind}`}>
                      {tagFriendFlash.kind === 'tagged' && (
                        <>✓ Tagged <strong>{tagFriendFlash.name}</strong> — add another below</>
                      )}
                      {tagFriendFlash.kind === 'already' && (
                        <><strong>{tagFriendFlash.name}</strong> is already tagged</>
                      )}
                      {tagFriendFlash.kind === 'invited' && (
                        <>✓ Invite sent to <strong>{tagFriendFlash.email}</strong></>
                      )}
                    </div>
                  )}

                  {tagFriendStep === 'search' && (
                    <div className="md-tf-search-wrap">
                      <input
                        ref={tagFriendInputRef}
                        type="text"
                        className="md-tf-input"
                        placeholder="Search by name or username…"
                        value={tagFriendQuery}
                        onChange={e => setTagFriendQuery(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                            tagFriendKb.handleKeyDown(e);
                          } else if (e.key === 'Enter') {
                            e.preventDefault();
                            const idx = tagFriendKb.highlightedIndex >= 0 ? tagFriendKb.highlightedIndex : 0;
                            if (tagFriendResults[idx]) handleTagFriendSelect(tagFriendResults[idx]);
                          } else if (e.key === 'Escape') {
                            closeTagFriend();
                          }
                        }}
                      />

                      {tagFriendQuery.trim().length > 0 && (
                        <div className="md-tf-dropdown">
                          {tagFriendSearching && (
                            <div className="md-tf-searching">Searching…</div>
                          )}
                          {!tagFriendSearching && tagFriendResults.map((user, i) => (
                            <div
                              key={user.id}
                              className={`md-tf-result${i === tagFriendKb.highlightedIndex ? ' md-tf-result-highlighted' : ''}`}
                              onMouseEnter={() => tagFriendKb.setHighlightedIndex(i)}
                              onClick={() => handleTagFriendSelect(user)}
                            >
                              <div className="md-tf-avatar">
                                {user.avatar_url
                                  ? <img src={user.avatar_url} alt={user.display_name} />
                                  : (user.display_name || user.username || '?')[0].toUpperCase()
                                }
                              </div>
                              <div>
                                <div className="md-tf-name">{user.display_name || user.username}</div>
                                {user.username && <div className="md-tf-username">@{user.username}</div>}
                              </div>
                            </div>
                          ))}
                          {tagFriendNoResults && (
                            <div className="md-tf-no-results">
                              No users found for &ldquo;{tagFriendQuery}&rdquo;
                            </div>
                          )}
                        </div>
                      )}

                      {/* Invite prompt when no results */}
                      {tagFriendNoResults && (
                        <div className="md-tf-invite-prompt">
                          <p className="md-tf-invite-label">
                            <strong>{tagFriendQuery}</strong> isn&rsquo;t on Travel Together yet.
                            Send them an invite to view your profile and join.
                          </p>
                          <div className="md-tf-invite-row">
                            <input
                              type="email"
                              className="md-tf-email-input"
                              placeholder="their@email.com"
                              value={inviteEmailPrefill}
                              onChange={e => setTagFriendInviteEmail(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleTagFriendInvite(); }}
                            />
                            <button
                              type="button"
                              className="md-tf-send-btn"
                              onClick={handleTagFriendInvite}
                              disabled={tagFriendInviteSending || !inviteEmailIsValid}
                            >
                              {tagFriendInviteSending ? 'Sending…' : 'Invite'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI suggestions carousel */}
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

          {/* I went here CTA */}
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
