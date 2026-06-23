import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

const ICONS = {
  national_park: '🏞️',
  ski_resort: '🎿',
};

export default function VenuePicker({ type, value = [], onChange, readOnly = false }) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const debounceRef = useRef(null);
  const icon = ICONS[type] || '📍';

  useEffect(() => {
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/venues', { params: { type, q: input } });
        const results = (res.data?.data || []).filter(
          v => !value.some(sel => sel.id === v.id)
        );
        setSuggestions(results);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [input, type, value]);

  function handleSelect(venue) {
    onChange([...value, venue]);
    setInput('');
    setSuggestions([]);
    setHighlightedIndex(-1);
  }

  function handleRemove(id) {
    onChange(value.filter(v => v.id !== id));
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
      if (suggestions[idx]) handleSelect(suggestions[idx]);
    } else if (e.key === 'Escape') {
      setInput('');
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  }

  return (
    <div className="md-picker-section">
      <p className="md-section-label" style={{ marginBottom: 8 }}>
        {icon} {type === 'national_park' ? 'National Parks' : 'Ski Resorts'}
      </p>
      {value.length > 0 && (
        <div className="md-chip-list">
          {value.map(v => (
            <span key={v.id} className="md-picker-chip">
              {icon} {v.name}
              {!readOnly && (
                <button
                  type="button"
                  className="md-picker-chip-remove"
                  onClick={() => handleRemove(v.id)}
                  title="Remove"
                >×</button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && value.length === 0 && (
        <p style={{ fontSize: 12, color: 'rgba(250,250,250,0.3)', marginBottom: 8 }}>
          No {type === 'national_park' ? 'parks' : 'resorts'} yet — type to add one
        </p>
      )}
      {!readOnly && (
        <div className="md-picker-input-wrap">
          <input
            type="text"
            className="md-picker-input"
            placeholder={`Search ${type === 'national_park' ? 'parks' : 'resorts'}…`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <div className="md-picker-dropdown">
              {suggestions.map((v, i) => (
                <div
                  key={v.id}
                  className={`md-picker-option${i === highlightedIndex ? ' md-picker-option-highlighted' : ''}`}
                  onMouseDown={e => { e.preventDefault(); handleSelect(v); }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                >
                  <span className="md-picker-option-flag">{icon}</span>
                  <span>
                    {v.name}
                    {v.region && <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 6 }}>{v.region}, {v.country}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
