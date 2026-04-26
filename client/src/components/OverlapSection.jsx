// OverlapSection — shows travel commonalities between you and a friend
// Displayed on a friend's board view

import { useState, useEffect } from 'react';
import api from '../api/client';
import { countryFlag } from '../utils/countryFlag';

const CATEGORY_LABELS = {
  both_visited: { emoji: '🌍', label: 'You\'ve both been to', verb: 'Both visited' },
  both_dream: { emoji: '✨', label: 'You both dream of', verb: 'Both dream of' },
  you_visited_they_dream: { emoji: '🗺️', label: 'You\'ve been — they dream of', verb: 'You visited, they dream of' },
  they_visited_you_dream: { emoji: '💭', label: 'They\'ve been — you dream of', verb: 'They visited, you dream of' },
};

export default function OverlapSection({ friendId, friendName }) {
  const [overlaps, setOverlaps] = useState([]);
  const [sharedTags, setSharedTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!friendId) return;
    async function load() {
      try {
        const res = await api.get(`/social/overlap/${friendId}`);
        const data = res.data || res;
        setOverlaps(data.overlaps || []);
        setSharedTags(data.sharedTags || []);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    load();
  }, [friendId]);

  if (loading) return null;
  if (overlaps.length === 0 && sharedTags.length === 0) return null;

  const firstName = (friendName || 'They').split(' ')[0];

  // Group overlaps by category
  const grouped = {};
  for (const o of overlaps) {
    if (!grouped[o.category]) grouped[o.category] = [];
    grouped[o.category].push(o);
  }

  return (
    <div className="overlap-section">
      <h3 className="overlap-heading">Travel in common</h3>

      {Object.entries(grouped).map(([cat, items]) => {
        const meta = CATEGORY_LABELS[cat] || { emoji: '🌐', label: cat, verb: cat };
        return (
          <div key={cat} className="overlap-group">
            <p className="overlap-group-label">{meta.emoji} {meta.label}</p>
            <div className="overlap-chips">
              {items.map((o, i) => {
                const flag = countryFlag(o.country);
                return (
                  <span key={i} className="overlap-chip">
                    {flag && <span className="overlap-chip-flag">{flag}</span>}
                    {o.country}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}

      {sharedTags.length > 0 && (
        <div className="overlap-group">
          <p className="overlap-group-label">🏷️ Shared travel interests</p>
          <div className="overlap-chips">
            {sharedTags.map(tag => (
              <span key={tag} className="overlap-chip overlap-chip-tag">{tag}</span>
            ))}
          </div>
        </div>
      )}

      <p className="overlap-summary">
        You and {firstName} have {overlaps.length} destination{overlaps.length !== 1 ? 's' : ''} in common
        {sharedTags.length > 0 ? ` and ${sharedTags.length} shared interest${sharedTags.length !== 1 ? 's' : ''}` : ''}
      </p>
    </div>
  );
}
