import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

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

export default function MonthPicker({ value, onChange, autoFocus = false, placeholder = 'Month' }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = MONTHS.find(m => m.value === value);

  const filtered = query
    ? MONTHS.filter(m =>
        m.label.toLowerCase().startsWith(query.toLowerCase()) ||
        m.abbr.startsWith(query.toUpperCase())
      )
    : MONTHS;

  // Keep activeIndex in range when filtered list changes
  useEffect(() => {
    setActiveIndex(i => Math.min(i, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('.mp-option-active');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function openDropdown() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
    setOpen(true);
    setActiveIndex(0);
  }

  function handleFocus() {
    setQuery('');
    openDropdown();
  }

  function handleChange(e) {
    setQuery(e.target.value);
    openDropdown();
    if (!e.target.value) onChange(null);
  }

  function select(month) {
    onChange(month.value);
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    // Blur so the next Enter goes to the form (Update button)
    inputRef.current?.blur();
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150);
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIndex] ?? (filtered.length === 1 ? filtered[0] : null);
      if (target) select(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const displayValue = open ? query : (selected?.label || '');

  const dropdown = open && createPortal(
    <div className="mp-dropdown" style={dropdownStyle} ref={listRef}>
      {filtered.length === 0
        ? <div className="mp-no-match">No match</div>
        : filtered.map((m, i) => (
            <button
              key={m.value}
              type="button"
              className={`mp-option${i === activeIndex ? ' mp-option-active' : ''}${m.value === value ? ' mp-option-selected' : ''}`}
              onMouseDown={() => select(m)}
            >
              {m.label}
            </button>
          ))
      }
    </div>,
    document.body
  );

  return (
    <div className="mp-wrap">
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
      {dropdown}
    </div>
  );
}
