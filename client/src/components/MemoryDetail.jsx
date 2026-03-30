// MemoryDetail — right-side panel for viewing and adding to a memory.

import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

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

  // Reset internal state each time a new pin opens
  useEffect(() => {
    if (isOpen) {
      setShowTranscript(false);
      setAddition('');
      setSaving(false);
      setSaveError('');
      setSaved(false);
    }
  }, [isOpen, pin?.id]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!pin) return null;

  const summaryBullets = parseSummary(pin.aiSummary);
  const hearts = pin.rating ? Array.from({ length: pin.rating }, () => '♥').join('') : null;

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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`md-backdrop${isOpen ? ' md-backdrop-visible' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside className={`md-panel${isOpen ? ' md-panel-open' : ''}`}>

        {/* Header */}
        <div className="md-header">
          <button className="md-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

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
            <div className="md-meta-row">
              {pin.visitYear && <span className="md-meta-item">{pin.visitYear}</span>}
              {hearts && <span className="md-meta-item md-hearts">{hearts}</span>}
            </div>
          </div>

          {/* Companions */}
          {pin.companions && pin.companions.length > 0 && (
            <div className="md-chips-row">
              {pin.companions.map(c => (
                <span key={c} className="md-chip">{c}</span>
              ))}
            </div>
          )}

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

          {/* Add more */}
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
