// DiscoveryCard — "last card" in the dreams grid.
// Idle: shows a prompt to discover a new dream destination.
// Loading: spinner while AI generates a suggestion.
// Showing: suggested destination with Accept / Try Another / Discover More CTAs.

import { useState, useCallback } from 'react';
import api from '../api/client';

export default function DiscoveryCard({ onDreamAdded, onDiscoverMore }) {
  const [phase, setPhase] = useState('idle'); // idle | loading | showing | accepting
  const [suggestion, setSuggestion] = useState(null); // { placeName, dreamNote, unsplashImageUrl, unsplashAttribution }
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const fetchSuggestion = useCallback(async () => {
    setError('');
    setPhase('loading');
    try {
      const res = await api.post('/explore/suggest-dream');
      setSuggestion(res.data);
      setPhase('showing');
    } catch {
      setError('Could not generate a suggestion. Try again.');
      setPhase('idle');
    }
  }, []);

  async function handleAccept() {
    if (!suggestion) return;
    setPhase('accepting');
    try {
      const payload = {
        pinType: 'dream',
        placeName: suggestion.placeName,
        dreamNote: suggestion.dreamNote || '',
        aiSummary: suggestion.dreamNote || '',
        unsplashImageUrl: suggestion.unsplashImageUrl || null,
        unsplashAttribution: suggestion.unsplashAttribution || null,
      };
      const res = await api.post('/pins', payload);
      const newPin = res.data?.pin || res.data;
      if (onDreamAdded) onDreamAdded(newPin);
      setFlash(`${suggestion.placeName} added to your dreams!`);
      setSuggestion(null);
      setPhase('idle');
      setTimeout(() => setFlash(''), 3500);
    } catch {
      setError('Could not save dream. Try again.');
      setPhase('showing');
    }
  }

  function handleTryAnother() {
    setSuggestion(null);
    fetchSuggestion();
  }

  // ── Idle ──
  if (phase === 'idle') {
    return (
      <div className="discovery-card discovery-card-idle" onClick={fetchSuggestion} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fetchSuggestion(); }}>
        <div className="discovery-card-inner">
          <span className="discovery-card-sparkle">✦</span>
          <p className="discovery-card-prompt">Discover a dream</p>
          <p className="discovery-card-sub">Tap for an AI-suggested destination</p>
          {error && <p className="discovery-card-error">{error}</p>}
          {flash && <p className="discovery-card-flash">{flash}</p>}
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (phase === 'loading') {
    return (
      <div className="discovery-card discovery-card-loading">
        <div className="discovery-card-inner">
          <div className="loading-spinner-sm" />
          <p className="discovery-card-sub" style={{ marginTop: 12 }}>Finding your next dream…</p>
        </div>
      </div>
    );
  }

  // ── Showing / Accepting ──
  const accepting = phase === 'accepting';
  return (
    <div className="discovery-card discovery-card-showing">
      {suggestion?.unsplashImageUrl ? (
        <img
          className="discovery-card-img"
          src={suggestion.unsplashImageUrl}
          alt={suggestion.placeName}
        />
      ) : (
        <div className="discovery-card-img-placeholder" />
      )}
      <div className="discovery-card-body">
        <p className="discovery-card-place">{suggestion?.placeName}</p>
        {suggestion?.dreamNote && (
          <p className="discovery-card-note">{suggestion.dreamNote}</p>
        )}
        {error && <p className="discovery-card-error">{error}</p>}
        <div className="discovery-card-actions">
          <button
            className="discovery-card-btn discovery-card-btn-accept"
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? '…' : 'Add to dreams'}
          </button>
          <button
            className="discovery-card-btn discovery-card-btn-retry"
            onClick={handleTryAnother}
            disabled={accepting}
          >
            Try another
          </button>
          <button
            className="discovery-card-btn discovery-card-btn-more"
            onClick={onDiscoverMore}
            disabled={accepting}
          >
            Explore more
          </button>
        </div>
      </div>
    </div>
  );
}
