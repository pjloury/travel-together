// Empty-state companion for the FUTURE tab: when the user has no
// dream pins yet, fetch a few personalized destinations from the
// curator's /explore/trips endpoint and offer one-tap "Add to dreams"
// for each. Rendered as a sibling of PinBoard's empty state so the
// existing "Pin your first dream" CTA stays available below.
//
// This intentionally uses /api/explore/trips/personalized rather than
// the Anthropic-backed /api/insights/discover endpoint — the curated
// trip list is fast, cached, and doesn't consume AI budget on every
// empty FUTURE-tab visit.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function EmptyFutureSuggestions({ onAdded }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null); // tripId being added
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/explore/trips/personalized');
      const list = res.trips || res.data?.trips || res.data || [];
      setTrips(list.slice(0, 3));
    } catch (err) {
      setError(err?.message || 'Could not load suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(trip) {
    setAdding(trip.id);
    try {
      const placeName = trip.country
        ? `${trip.city}, ${trip.country}`
        : trip.city || trip.title;
      await api.post('/pins', {
        pinType: 'dream',
        placeName,
        dreamNote: trip.description || trip.title || '',
        unsplashImageUrl: trip.image_url || trip.imageUrl || null,
      });
      if (onAdded) onAdded();
    } catch {
      // Silent — keep the row in place so the user can retry.
    } finally {
      setAdding(null);
    }
  }

  if (loading) {
    return (
      <div className="empty-future-suggestions empty-future-suggestions-loading">
        Looking for places you might love…
      </div>
    );
  }
  if (error || trips.length === 0) {
    // No discovery → don't render. PinBoard's empty state still shows.
    return null;
  }

  return (
    <div className="empty-future-suggestions">
      <div className="empty-future-suggestions-header">
        <h3 className="empty-future-suggestions-title">Places you might love</h3>
        <button
          className="empty-future-suggestions-more"
          onClick={() => navigate('/discover')}
        >
          See all in Discover →
        </button>
      </div>
      <div className="empty-future-suggestions-grid">
        {trips.map(trip => (
          <div key={trip.id} className="empty-future-suggestion-card">
            {trip.image_url || trip.imageUrl ? (
              <div
                className="empty-future-suggestion-img"
                style={{ backgroundImage: `url(${trip.image_url || trip.imageUrl})` }}
              />
            ) : (
              <div className="empty-future-suggestion-img empty-future-suggestion-img-fallback">
                <span>✦</span>
              </div>
            )}
            <div className="empty-future-suggestion-body">
              <h4 className="empty-future-suggestion-title">
                {trip.city || trip.title}
                {trip.country && <span className="empty-future-suggestion-country"> · {trip.country}</span>}
              </h4>
              {trip.description && (
                <p className="empty-future-suggestion-desc">{trip.description}</p>
              )}
              <button
                className="empty-future-suggestion-add"
                onClick={() => handleAdd(trip)}
                disabled={adding === trip.id}
              >
                {adding === trip.id ? 'Adding…' : '+ Add to dreams'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
