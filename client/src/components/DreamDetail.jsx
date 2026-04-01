// DreamDetail — right-side slide-in panel for viewing a dream pin.

import { useState, useEffect } from 'react';
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

export default function DreamDetail({ pin, isOpen, onClose, onUpdated, onPinChanged, onIWent, rank, noBackdrop }) {
  const [addition, setAddition] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  // Optimistic local image + AI regen
  const [localImageUrl, setLocalImageUrl] = useState(null);
  const [generatingPhoto, setGeneratingPhoto] = useState(false);

  // Reset each time a new pin opens
  useEffect(() => {
    if (isOpen) {
      setAddition('');
      setSaving(false);
      setSaveError('');
      setSaved(false);
      setLocalImageUrl(pin?.unsplashImageUrl || pin?.photoUrl || null);
      setGeneratingPhoto(false);
    }
  }, [isOpen, pin?.id]);

  async function handleRegeneratePhoto() {
    if (generatingPhoto || !pin) return;
    setGeneratingPhoto(true);
    try {
      const res = await api.post(`/pins/${pin.id}/regenerate-photo`);
      const newUrl = res.data?.photoUrl;
      if (newUrl) {
        setLocalImageUrl(newUrl);
        if (onPinChanged) onPinChanged(pin.id, { photoUrl: newUrl, photoSource: 'gemini_imagen' });
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

  async function handleSaveAddition() {
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
      if (onUpdated) onUpdated();
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
          {/* AI photo regenerate button */}
          <button
            className="md-regen-photo-btn"
            onClick={handleRegeneratePhoto}
            disabled={generatingPhoto}
            title="Regenerate cover photo with AI"
          >
            {generatingPhoto ? (
              <span className="md-regen-spinner" />
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 1l2.5 2L8 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {generatingPhoto ? 'Generating…' : 'AI photo'}
          </button>
        </div>

        {/* Body */}
        <div className="md-body">

          {/* Place + dream label */}
          <div className="md-title-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="md-dream-eyebrow" style={{ margin: 0 }}>Dream destination</div>
              {rank != null && <div className="md-rank-badge md-rank-badge-dream">#{rank}</div>}
            </div>
            <h2 className="md-place">{pin.placeName}</h2>
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

          {/* Dream note / bullets */}
          {(pin.dreamNote || pin.aiSummary) && (
            <div className="md-section">
              <p className="md-section-label">Why you want to go</p>
              {noteBullets ? (
                <ul className="md-bullet-list">
                  {noteBullets.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="md-body-text">{pin.dreamNote || pin.aiSummary}</p>
              )}
            </div>
          )}

          {/* Add a reason */}
          <div className="md-section md-add-section">
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
          </div>

          {/* I went! CTA */}
          {onIWent && (
            <div className="md-section">
              <button className="md-iwent-btn" onClick={handleIWentClick}>
                🎉 I went! — convert to memory
              </button>
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
