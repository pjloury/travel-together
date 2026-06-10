// Browse editorial travel experiences by category and vibe.
// Month is surfaced as a badge on each card, not as the primary navigation.
import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import SeasonalMap from './SeasonalMap';
import ExperienceModal from './ExperienceModal';

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const CATEGORY_ICONS = {
  'Festivals & Events':    '🎊',
  'Food & Drink':          '🍜',
  'Nature & Wildlife':     '🌿',
  'Hiking & Adventure':    '🧗',
  'Beach & Water':         '🌊',
  'Architecture & Streets':'🏛️',
  'Culture & History':     '🏯',
  'Wellness & Slow':       '🧘',
};

const CATEGORY_GRADIENTS = {
  'Festivals & Events':    'linear-gradient(135deg,#8B0000,#DC143C)',
  'Food & Drink':          'linear-gradient(135deg,#8B4513,#D2691E)',
  'Nature & Wildlife':     'linear-gradient(135deg,#2D5016,#4A7C23)',
  'Hiking & Adventure':    'linear-gradient(135deg,#4A2800,#8B5000)',
  'Beach & Water':         'linear-gradient(135deg,#0E4D6E,#1A8FBF)',
  'Architecture & Streets':'linear-gradient(135deg,#4A4A4A,#7A7A7A)',
  'Culture & History':     'linear-gradient(135deg,#6B2D5B,#9B4B8A)',
  'Wellness & Slow':       'linear-gradient(135deg,#2E4A3E,#5B8A72)',
};
const DEFAULT_GRADIENT = 'linear-gradient(135deg,#1A1A2E,#16213E)';

// Compress a month array into readable badges.
// e.g. [6,7,8] → ["JUN–AUG"]   [1,2,11,12] → ["JAN","FEB","NOV","DEC"]
function monthBadges(months) {
  if (!months || months.length === 0) return [];
  const sorted = [...months].sort((a, b) => a - b);
  if (sorted.length === 12) return ['Year-round'];

  // Group consecutive runs
  const runs = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) { end = sorted[i]; }
    else { runs.push([start, end]); start = end = sorted[i]; }
  }
  runs.push([start, end]);

  return runs.map(([s, e]) =>
    s === e ? MONTH_ABBR[s - 1] : `${MONTH_ABBR[s - 1]}–${MONTH_ABBR[e - 1]}`
  );
}

export default function SeasonalExplorer() {
  const currentMonth = new Date().getMonth() + 1;
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'map'
  const [inSeasonOnly, setInSeasonOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedVibe, setSelectedVibe] = useState(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('se_favorites');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set(); }
  });
  const [selectedExp, setSelectedExp] = useState(null);
  const [categories, setCategories] = useState([]);
  const [topVibes, setTopVibes] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const LIMIT = 24;

  function toggleFavorite(id) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('se_favorites', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  // Load categories (unfiltered — always full list)
  useEffect(() => {
    api.get('/seasonal/categories')
      .then(res => setCategories(res.categories || []))
      .catch(() => {});
  }, []);

  // Load top vibe tags
  useEffect(() => {
    api.get('/seasonal/vibes')
      .then(res => setTopVibes(res.vibes || []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (newOffset = 0) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: newOffset });
      if (inSeasonOnly) params.set('month', currentMonth);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedVibe) params.set('vibe', selectedVibe);
      const res = await api.get(`/seasonal?${params}`);
      const incoming = res.data || [];
      setTotal(res.total || 0);
      if (newOffset === 0) setExperiences(incoming);
      else setExperiences(prev => [...prev, ...incoming]);
      setOffset(newOffset + incoming.length);
    } catch { /* silent */ }
    finally { setLoading(false); setLoadingMore(false); }
  }, [inSeasonOnly, selectedCategory, selectedVibe, currentMonth]);

  useEffect(() => {
    setOffset(0);
    load(0);
  }, [load]);

  const subtitle = (() => {
    const parts = [];
    if (inSeasonOnly) parts.push(MONTH_ABBR[currentMonth - 1]);
    if (selectedCategory) parts.push(selectedCategory);
    if (selectedVibe) parts.push(`#${selectedVibe}`);
    return total > 0
      ? `${total} experience${total !== 1 ? 's' : ''}${parts.length ? ' · ' + parts.join(' · ') : ''}`
      : 'No experiences match this filter';
  })();

  return (
    <div className="se-root">
      <div className="se-header">
        <div className="se-header-top">
          <div>
            <h2 className="se-title">Browse Experiences</h2>
            <p className="se-subtitle">{subtitle}</p>
          </div>
          <div className="se-view-toggle">
            <button
              type="button"
              className={`se-view-btn${viewMode === 'grid' ? ' se-view-btn-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >⊞ Grid</button>
            <button
              type="button"
              className={`se-view-btn${viewMode === 'map' ? ' se-view-btn-active' : ''}`}
              onClick={() => setViewMode('map')}
              title="Map view"
            >🗺 Map</button>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="se-filter-bar">
        <button
          type="button"
          className={`se-season-pill${inSeasonOnly ? ' se-season-pill-active' : ''}`}
          onClick={() => setInSeasonOnly(v => !v)}
        >
          🗓 In Season Now
        </button>

        <button
          type="button"
          className={`se-season-pill${showFavoritesOnly ? ' se-season-pill-active' : ''}`}
          onClick={() => setShowFavoritesOnly(v => !v)}
        >
          ♥ Favorited{favorites.size > 0 ? ` (${favorites.size})` : ''}
        </button>

        {categories.map(({ name, count }) => (
          <button
            key={name}
            type="button"
            className={`se-cat-chip${selectedCategory === name ? ' se-cat-chip-active' : ''}`}
            onClick={() => setSelectedCategory(prev => prev === name ? null : name)}
          >
            {CATEGORY_ICONS[name] || '✦'} {name}
            <span className="se-cat-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Vibe tags row */}
      {topVibes.length > 0 && (
        <div className="se-vibe-row">
          {topVibes.map(v => (
            <button
              key={v}
              type="button"
              className={`se-vibe-chip${selectedVibe === v ? ' se-vibe-chip-active' : ''}`}
              onClick={() => setSelectedVibe(prev => prev === v ? null : v)}
            >
              #{v}
            </button>
          ))}
          {(selectedCategory || selectedVibe || inSeasonOnly || showFavoritesOnly) && (
            <button
              type="button"
              className="se-clear-btn"
              onClick={() => { setSelectedCategory(null); setSelectedVibe(null); setInSeasonOnly(false); setShowFavoritesOnly(false); }}
            >
              Clear filters ✕
            </button>
          )}
        </div>
      )}

      {/* Map view */}
      {viewMode === 'map' && (
        <SeasonalMap
          filters={{ inSeasonOnly, category: selectedCategory, vibe: selectedVibe }}
          favorites={favorites}
          onToggleFav={toggleFavorite}
        />
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (() => {
        const visible = showFavoritesOnly
          ? experiences.filter(e => favorites.has(e.id))
          : experiences;
        if (loading) return <div className="se-loading">Loading experiences…</div>;
        if (visible.length === 0) return (
          <div className="se-empty">
            {showFavoritesOnly ? 'No favorited experiences yet. Click ♡ on a card to save one.' : 'No experiences match this selection.'}
          </div>
        );
        return (
          <>
            <div className="se-grid">
              {visible.map(exp => (
                <ExperienceCard
                  key={exp.id}
                  exp={exp}
                  currentMonth={currentMonth}
                  favored={favorites.has(exp.id)}
                  onToggleFav={() => toggleFavorite(exp.id)}
                  onClick={() => { setSelectedExp(exp); api.post(`/seasonal/${exp.id}/click`).catch(() => {}); }}
                />
              ))}
            </div>

            {!showFavoritesOnly && offset < total && (
              <button
                type="button"
                className="se-load-more"
                onClick={() => load(offset)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : `Show more (${total - offset} left)`}
              </button>
            )}
          </>
        );
      })()}

      {/* Experience detail modal */}
      {selectedExp && (
        <ExperienceModal
          exp={selectedExp}
          onClose={() => setSelectedExp(null)}
          favored={favorites.has(selectedExp.id)}
          onToggleFav={() => toggleFavorite(selectedExp.id)}
        />
      )}
    </div>
  );
}

function ExperienceCard({ exp, currentMonth, favored, onToggleFav, onClick }) {
  const [imgError, setImgError] = useState(false);

  const gradient = CATEGORY_GRADIENTS[exp.categories[0]] || DEFAULT_GRADIENT;
  const badges = monthBadges(exp.months);
  const inSeason = exp.months.length === 0 || exp.months.includes(currentMonth);

  return (
    <div className="se-card se-card-clickable" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      {/* Hero image */}
      <div className="se-card-hero" style={{ background: gradient }}>
        {exp.imageUrl && !imgError ? (
          <img src={exp.imageUrl} alt={exp.name} className="se-card-hero-img" onError={() => setImgError(true)} />
        ) : (
          <div className="se-card-hero-emoji">{CATEGORY_ICONS[exp.categories[0]] || '✈️'}</div>
        )}

        {/* Unsplash attribution — bottom right, visible on hover */}
        {exp.imageUrl && exp.imageAttribution && (
          <div className="se-card-attribution">
            <a href={exp.imageAttribution.photographerUrl} target="_blank" rel="noopener noreferrer"
               onClick={e => e.stopPropagation()}>
              {exp.imageAttribution.photographerName}
            </a>
            {' / '}
            <a href={exp.imageAttribution.unsplashUrl} target="_blank" rel="noopener noreferrer"
               onClick={e => e.stopPropagation()}>
              Unsplash
            </a>
          </div>
        )}

        {/* Heart button — top right */}
        <button
          type="button"
          className={`se-card-fav-btn${favored ? ' se-card-fav-btn-active' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleFav(); }}
          aria-label={favored ? 'Remove from favorites' : 'Add to favorites'}
        >
          {favored ? '♥' : '♡'}
        </button>

        {/* Month badges — bottom left */}
        {badges.length > 0 && (
          <div className="se-card-month-badges">
            {badges.map(b => (
              <span key={b} className={`se-month-badge${inSeason && exp.months.length > 0 ? ' se-month-badge-active' : ''}`}>
                {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="se-card-body">
        <div className="se-card-place">
          <span className="se-card-city">{exp.city}</span>
          <span className="se-card-sep">·</span>
          <span className="se-card-country">{exp.country}</span>
        </div>

        <h3 className="se-card-name">{exp.name}</h3>

        {exp.categories.length > 0 && (
          <div className="se-card-cats">
            {exp.categories.map(c => (
              <span key={c} className="se-card-cat-badge">{CATEGORY_ICONS[c] || '✦'} {c}</span>
            ))}
          </div>
        )}

        <p className="se-card-desc">{exp.description}</p>

        {exp.vibeTags.length > 0 && (
          <div className="se-card-vibes">
            {exp.vibeTags.map(t => <span key={t} className="se-card-vibe-tag">#{t}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
