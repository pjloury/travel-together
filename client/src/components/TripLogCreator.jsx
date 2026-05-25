// Trip log creation modal — lightweight form for logging a casual trip
import { useState } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);
const MONTH_OPTIONS = [
  { value: '', label: 'Unknown month' },
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function TripLogCreator({ isOpen, onClose, onSaved }) {
  const [placeName, setPlaceName] = useState('');
  const [visitYear, setVisitYear] = useState(CURRENT_YEAR);
  const [visitMonth, setVisitMonth] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setPlaceName('');
    setVisitYear(CURRENT_YEAR);
    setVisitMonth('');
    setNote('');
    setRating(null);
    setSelectedTags([]);
    setError(null);
    setSaving(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSave() {
    if (!placeName.trim()) {
      setError('Place name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tags = tagNamesToPayload(selectedTags);
      const result = await api.post('/trip-logs', {
        placeName: placeName.trim(),
        visitYear: visitYear || null,
        visitMonth: visitMonth || null,
        note: note.trim() || null,
        rating: rating || null,
        tags,
      });
      reset();
      onSaved(result.data);
    } catch (err) {
      setError(err.message || 'Failed to save trip log');
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="trip-log-creator" onClick={e => e.stopPropagation()}>
        <div className="trip-log-creator-header">
          <h2>Log a Trip</h2>
          <button className="modal-close-btn" onClick={handleClose} type="button">✕</button>
        </div>

        <div className="trip-log-creator-body">
          <label className="tl-label">
            Where did you go?
            <input
              className="tl-input"
              type="text"
              placeholder="San Diego, CA"
              value={placeName}
              onChange={e => setPlaceName(e.target.value)}
              autoFocus
            />
          </label>

          <div className="tl-row">
            <label className="tl-label tl-label-half">
              Month
              <select
                className="tl-input"
                value={visitMonth}
                onChange={e => setVisitMonth(e.target.value ? parseInt(e.target.value) : '')}
              >
                {MONTH_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="tl-label tl-label-half">
              Year
              <select
                className="tl-input"
                value={visitYear}
                onChange={e => setVisitYear(parseInt(e.target.value))}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <label className="tl-label">
            What made it memorable?
            <textarea
              className="tl-input tl-textarea"
              placeholder="A quick note about this trip…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </label>

          <div className="tl-label">
            Tags
            <TagPicker
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              maxTags={3}
            />
          </div>

          <div className="tl-label">
            Rating
            <div className="tl-rating-row">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`tl-rating-btn${rating >= n ? ' tl-rating-btn-active' : ''}`}
                  onClick={() => setRating(rating === n ? null : n)}
                >
                  ❤️
                </button>
              ))}
            </div>
          </div>

          {error && <p className="tl-error">{error}</p>}
        </div>

        <div className="trip-log-creator-footer">
          <button className="tl-btn-secondary" onClick={handleClose} type="button">Cancel</button>
          <button
            className="tl-btn-primary"
            onClick={handleSave}
            disabled={saving || !placeName.trim()}
            type="button"
          >
            {saving ? 'Saving…' : 'Save Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
