// Lightweight modal for editing just the month + year of an existing trip
import { useState } from 'react';
import MonthPicker from './MonthPicker';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);

export default function TripDateEditor({ log, onClose, onSave }) {
  const [month, setMonth] = useState(log.visitMonth || null);
  const [year, setYear] = useState(log.visitYear || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const noMonth = !log.visitMonth;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave({
        visitMonth: month || null,
        visitYear: year ? parseInt(year) : null,
      });
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save. Try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="tl-date-editor" onClick={e => e.stopPropagation()}>
        <div className="tl-date-editor-header">
          <p className="tl-date-editor-place">{log.placeName}</p>
          <button type="button" className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="tl-date-editor-fields">
            <label className="tl-label tl-label-half">
              Month
              <MonthPicker
                value={month}
                onChange={setMonth}
                autoFocus={noMonth}
              />
            </label>
            <label className="tl-label tl-label-half">
              Year
              <select
                className="tl-input"
                value={year}
                onChange={e => setYear(e.target.value)}
                autoFocus={!noMonth}
              >
                <option value="">Unknown</option>
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="tl-error" style={{ margin: '0 1.25rem 0.5rem' }}>{error}</p>}

          <div className="tl-date-editor-footer">
            <button type="button" className="tl-btn-secondary" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="tl-btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
