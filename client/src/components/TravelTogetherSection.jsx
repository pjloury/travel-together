// TravelTogetherSection component - shows shared dream matches with friends.
//
// Spec: docs/app/spec.md Section 4 (Travel Together view)
// @implements REQ-SOCIAL-002, SCN-SOCIAL-002-01

import { useState, useEffect } from 'react';
import api from '../api/client';

/**
 * TravelTogetherSection displays shared dream destinations between the user and friends.
 *
 * @implements REQ-SOCIAL-002 (Travel Together view surfaces shared dream matches)
 * @implements SCN-SOCIAL-002-01 (grouped by region, friend avatars, collapsed by default)
 *
 * Fetches GET /api/social/travel-together on mount.
 * Grouped by region: shows region name as heading, then for each match:
 *   - User's own dream pin card (small)
 *   - "You and [friend names] both dream of this"
 *   - Friend avatars
 * If no matches: section is not rendered at all.
 * Collapsed by default, expandable.
 */
export default function TravelTogetherSection() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchTravelTogether() {
      try {
        const res = await api.get('/social/travel-together');
        const data = res.data || res || [];
        setMatches(Array.isArray(data) ? data : []);
      } catch {
        setMatches([]);
      } finally {
        setLoading(false);
      }
    }

    fetchTravelTogether();
  }, []);

  // Don't show the section at all if no matches or still loading
  if (loading || matches.length === 0) return null;

  return (
    <div className="travel-together-section">
      {/* Collapsed toggle */}
      <button
        className="travel-together-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        {'\uD83C\uDF0D'} {matches.length} destination{matches.length === 1 ? '' : 's'} to explore together {expanded ? '\u25B4' : '\u25BE'}
      </button>

      {expanded && (
        <div className="travel-together-list">
          {matches.map((match, index) => (
            <div key={match.region || index} className="travel-together-match">
              <div className="travel-together-region">{match.region}</div>
              <div className="travel-together-match-body">
                {/* User's own dream pin (small card) */}
                <div className="travel-together-my-pin">
                  <span className="travel-together-pin-name">{match.myPin?.placeName || match.region}</span>
                </div>

                {/* Friend info */}
                <div className="travel-together-friends-info">
                  <p className="travel-together-match-text">
                    You and {match.friends.map(f => f.displayName).join(', ')} both dream of this
                  </p>
                  <div className="travel-together-avatars">
                    {match.friends.map((friend, i) => (
                      <span key={friend.id || i} className="travel-together-avatar" title={friend.displayName}>
                        {friend.avatarUrl ? (
                          <img src={friend.avatarUrl} alt={friend.displayName} className="travel-together-avatar-img" />
                        ) : (
                          <span className="travel-together-avatar-placeholder">
                            {friend.displayName.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
