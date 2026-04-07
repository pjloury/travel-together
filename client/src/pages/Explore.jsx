// Explore — curated trip discovery page
// Shows AI-curated trip clusters from travel influencers and bloggers.
// Personalized: ranked by similarity to the user's pins when available.
// Users can add any experience (or whole trip) to their dream pins.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import Gallery from '../components/Gallery';
import useLoadingPhrases from '../hooks/useLoadingPhrases';

const CATEGORY_EMOJI = {
  food:      '🍜',
  culture:   '🏛️',
  nature:    '🌿',
  nightlife: '🌙',
  shopping:  '🛍️',
  adventure: '🧗',
  wellness:  '🧘',
};

// Reuse the same deterministic gradient logic as PinCard
const CARD_GRADIENTS = [
  ['#6B4A18', '#B8860B'],
  ['#1E4A6E', '#2E7AB0'],
  ['#5C2010', '#A03A20'],
  ['#1E4A38', '#2E7A55'],
  ['#4A1A3C', '#823065'],
  ['#2A3A60', '#3A5A98'],
  ['#5A3A18', '#906028'],
  ['#1A4848', '#2A7870'],
  ['#3A3A12', '#6A6420'],
  ['#5A1E38', '#902A58'],
];

function hashId(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
}

function tripGradient(trip) {
  const [start, end] = CARD_GRADIENTS[hashId(trip.id) % CARD_GRADIENTS.length];
  return `linear-gradient(145deg, ${start}, ${end})`;
}

// Group experiences by day_number
function groupByDay(experiences) {
  const map = {};
  for (const e of experiences) {
    const d = e.day_number || 1;
    if (!map[d]) map[d] = [];
    map[d].push(e);
  }
  return Object.entries(map)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([day, exps]) => ({ day: Number(day), experiences: exps }));
}

// ── Trip card in the grid ──────────────────────────────────────────────────
function TripCard({ trip, onClick, rank }) {
  return (
    <div className="explore-trip-card" onClick={() => onClick(trip)}>
      <div
        className="explore-trip-card-hero"
        style={
          trip.image_url
            ? { backgroundImage: `url(${trip.image_url})` }
            : { background: tripGradient(trip) }
        }
      >
        {rank != null && rank < 3 && (
          <div className="explore-trip-for-you-badge">✦ For you</div>
        )}
        <div className="explore-trip-card-overlay">
          <div className="explore-trip-card-meta">
            <p className="explore-trip-card-region">{trip.region}</p>
            <h3 className="explore-trip-card-city">{trip.city}</h3>
            <p className="explore-trip-card-country">{trip.country}</p>
          </div>
        </div>
      </div>
      <div className="explore-trip-card-body">
        <p className="explore-trip-card-title">{trip.title}</p>
        <div className="explore-trip-card-footer">
          <span className="explore-trip-card-count">
            {trip.experience_count} {trip.experience_count === 1 ? 'experience' : 'experiences'}
          </span>
          {trip.days_suggested && (
            <span className="explore-trip-card-days">{trip.days_suggested} days</span>
          )}
        </div>
        {trip.tags && trip.tags.length > 0 && (
          <div className="explore-trip-tags">
            {trip.tags.slice(0, 4).map(t => (
              <span key={t} className="explore-trip-tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail panel ───────────────────────────────────────────────────────────
function TripDetail({ trip, experiences, isOpen, onClose, onAddedToDreams, user }) {
  const [addingTrip, setAddingTrip] = useState(false);
  const [addingExp, setAddingExp] = useState(null); // experience id being added
  const [toast, setToast] = useState('');
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  }

  async function handleAddTrip() {
    if (!user) { setShowSignupPrompt(true); return; }
    if (addingTrip) return;
    setAddingTrip(true);
    try {
      await api.post('/pins', {
        pinType: 'dream',
        placeName: `${trip.city}, ${trip.country}`,
        dreamNote: trip.description || '',
        tags: trip.tags || [],
        unsplashImageUrl: trip.image_url || null,
        unsplashAttribution: trip.image_url ? 'Photo from Unsplash' : null,
      });
      showToast(`✓ ${trip.city} added to your dreams`);
      if (onAddedToDreams) onAddedToDreams();
    } catch {
      showToast('Could not add — try again');
    } finally {
      setAddingTrip(false);
    }
  }

  const [addingMemory, setAddingMemory] = useState(false);

  async function handleIveBeenHere() {
    if (!user) { setShowSignupPrompt(true); return; }
    if (addingMemory) return;
    setAddingMemory(true);
    try {
      await api.post('/pins', {
        pinType: 'memory',
        placeName: trip.city,
        note: `Visited ${trip.city}, ${trip.country}`,
        tags: (trip.tags || []).slice(0, 5),
        unsplashImageUrl: trip.image_url || null,
        unsplashAttribution: trip.image_url ? 'Photo from Unsplash' : null,
      });
      showToast(`✓ ${trip.city} added to your memories — fill in the details anytime`);
    } catch {
      showToast('Could not add — try again');
    } finally {
      setAddingMemory(false);
    }
  }

  async function handleAddExperience(exp) {
    if (!user) { setShowSignupPrompt(true); return; }
    if (addingExp) return;
    setAddingExp(exp.id);
    try {
      await api.post('/pins', {
        pinType: 'dream',
        placeName: exp.place_name || trip.city,
        dreamNote: [exp.description, exp.quote ? `"${exp.quote}"` : ''].filter(Boolean).join('\n\n'),
        tags: exp.tags || [],
      });
      showToast(`✓ ${exp.title} added to your dreams`);
      if (onAddedToDreams) onAddedToDreams();
    } catch {
      showToast('Could not add — try again');
    } finally {
      setAddingExp(null);
    }
  }

  if (!trip) return null;

  const days = groupByDay(experiences || []);

  return (
    <>
      <div
        className={`md-backdrop${isOpen ? ' md-backdrop-visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`md-panel${isOpen ? ' md-panel-open' : ''}`}>
        {/* Header / hero */}
        <div className="md-header">
          <button className="md-close" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          {trip.image_url ? (
            <div className="md-hero-img" style={{ backgroundImage: `url(${trip.image_url})` }} />
          ) : (
            <div className="md-hero-gradient" style={{ background: tripGradient(trip) }}>
              <span className="md-hero-emoji">✈️</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="md-body">
          {/* Title block */}
          <div className="md-title-block">
            <p className="md-dream-eyebrow">{trip.region} · {trip.country}</p>
            <h2 className="md-place">{trip.title}</h2>
            {trip.description && (
              <p className="explore-detail-desc">{trip.description}</p>
            )}
          </div>

          {/* Tags */}
          {trip.tags && trip.tags.length > 0 && (
            <div className="md-chips-row">
              {trip.tags.map(t => (
                <span key={t} className="md-tag-chip">{t}</span>
              ))}
            </div>
          )}

          {/* Trip action CTAs */}
          <div className="md-section explore-trip-actions">
            <button
              className="explore-add-trip-btn"
              onClick={handleAddTrip}
              disabled={addingTrip}
            >
              {addingTrip ? 'Adding…' : `✦ Add ${trip.city} to my dreams`}
            </button>
            <button
              className="explore-been-here-btn"
              onClick={handleIveBeenHere}
              disabled={addingMemory}
            >
              {addingMemory ? 'Adding…' : `🌍 I've been to ${trip.city}`}
            </button>
          </div>

          {/* Itinerary */}
          {days.length > 0 && (
            <div className="md-section">
              <p className="md-section-label">Itinerary</p>
              {days.map(({ day, experiences: dayExps }) => (
                <div key={day} className="explore-day-group">
                  <p className="explore-day-label">Day {day}</p>
                  {dayExps.map(exp => (
                    <div key={exp.id} className="explore-experience">
                      <div className="explore-exp-header">
                        <span className="explore-exp-emoji">
                          {CATEGORY_EMOJI[exp.category] || '📍'}
                        </span>
                        <div className="explore-exp-titles">
                          <p className="explore-exp-title">{exp.title}</p>
                          {exp.place_name && (
                            <p className="explore-exp-place">{exp.place_name}</p>
                          )}
                        </div>
                        <button
                          className="explore-exp-add-btn"
                          onClick={() => handleAddExperience(exp)}
                          disabled={addingExp === exp.id}
                          title="Add to dreams"
                        >
                          {addingExp === exp.id ? '…' : '+'}
                        </button>
                      </div>
                      {exp.description && (
                        <p className="explore-exp-desc">{exp.description}</p>
                      )}
                      {exp.quote && (
                        <p className="explore-exp-quote">"{exp.quote}"</p>
                      )}
                      {(exp.source_name || exp.influencer_name) && (
                        <p className="explore-exp-source">
                          {[exp.influencer_name, exp.source_name].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Empty state while content is loading */}
          {days.length === 0 && (
            <div className="explore-empty-itinerary">
              <p>Itinerary loading…</p>
            </div>
          )}
        </div>

        {/* Toast */}
        {/* Signup prompt for guests */}
        {showSignupPrompt && (
          <div className="explore-signup-prompt">
            <p className="explore-signup-text">Create an account to save this to your dreams</p>
            <div className="explore-signup-actions">
              <Link to="/register?redirect=/discover" className="explore-signup-btn-primary">Sign up</Link>
              <Link to="/login?redirect=/discover" className="explore-signup-btn-secondary">Sign in</Link>
            </div>
            <button className="explore-signup-dismiss" onClick={() => setShowSignupPrompt(false)}>Maybe later</button>
          </div>
        )}

        {toast && <div className="explore-toast">{toast}</div>}
      </aside>
    </>
  );
}

const DISCOVER_LOADING_PHRASES = [
  'Scouring travel blogs for hidden gems...',
  'Asking influencers for their best-kept secrets...',
  'Cross-referencing street food maps...',
  'Ranking rooftop bars by sunset quality...',
  'Mapping the world\'s coziest neighborhoods...',
  'Consulting local taxi drivers...',
  'Checking which alleyways have the best murals...',
  'Sorting temples by serenity level...',
  'Calculating optimal golden hour angles...',
  'Interviewing retired backpackers...',
  'Calibrating wanderlust sensors...',
  'Curating your next obsession...',
];

// ── Main Explore page ──────────────────────────────────────────────────────
export default function Explore() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [selectedExperiences, setSelectedExperiences] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [generateQuery, setGenerateQuery] = useState('');
  const [generating, setGenerating] = useState(false);
  const [searchParamsExplore, setSearchParamsExplore] = useSearchParams();
  const [discoverTab, setDiscoverTabRaw] = useState(searchParamsExplore.get('view') === 'gallery' ? 'gallery' : 'trips');

  function setDiscoverTab(tab) {
    setDiscoverTabRaw(tab);
    setSearchParamsExplore(prev => {
      const next = new URLSearchParams(prev);
      if (tab === 'gallery') next.set('view', 'gallery');
      else next.delete('view');
      return next;
    }, { replace: true });
  }
  const [regionFilter, setRegionFilter] = useState('All');
  const [isPersonalized, setIsPersonalized] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const phrases = useMemo(() => DISCOVER_LOADING_PHRASES, []);
  const loadingPhrase = useLoadingPhrases(phrases, loading);

  // Load trips in two phases:
  // 1. Fast: load unranked trips immediately (pure DB, ~100ms)
  // 2. Background: fetch personalized ranking and swap in when ready
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        // Phase 1: show trips immediately
        const res = await api.get('/explore/trips');
        const fastTrips = res.trips || res.data?.trips || [];
        if (!cancelled) {
          setTrips(fastTrips);
          setLoading(false);
        }

        // Phase 2: upgrade to personalized (may be cached → instant, or AI → 1-2s)
        if (user) {
          try {
            const pRes = await api.get('/explore/trips/personalized');
            const pTrips = pRes.trips || pRes.data?.trips || [];
            const personalized = pRes.personalized || pRes.data?.personalized || false;
            if (!cancelled && pTrips.length > 0) {
              setTrips(pTrips);
              setIsPersonalized(personalized);
            }
          } catch {
            // Personalized failed — fast trips already showing, no problem
          }
        }
      } catch {
        if (!cancelled) {
          setError('Could not load trips. Try again later.');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Open detail panel
  const handleTripClick = useCallback(async (trip) => {
    setSelectedTrip(trip);
    setSelectedExperiences([]);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/explore/trips/${trip.id}`);
      setSelectedExperiences(res.experiences || res.data?.experiences || []);
    } catch {
      // experiences stay empty — panel still shows trip info
    } finally {
      setDetailLoading(false);
    }
  }, []);

  async function handleGenerateTrip() {
    const city = generateQuery.trim();
    if (!city || generating || !user) return;
    setGenerating(true);
    try {
      const res = await api.post('/explore/trips/generate', { city });
      const data = res.data || res;
      const trip = data.trip;
      if (trip) {
        // Add to trips list if not already there
        setTrips(prev => {
          if (prev.some(t => t.id === trip.id)) return prev;
          return [trip, ...prev];
        });
        setGenerateQuery('');
        // Open the detail panel
        handleTripClick(trip);
      }
    } catch {
      setError('Could not generate trip. Try again.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setGenerating(false);
    }
  }

  const handleClose = useCallback(() => {
    setDetailOpen(false);
    setTimeout(() => {
      setSelectedTrip(null);
      setSelectedExperiences([]);
    }, 300);
  }, []);

  // Unique regions for filter tabs (preserve personalized order within each region)
  const regions = ['All', ...Array.from(new Set(trips.map(t => t.region).filter(Boolean))).sort()];

  const visibleTrips = regionFilter === 'All'
    ? trips
    : trips.filter(t => t.region === regionFilter);

  return (
    <Layout>
      <div className="explore-page">
        <div className="explore-header">
          <h1 className="explore-heading">Discover</h1>
          <div className="explore-view-tabs">
            <button className={`explore-view-tab${discoverTab === 'trips' ? ' active' : ''}`} onClick={() => setDiscoverTab('trips')}>
              Trips
            </button>
            <button className={`explore-view-tab${discoverTab === 'gallery' ? ' active' : ''}`} onClick={() => setDiscoverTab('gallery')}>
              Gallery
            </button>
          </div>
          <p className="explore-subheading">
            {discoverTab === 'gallery'
              ? 'Stunning travel photography from around the world'
              : isPersonalized
              ? 'Curated for you based on your travel taste'
              : 'Curated trips from travel bloggers and taste influencers'}
          </p>
          {user && discoverTab === 'trips' && (
            <div className="explore-generate-bar">
              <input
                className="explore-generate-input"
                placeholder="Generate a trip for any city…"
                value={generateQuery}
                onChange={e => setGenerateQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleGenerateTrip(); }}
                disabled={generating}
              />
              <button
                className="explore-generate-btn"
                onClick={handleGenerateTrip}
                disabled={generating || !generateQuery.trim()}
              >
                {generating ? 'Generating…' : '✦ Generate'}
              </button>
            </div>
          )}
        </div>

        {/* Gallery view */}
        {discoverTab === 'gallery' && <Gallery />}

        {/* Trips view */}
        {discoverTab === 'trips' && regions.length > 2 && (
          <div className="explore-filters">
            {regions.map(r => (
              <button
                key={r}
                className={`explore-filter-pill${regionFilter === r ? ' active' : ''}`}
                onClick={() => setRegionFilter(r)}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Trips states */}
        {discoverTab === 'trips' && loading && (
          <div className="explore-loading">
            <div className="loading-spinner-sm" />
            <p className="loading-phrase">{loadingPhrase}</p>
          </div>
        )}

        {discoverTab === 'trips' && !loading && error && (
          <div className="explore-error">
            <p>{error}</p>
          </div>
        )}

        {discoverTab === 'trips' && !loading && !error && trips.length === 0 && (
          <div className="explore-empty">
            <p>Curated trips are being generated — check back in a few minutes.</p>
          </div>
        )}

        {/* Trip grid */}
        {discoverTab === 'trips' && !loading && visibleTrips.length > 0 && (
          <div className="explore-grid">
            {visibleTrips.map((trip, i) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onClick={handleTripClick}
                rank={isPersonalized ? i : null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <TripDetail
        trip={selectedTrip}
        experiences={detailLoading ? [] : selectedExperiences}
        isOpen={detailOpen}
        onClose={handleClose}
        onAddedToDreams={() => {/* could refresh dreams count */}}
        user={user}
      />
    </Layout>
  );
}
