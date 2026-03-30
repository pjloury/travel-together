// MemoryDetail component - modal/sheet for viewing a memory pin in detail.
//
// Spec: Manager assignment, item 5
// Contract: none (new component)

import { useState } from 'react';
import api from '../api/client';

/**
 * MemoryDetail displays a memory pin in a slide-up sheet (mobile) / centered modal (desktop).
 *
 * @param {Object} props
 * @param {Object} props.pin - The memory pin to display
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Close the modal
 * @param {function} props.onUpdated - Callback after pin is updated
 */
export default function MemoryDetail({ pin, isOpen, onClose, onUpdated }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showAddMore, setShowAddMore] = useState(false);
  const [addition, setAddition] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !pin) return null;

  // Parse summary: check if it looks like a bullet list (starts with bullet char)
  const summaryBullets = parseSummary(pin.aiSummary);

  async function handleSaveAddition() {
    if (!addition.trim()) return;
    setSaving(true);
    setError('');
    try {
      const existingNote = pin.note || '';
      const updatedNote = existingNote
        ? existingNote + '\n\n' + addition.trim()
        : addition.trim();
      await api.put(`/pins/${pin.id}`, { note: updatedNote });
      setSaving(false);
      setAddition('');
      setShowAddMore(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="memory-detail-overlay" onClick={onClose}>
      <style>{`
        .memory-detail-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        @media (min-width: 768px) {
          .memory-detail-overlay {
            align-items: center;
          }
        }
        .memory-detail-sheet {
          background: var(--bg-card);
          border-radius: 16px 16px 0 0;
          width: 100%;
          max-width: 520px;
          max-height: 85vh;
          overflow-y: auto;
          padding: 24px;
          position: relative;
          animation: slideUp 0.25s ease-out;
        }
        @media (min-width: 768px) {
          .memory-detail-sheet {
            border-radius: 16px;
            max-height: 90vh;
          }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .memory-detail-close {
          position: absolute;
          top: 12px;
          right: 16px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 24px;
          cursor: pointer;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .memory-detail-place {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
          padding-right: 40px;
        }
        .memory-detail-companions {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }
        .memory-detail-companion-chip {
          padding: 4px 12px;
          border-radius: 16px;
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-size: 13px;
          border: 1px solid var(--border);
        }
        .memory-detail-summary {
          margin-bottom: 16px;
        }
        .memory-detail-summary ul {
          list-style: disc;
          padding-left: 20px;
          color: var(--text-primary);
          font-size: 15px;
          line-height: 1.6;
        }
        .memory-detail-summary ul li {
          margin-bottom: 4px;
        }
        .memory-detail-summary p {
          color: var(--text-primary);
          font-size: 15px;
          line-height: 1.6;
        }
        .memory-detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 16px;
        }
        .memory-detail-tag {
          padding: 4px 12px;
          border-radius: 16px;
          background: rgba(0, 212, 170, 0.15);
          color: var(--accent);
          font-size: 13px;
          border: 1px solid rgba(0, 212, 170, 0.3);
        }
        .memory-detail-meta {
          display: flex;
          gap: 16px;
          align-items: center;
          margin-bottom: 16px;
          color: var(--text-secondary);
          font-size: 14px;
        }
        .memory-detail-hearts {
          font-size: 16px;
          letter-spacing: 2px;
        }
        .memory-detail-transcript-toggle {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 13px;
          cursor: pointer;
          padding: 8px 0;
          text-decoration: underline;
        }
        .memory-detail-transcript {
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 12px;
          margin-top: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .memory-detail-add-btn {
          width: 100%;
          padding: 12px;
          border-radius: 8px;
          border: 1px dashed var(--border);
          background: transparent;
          color: var(--text-secondary);
          font-size: 15px;
          cursor: pointer;
          margin-top: 12px;
          transition: all 0.2s;
        }
        .memory-detail-add-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .memory-detail-add-area {
          margin-top: 12px;
        }
        .memory-detail-add-textarea {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg-dark);
          border: 1px solid var(--border);
          border-radius: 8px;
          color: var(--text-primary);
          font-size: 15px;
          resize: vertical;
          font-family: inherit;
          box-sizing: border-box;
        }
        .memory-detail-add-textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .memory-detail-save-addition {
          margin-top: 8px;
          padding: 10px 20px;
          background: var(--accent);
          color: var(--bg-dark);
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          min-height: 44px;
        }
        .memory-detail-save-addition:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .memory-detail-error {
          color: var(--error);
          font-size: 14px;
          margin-top: 8px;
        }
        .memory-detail-note {
          background: var(--bg-tertiary);
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .memory-detail-note-label {
          font-size: 12px;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 6px;
        }
      `}</style>
      <div className="memory-detail-sheet" onClick={(e) => e.stopPropagation()}>
        <button className="memory-detail-close" onClick={onClose}>&times;</button>

        {/* Place name */}
        <h2 className="memory-detail-place">{pin.placeName}</h2>

        {/* Companion chips (read-only) */}
        {pin.companions && pin.companions.length > 0 && (
          <div className="memory-detail-companions">
            {pin.companions.map(c => (
              <span key={c} className="memory-detail-companion-chip">{c}</span>
            ))}
          </div>
        )}

        {/* Summary */}
        {pin.aiSummary && (
          <div className="memory-detail-summary">
            {summaryBullets ? (
              <ul>
                {summaryBullets.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>{pin.aiSummary}</p>
            )}
          </div>
        )}

        {/* Tags */}
        {pin.tags && pin.tags.length > 0 && (
          <div className="memory-detail-tags">
            {pin.tags.map(t => (
              <span key={t.id || t.name} className="memory-detail-tag">
                {t.emoji ? `${t.emoji} ` : ''}{t.name}
              </span>
            ))}
          </div>
        )}

        {/* Year + Rating */}
        <div className="memory-detail-meta">
          {pin.visitYear && <span>{pin.visitYear}</span>}
          {pin.rating && pin.rating > 0 && (
            <span className="memory-detail-hearts">
              {Array.from({ length: pin.rating }, () => '\u2764\uFE0F').join('')}
            </span>
          )}
        </div>

        {/* Note */}
        {pin.note && (
          <div>
            <div className="memory-detail-note-label">Notes</div>
            <div className="memory-detail-note">{pin.note}</div>
          </div>
        )}

        {/* Transcript (collapsible) */}
        {pin.transcript && (
          <div>
            <button
              className="memory-detail-transcript-toggle"
              onClick={() => setShowTranscript(!showTranscript)}
            >
              {showTranscript ? 'Hide full transcript' : 'Show full transcript'}
            </button>
            {showTranscript && (
              <div className="memory-detail-transcript">{pin.transcript}</div>
            )}
          </div>
        )}

        {/* Add more to this memory */}
        {!showAddMore ? (
          <button
            className="memory-detail-add-btn"
            onClick={() => setShowAddMore(true)}
          >
            Add more to this memory
          </button>
        ) : (
          <div className="memory-detail-add-area">
            <textarea
              className="memory-detail-add-textarea"
              value={addition}
              onChange={(e) => setAddition(e.target.value)}
              placeholder="Add more details, memories, or thoughts..."
              rows={3}
              autoFocus
            />
            <button
              className="memory-detail-save-addition"
              onClick={handleSaveAddition}
              disabled={!addition.trim() || saving}
            >
              {saving ? 'Saving...' : 'Save addition'}
            </button>
            {error && <p className="memory-detail-error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Parse an aiSummary string to see if it's a bullet list.
 * Returns array of bullet strings, or null if it's a plain paragraph.
 */
function parseSummary(aiSummary) {
  if (!aiSummary) return null;
  // Check if it starts with a bullet character
  const lines = aiSummary.split('\n').map(l => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(l => l.startsWith('\u2022') || l.startsWith('-') || l.startsWith('*'));
  if (bulletLines.length >= 2) {
    return bulletLines.map(l => l.replace(/^[\u2022\-*]\s*/, ''));
  }
  return null;
}
