// DreamConvertModal component - "I went!" dream-to-memory conversion flow.
//
// Spec: docs/app/spec.md Section 4, Dream Conversion Endpoint
// @implements REQ-DREAM-005, SCN-DREAM-005-01, SCN-DREAM-005-02

import { useState } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';

/**
 * DreamConvertModal shows the "I went!" conversion flow for a dream pin.
 *
 * @implements REQ-DREAM-005 ("I went!" converts dream to memory)
 * @implements SCN-DREAM-005-01 (two choices: voice or quick-add)
 * @implements SCN-DREAM-005-02 (after save: keep dream or mark as visited/archived)
 *
 * Flow:
 * 1. Choice modal: "Tell me about it" (voice) or "Quick add" (form)
 * 2a. Voice path: opens VoiceCapture pre-seeded
 * 2b. Quick add path: shows inline form pre-filled from dream pin
 * 3. After memory saved: "Keep as dream or mark as visited?"
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object} props.dreamPin - The dream pin being converted
 * @param {function} props.onClose
 * @param {function} props.onOpenVoiceCapture - Open VoiceCapture modal with pre-seed data
 * @param {function} props.onSaved - Callback after full conversion flow completes
 */
export default function DreamConvertModal({ isOpen, dreamPin, onClose, onOpenVoiceCapture, onVoicePath, onSaved }) {
  const [step, setStep] = useState('choice'); // choice | quickadd | keepOrArchive
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick-add form fields, pre-filled from dream pin
  const [placeName, setPlaceName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [note, setNote] = useState('');
  const [visitYear, setVisitYear] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Track the newly created memory pin ID for the keep/archive step
  const [newMemoryId, setNewMemoryId] = useState(null);

  // Reset state when opened
  if (isOpen && step === 'choice' && dreamPin && placeName !== dreamPin.placeName) {
    setPlaceName(dreamPin.placeName || '');
    setPhotoUrl('');
    setNote('');
    setVisitYear('');
    setSelectedTags(dreamPin.tags ? dreamPin.tags.map(t => t.name) : []);
    setError('');
  }

  if (!isOpen || !dreamPin) return null;

  function handleVoicePath() {
    // Notify parent that voice path was chosen for this dream pin.
    // Parent (BoardView) will handle opening VoiceCapture and showing
    // the keep/archive follow-up after voice save completes.
    if (onVoicePath) {
      onVoicePath(dreamPin);
    }
    handleClose();
  }

  async function handleQuickAddSave() {
    setSaving(true);
    setError('');
    try {
      const tagPayload = tagNamesToPayload(selectedTags);
      const res = await api.post('/pins', {
        pinType: 'memory',
        placeName: placeName,
        photoUrl: photoUrl || undefined,
        note: note || undefined,
        visitYear: visitYear ? parseInt(visitYear, 10) : undefined,
        tags: tagPayload,
      });
      setNewMemoryId(res.data?.id || res.id);
      setStep('keepOrArchive');
    } catch (err) {
      setError(err.message || 'Could not save memory. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleKeepDream() {
    // Keep as dream - nothing changes on the dream pin
    if (onSaved) onSaved();
    handleClose();
  }

  async function handleMarkAsVisited() {
    // Mark dream as visited (archived) via convert endpoint
    // @implements SCN-DREAM-005-02
    try {
      await api.post(`/pins/${dreamPin.id}/convert`, { keepDream: false });
    } catch {
      // Silently handle - the memory was already created
    }
    if (onSaved) onSaved();
    handleClose();
  }

  function handleClose() {
    setStep('choice');
    setNewMemoryId(null);
    setError('');
    onClose();
  }

  return (
    <div className="dream-convert-modal">
      <div className="dream-convert-content">
        <button className="dream-convert-close" onClick={handleClose}>&times;</button>

        {/* Step 1: Choice */}
        {step === 'choice' && (
          <div className="dream-convert-choice">
            <h2 className="dream-convert-title">You went to {dreamPin.placeName}!</h2>
            <p className="dream-convert-subtitle">How would you like to add this memory?</p>
            <div className="dream-convert-options">
              <button className="dream-convert-option-btn dream-convert-voice" onClick={handleVoicePath}>
                {'\uD83C\uDF99\uFE0F'} Tell me about it
              </button>
              <button className="dream-convert-option-btn dream-convert-quick" onClick={() => setStep('quickadd')}>
                {'\u270F\uFE0F'} Quick add
              </button>
            </div>
          </div>
        )}

        {/* Step 2b: Quick add form */}
        {step === 'quickadd' && (
          <div className="dream-convert-quickadd">
            <h2 className="dream-convert-title">Quick Add Memory</h2>

            <div className="dream-convert-field">
              <label>Destination</label>
              <input
                type="text"
                value={placeName}
                onChange={e => setPlaceName(e.target.value)}
                placeholder="Where did you go?"
              />
            </div>

            <div className="dream-convert-field">
              <label>Photo URL (optional)</label>
              <input
                type="text"
                value={photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="dream-convert-field">
              <label>Short note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="What was it like?"
              />
            </div>

            <div className="dream-convert-field">
              <label>Year visited (optional)</label>
              <input
                type="number"
                value={visitYear}
                onChange={e => setVisitYear(e.target.value)}
                placeholder="2026"
              />
            </div>

            <div className="dream-convert-field">
              <label>Tags</label>
              <TagPicker selectedTags={selectedTags} onChange={setSelectedTags} />
            </div>

            {error && <p className="dream-convert-error">{error}</p>}

            <div className="dream-convert-actions">
              <button className="dream-convert-back" onClick={() => setStep('choice')}>Back</button>
              <button
                className="dream-convert-save"
                onClick={handleQuickAddSave}
                disabled={saving || !placeName.trim()}
              >
                {saving ? 'Saving...' : 'Save Memory'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Keep or archive dream */}
        {/* @implements SCN-DREAM-005-02 */}
        {step === 'keepOrArchive' && (
          <div className="dream-convert-keep">
            <h2 className="dream-convert-title">Memory saved!</h2>
            <p className="dream-convert-subtitle">Keep as dream or mark as visited?</p>
            <div className="dream-convert-options">
              <button className="dream-convert-option-btn dream-convert-keep-btn" onClick={handleKeepDream}>
                Keep as dream
              </button>
              <button className="dream-convert-option-btn dream-convert-archive-btn" onClick={handleMarkAsVisited}>
                Mark as visited
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
