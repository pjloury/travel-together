import { useState, useRef } from 'react';

const MONTHS = [
  { value: 1,  label: 'January',   abbr: 'JAN' },
  { value: 2,  label: 'February',  abbr: 'FEB' },
  { value: 3,  label: 'March',     abbr: 'MAR' },
  { value: 4,  label: 'April',     abbr: 'APR' },
  { value: 5,  label: 'May',       abbr: 'MAY' },
  { value: 6,  label: 'June',      abbr: 'JUN' },
  { value: 7,  label: 'July',      abbr: 'JUL' },
  { value: 8,  label: 'August',    abbr: 'AUG' },
  { value: 9,  label: 'September', abbr: 'SEP' },
  { value: 10, label: 'October',   abbr: 'OCT' },
  { value: 11, label: 'November',  abbr: 'NOV' },
  { value: 12, label: 'December',  abbr: 'DEC' },
];

export default function MonthPicker({ value, onChange, className = '', autoFocus = false, placeholder = 'Month' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const selected = MONTHS.find(m => m.value === value);

  const filtered = query
    ? MONTHS.filter(m =>
        m.label.toLowerCase().startsWith(query.toLowerCase()) ||
        m.abbr.startsWith(query.toUpperCase())
      )
    : MONTHS;

  function handleFocus() {
    setQuery('');
    setOpen(true);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange(null);
  }

  function handleSelect(month) {
    onChange(month.value);
    setQuery('');
    setOpen(false);
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
    if (e.key === 'Enter' && filtered.length === 1) { handleSelect(filtered[0]); }
  }

  const displayValue = open ? query : (selected?.label || '');

  return (
    <div className={`mp-wrap ${className}`}>
      <input
        ref={inputRef}
        type="text"
        className="tl-input mp-input"
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      {open && (
        <div className="mp-dropdown">
          {filtered.length === 0
            ? <div className="mp-no-match">No match</div>
            : filtered.map(m => (
                <button
                  key={m.value}
                  type="button"
                  className={`mp-option${m.value === value ? ' mp-option-selected' : ''}`}
                  onMouseDown={() => handleSelect(m)}
                >
                  <span className="mp-option-abbr">{m.abbr}</span>
                  {m.label}
                </button>
              ))
          }
        </div>
      )}
    </div>
  );
}
