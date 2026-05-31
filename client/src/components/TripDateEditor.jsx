// Lightweight modal for editing just the month + year of an existing trip
import { useState } from 'react';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);
const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

export default function TripDateEditor({ log, onClose, onSave }) {
  const [month, setMonth] = useState(log.visitMonth || '');
  const [year, setYear] = useState(log.visitYear || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave({
        visitMonth: month ? parseInt(month) : null,
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

        <div className="tl-date-editor-fields">
          <label className="tl-label tl-label-half">
            Month
            <select
              className="tl-input"
              value={month}
              onChange={e => setMonth(e.target.value)}
              autoFocus
            >
              <option value="">Unknown</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="tl-label tl-label-half">
            Year
            <select
              className="tl-input"
              value={year}
              onChange={e => setYear(e.target.value)}
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
            type="button"
            className="tl-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </div>
    </div>
  );
}
