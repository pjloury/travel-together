// TripMergePicker — shown when a logged-in user clicks "I've been to {city}"
// on a Discover trip detail panel. Asks which existing memory pin (if any)
// they want to merge the curated trip's tags / photo / note into.
//
// Behavior:
//   - "Create a new memory" → caller's onCreateNew(): same as the previous
//     direct-create flow.
//   - Pick an existing pin → caller's onMerge(pin): merge the trip's tags
//     (union), note (appended only if absent), and cover photo (set only if
//     the existing pin has no photo) into that pin via PUT /pins/:id.
//
// Pins are listed with the trip's country first so the relevant memory is
// at the top of the list — the user picks the judgment-call themselves.

import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';

export default function TripMergePicker({ trip, onClose, onCreateNew, onMerge }) {
  const [pins, setPins] = useState(null); // null = loading, [] = none
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/pins?type=memory&limit=200');
        if (cancelled) return;
        const data = res.data?.pins || res.pins || res.data || [];
        setPins(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError('Could not load your memories.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Surface pins from the same country first, then everything else.
  const ranked = useMemo(() => {
    if (!Array.isArray(pins)) return [];
    const tripCountry = (trip?.country || '').toLowerCase().trim();
    const sameCountry = [];
    const rest = [];
    for (const p of pins) {
      const c = (p.normalizedCountry || p.normalized_country || '').toLowerCase().trim();
      (c && c === tripCountry ? sameCountry : rest).push(p);
    }
    return [...sameCountry, ...rest];
  }, [pins, trip]);

  async function handlePick(pin) {
    if (working) return;
    setWorking(true);
    try {
      await onMerge(pin);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <div className="merge-picker-backdrop" onClick={onClose} />
      <div className="merge-picker">
        <div className="merge-picker-header">
          <h2 className="merge-picker-title">I&rsquo;ve been to {trip?.city || 'this place'}</h2>
          <button className="merge-picker-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="merge-picker-sub">
          Add this to a trip you already remember, or save it as a new memory.
        </p>

        <button
          className="merge-picker-new"
          onClick={onCreateNew}
          disabled={working}
        >
          ✦ Create a new memory
        </button>

        <div className="merge-picker-divider"><span>or merge into</span></div>

        {pins === null && (
          <div className="merge-picker-loading">Loading your memories…</div>
        )}
        {error && (
          <div className="merge-picker-error">{error}</div>
        )}
        {pins !== null && pins.length === 0 && !error && (
          <div className="merge-picker-empty">
            You don&rsquo;t have any memories yet — create a new one above.
          </div>
        )}

        {ranked.length > 0 && (
          <div className="merge-picker-list">
            {ranked.map(pin => {
              const placeLine = [
                pin.normalizedCity || pin.normalized_city,
                pin.normalizedCountry || pin.normalized_country,
              ].filter(Boolean).join(', ');
              const sameCountry = (pin.normalizedCountry || pin.normalized_country || '')
                .toLowerCase().trim() === (trip?.country || '').toLowerCase().trim();
              return (
                <button
                  key={pin.id}
                  type="button"
                  className="merge-picker-row"
                  disabled={working}
                  onClick={() => handlePick(pin)}
                >
                  <div className="merge-picker-row-place">
                    {pin.placeName || pin.place_name}
                    {sameCountry && <span className="merge-picker-row-badge">same country</span>}
                  </div>
                  {placeLine && (
                    <div className="merge-picker-row-meta">{placeLine}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
