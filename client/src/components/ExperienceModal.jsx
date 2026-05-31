// Shared modal for a single curated experience.
// Used by both SeasonalExplorer (grid) and SeasonalMap.
import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export const CATEGORY_COLORS = {
  'Festivals & Events':    '#DC143C',
  'Food & Drink':          '#D2691E',
  'Nature & Wildlife':     '#4A7C23',
  'Hiking & Adventure':    '#8B5000',
  'Beach & Water':         '#1A8FBF',
  'Architecture & Streets':'#7A7A7A',
  'Culture & History':     '#9B4B8A',
  'Wellness & Slow':       '#5B8A72',
};
const DEFAULT_COLOR = '#B7893A';

export function categoryColor(exp) {
  return CATEGORY_COLORS[exp.categories?.[0]] || DEFAULT_COLOR;
}

export default function ExperienceModal({ exp, onClose, favored, onToggleFav }) {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleAddToDreams() {
    if (!user || adding) return;
    setAdding(true);
    try {
      await api.post('/pins', {
        pinType: 'dream',
        placeName: `${exp.name}, ${exp.city}`,
        dreamNote: exp.description || '',
        tags: exp.categories || [],
        unsplashImageUrl: exp.imageUrl || null,
        unsplashAttribution: exp.imageUrl ? 'Photo from Unsplash' : null,
      });
      showToast(`✓ "${exp.name}" added to your dreams`);
    } catch {
      showToast('Could not add — try again');
    } finally {
      setAdding(false);
    }
  }

  const months = exp.months?.length
    ? exp.months.map(m => MONTH_ABBR[m - 1]).join(', ')
    : 'Year-round';
  const color = categoryColor(exp);

  return (
    <>
      <div className="se-modal-backdrop" onClick={onClose} />
      <div className="se-modal" role="dialog" aria-modal="true">
        <button className="se-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Hero */}
        <div className="se-modal-hero" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}55)` }}>
          {exp.imageUrl && !imgError ? (
            <img src={exp.imageUrl} alt={exp.name} className="se-modal-hero-img" onError={() => setImgError(true)} />
          ) : (
            <div className="se-modal-hero-placeholder" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}55)` }} />
          )}
        </div>

        <div className="se-modal-body">
          <div className="se-modal-meta">
            <span className="se-modal-location">{exp.city} · {exp.country}</span>
            <span className="se-modal-months">{months}</span>
          </div>

          <h2 className="se-modal-title">{exp.name}</h2>

          {exp.categories?.length > 0 && (
            <div className="se-modal-cats">
              {exp.categories.map(c => (
                <span key={c} className="se-card-cat-badge">{c}</span>
              ))}
            </div>
          )}

          {exp.description && <p className="se-modal-desc">{exp.description}</p>}

          {exp.whySpecial && (
            <div className="se-card-why">
              <span className="se-card-why-label">Why special</span>
              <p>{exp.whySpecial}</p>
            </div>
          )}

          {exp.vibeTags?.length > 0 && (
            <div className="se-modal-vibes">
              {exp.vibeTags.map(t => <span key={t} className="se-card-vibe-tag">#{t}</span>)}
            </div>
          )}

          <div className="se-modal-actions">
            <button
              className={`se-modal-fav-btn${favored ? ' se-modal-fav-btn-active' : ''}`}
              onClick={onToggleFav}
            >
              {favored ? '♥ Favorited' : '♡ Favorite'}
            </button>

            {user ? (
              <button className="se-modal-dream-btn" onClick={handleAddToDreams} disabled={adding}>
                {adding ? 'Adding…' : '✦ Add to Dreams'}
              </button>
            ) : (
              <a href="/login?redirect=/discover?view=seasonal" className="se-modal-dream-btn">
                Sign in to add to Dreams
              </a>
            )}
          </div>
        </div>

        {toast && <div className="explore-toast">{toast}</div>}
      </div>
    </>
  );
}
