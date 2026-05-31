// DreamConvertModal — "I went!" dream-to-memory conversion flow.
import { useState } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import Confetti from './Confetti';
import { tagNamesToPayload } from '../utils/tags';

/**
 * DreamConvertModal
 *
 * Flow:
 * 1. choice: voice path or quick-add form
 * 2. quickadd: fill form, save → auto-archives dream
 * 3. celebrate: confetti + "Done" → calls onSaved({ memoryPin, dreamId })
 *
 * @param {{ memoryPin, dreamId }} onSaved
 */
export default function DreamConvertModal({ isOpen, dreamPin, onClose, onVoicePath, onSaved }) {
  const [step, setStep] = useState('choice'); // choice | quickadd | celebrate
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Quick-add form fields, pre-filled from dream pin
  const [placeName, setPlaceName] = useState('');
  const [note, setNote] = useState('');
  const [visitYear, setVisitYear] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  // Full pin object after save — passed to onSaved
  const [celebratePin, setCelebratePin] = useState(null);

  // Reset when modal opens with a new dream pin
  if (isOpen && step === 'choice' && dreamPin && placeName !== dreamPin.placeName) {
    setPlaceName(dreamPin.placeName || '');
    setNote('');
    setVisitYear('');
    setSelectedTags(dreamPin.tags ? dreamPin.tags.map(t => t.name) : []);
    setError('');
  }

  if (!isOpen || !dreamPin) return null;

  function handleVoicePath() {
    if (onVoicePath) onVoicePath(dreamPin);
    handleClose();
  }

  async function handleQuickAddSave() {
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/pins', {
        pinType: 'memory',
        placeName,
        note: note || undefined,
        visitYear: visitYear ? parseInt(visitYear, 10) : undefined,
        tags: tagNamesToPayload(selectedTags),
        convertedFromDreamId: dreamPin?.id,
      });
      const memoryPin = res.data || res;

      // Archive the dream automatically — fire-and-forget, non-blocking
      api.post(`/pins/${dreamPin.id}/convert`, { keepDream: false }).catch(() => {});

      setCelebratePin(memoryPin);
      setStep('celebrate');
    } catch (err) {
      setError(err.message || 'Could not save memory. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleDone() {
    if (onSaved) onSaved({ memoryPin: celebratePin, dreamId: dreamPin?.id });
    handleClose();
  }

  function handleClose() {
    setStep('choice');
    setCelebratePin(null);
    setError('');
    onClose();
  }

  return (
    <div className="dream-convert-overlay" onClick={step === 'celebrate' ? undefined : handleClose}>
      <div className="dream-convert-card" onClick={e => e.stopPropagation()}>

        {/* Confetti fires during the celebrate step */}
        <Confetti active={step === 'celebrate'} />

        {/* Step 1: Choice */}
        {step === 'choice' && (
          <>
            <button className="dream-convert-close-btn" onClick={handleClose}>&times;</button>
            <div className="dream-convert-choice">
              <div className="dream-convert-choice-icon">✈️</div>
              <h2 className="dream-convert-heading">You went to {dreamPin.placeName}!</h2>
              <p className="dream-convert-sub">How would you like to log this memory?</p>
              <div className="dream-convert-options">
                <button className="dream-convert-opt dream-convert-opt-voice" onClick={handleVoicePath}>
                  🎙 Tell it as a story
                </button>
                <button className="dream-convert-opt dream-convert-opt-quick" onClick={() => setStep('quickadd')}>
                  ✏️ Quick add
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2: Quick-add form */}
        {step === 'quickadd' && (
          <>
            <button className="dream-convert-close-btn" onClick={handleClose}>&times;</button>
            <h2 className="dream-convert-heading">Log the memory</h2>

            <div className="dream-convert-field">
              <label className="dream-convert-label">Destination</label>
              <input
                className="dream-convert-input"
                type="text"
                value={placeName}
                onChange={e => setPlaceName(e.target.value)}
                placeholder="Where did you go?"
                autoFocus
              />
            </div>

            <div className="dream-convert-field">
              <label className="dream-convert-label">Short note (optional)</label>
              <input
                className="dream-convert-input"
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="What was it like?"
              />
            </div>

            <div className="dream-convert-field">
              <label className="dream-convert-label">Year visited (optional)</label>
              <input
                className="dream-convert-input"
                type="number"
                value={visitYear}
                onChange={e => setVisitYear(e.target.value)}
                placeholder={new Date().getFullYear()}
              />
            </div>

            <div className="dream-convert-field">
              <label className="dream-convert-label">Tags</label>
              <TagPicker selectedTags={selectedTags} onTagsChange={setSelectedTags} maxTags={3} />
            </div>

            {error && <p className="dream-convert-error">{error}</p>}

            <div className="dream-convert-actions">
              <button className="dream-convert-btn-back" onClick={() => setStep('choice')}>Back</button>
              <button
                className="dream-convert-btn-save"
                onClick={handleQuickAddSave}
                disabled={saving || !placeName.trim()}
              >
                {saving ? 'Saving…' : 'Save Memory'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Celebrate */}
        {step === 'celebrate' && (
          <div className="dream-convert-celebrate">
            <div className="dream-convert-celebrate-emoji">🎉</div>
            <h2 className="dream-convert-heading">Dream achieved!</h2>
            <p className="dream-convert-sub">
              <strong>{celebratePin?.placeName || dreamPin.placeName}</strong> is now in your memories.
            </p>
            <button className="dream-convert-btn-done" onClick={handleDone}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
