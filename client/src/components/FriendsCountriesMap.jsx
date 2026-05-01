// FriendsCountriesMap — aggregate world map for the Friends tab. Shows
// every country any of the user's accepted friends has been to. Hover (or
// tap on touch devices) a colored country to see which friends have been
// there.
//
// Data: GET /api/social/friends-countries → { countries: [{ country, friends }] }

import { useEffect, useMemo, useRef, useState } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import api from '../api/client';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// World-atlas v2 uses UN-style names — map them to the colloquial names
// our pins normalize to so the colored fills line up. Mirrors the same
// map in CountriesModal.jsx (kept inline to avoid a deeper refactor).
const GEO_NAME_TO_CANONICAL = {
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  'Lao PDR': 'Laos',
  "Lao People's Democratic Republic": 'Laos',
  'Viet Nam': 'Vietnam',
  'Republic of Korea': 'South Korea',
  "Democratic People's Republic of Korea": 'North Korea',
  'United Republic of Tanzania': 'Tanzania',
  'Iran (Islamic Republic of)': 'Iran',
  'Syrian Arab Republic': 'Syria',
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Venezuela (Bolivarian Republic of)': 'Venezuela',
  'Czechia': 'Czech Republic',
  'Slovak Republic': 'Slovakia',
  "Côte d'Ivoire": 'Ivory Coast',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Republic of Moldova': 'Moldova',
  'Republic of North Macedonia': 'North Macedonia',
  'The former Yugoslav Republic of Macedonia': 'North Macedonia',
  'Brunei Darussalam': 'Brunei',
  'Cabo Verde': 'Cape Verde',
  'Swaziland': 'Eswatini',
  'Burma': 'Myanmar',
  'East Timor': 'Timor-Leste',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'Türkiye': 'Turkey',
  'Palestine, State of': 'Palestine',
  'State of Palestine': 'Palestine',
  'Holy See': 'Vatican City',
};
function canon(name) { return GEO_NAME_TO_CANONICAL[name] || name; }

export default function FriendsCountriesMap() {
  const [countries, setCountries] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState(null); // { name, friends, left, top } | null
  // Modal opens when user clicks a visited country — shows full detail.
  const [modal, setModal] = useState(null); // { name, friends } | null
  // Controlled zoom + pan state for ZoomableGroup.
  const [view, setView] = useState({ coordinates: [10, 30], zoom: 1 });
  const wrapRef = useRef(null);

  function clampZoom(z) { return Math.min(Math.max(z, 1), 8); }
  function zoomIn() {
    setView(v => ({ ...v, zoom: clampZoom(v.zoom * 1.5) }));
  }
  function zoomOut() {
    setView(v => ({ ...v, zoom: clampZoom(v.zoom / 1.5) }));
  }
  function zoomReset() {
    setView({ coordinates: [10, 30], zoom: 1 });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/social/friends-countries');
        if (cancelled) return;
        const list = res.data?.countries || [];
        setCountries(list);
      } catch {
        if (!cancelled) setError('Could not load friends map.');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // country (lowercased) → friends array. Drives both the fill color and
  // the hover tooltip lookup.
  const visitedMap = useMemo(() => {
    const m = new Map();
    for (const c of (countries || [])) {
      m.set(c.country.toLowerCase().trim(), c.friends);
    }
    return m;
  }, [countries]);

  // Tap-anywhere-else dismissal for the tooltip.
  useEffect(() => {
    if (!hovered) return;
    function onDocClick(e) {
      if (e.target.closest('.fcm-tooltip')) return;
      if (e.target.closest('[data-fcm-visited="true"]')) return;
      setHovered(null);
    }
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [hovered]);

  // Escape closes the modal.
  useEffect(() => {
    if (!modal) return;
    function onKey(e) { if (e.key === 'Escape') setModal(null); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal]);

  if (error) {
    return <div className="fcm-empty">{error}</div>;
  }
  if (countries === null) {
    return (
      <div className="fcm-empty">
        <div className="loading-spinner-sm" />
      </div>
    );
  }
  if (countries.length === 0) {
    return (
      <div className="fcm-empty">
        Once your friends pin places they&rsquo;ve been, they&rsquo;ll show up here.
      </div>
    );
  }

  const totalFriends = new Set();
  for (const c of countries) for (const f of c.friends) totalFriends.add(f.userId);

  return (
    <>
    <div className="fcm-wrap">
      <div className="fcm-header">
        <h2 className="fcm-title">Where your friends have been</h2>
        <p className="fcm-sub">
          {countries.length} {countries.length === 1 ? 'country' : 'countries'} ·
          {' '}{totalFriends.size} {totalFriends.size === 1 ? 'friend' : 'friends'} ·
          {' '}hover a country to see who&rsquo;s been
        </p>
      </div>

      <div className="fcm-map" ref={wrapRef}>
        <ComposableMap
          projection="geoMercator"
          /* Standard web-Mercator projection — the "normal looking" map
             everyone recognizes. Centered around the equator with scale
             tuned so the world fits the wider landscape container with
             no white space at the top. */
          projectionConfig={{ scale: 145, center: [10, 30] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            minZoom={1}
            maxZoom={8}
            zoom={view.zoom}
            center={view.coordinates}
            onMoveEnd={(p) => setView({
              coordinates: p.coordinates,
              zoom: p.zoom,
            })}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const name = canon(geo.properties.name);
                  const friends = visitedMap.get(name.toLowerCase().trim()) || null;
                  const visited = !!friends;
                  const isActive = visited && hovered?.name === name;
                  const hoverHandler = visited ? (event) => {
                    const ev = event.nativeEvent || event;
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const HALF = 130;
                    const MARGIN = 6;
                    const rawLeft = ev.clientX - rect.left;
                    const left = Math.max(HALF + MARGIN, Math.min(rawLeft, rect.width - HALF - MARGIN));
                    setHovered({ name, friends, left, top: ev.clientY - rect.top });
                  } : undefined;
                  const clickHandler = visited ? () => {
                    setHovered(null);
                    setModal({ name, friends });
                  } : undefined;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      data-fcm-visited={visited ? 'true' : 'false'}
                      onMouseEnter={hoverHandler}
                      onClick={clickHandler}
                      fill={
                        visited
                          /* Warm gold for visited; deeper bronze on
                             hover. Unvisited countries use a soft cream
                             so they read as quiet land, not negative
                             space. */
                          ? (isActive ? '#A37424' : '#C9A84C')
                          : '#EDE2C9'
                      }
                      stroke={isActive ? '#5A3D11' : '#D4C7A8'}
                      strokeWidth={isActive ? 1.2 : 0.5}
                      style={{
                        default: { outline: 'none', cursor: visited ? 'pointer' : 'default' },
                        hover: {
                          outline: 'none',
                          fill: visited ? '#B8902E' : '#E5D6B5',
                          cursor: visited ? 'pointer' : 'default',
                        },
                        pressed: { outline: 'none' },
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>

        {/* Zoom controls — overlay bottom-right of the map. Pinch and
            mouse-wheel zoom still work via ZoomableGroup; these buttons
            are the explicit affordance for desktop + touch users who
            don't want to figure out the gesture. */}
        <div className="fcm-zoom-controls" aria-label="Map zoom controls">
          <button
            type="button"
            className="fcm-zoom-btn"
            onClick={zoomIn}
            disabled={view.zoom >= 8}
            title="Zoom in"
            aria-label="Zoom in"
          >+</button>
          <button
            type="button"
            className="fcm-zoom-btn"
            onClick={zoomOut}
            disabled={view.zoom <= 1}
            title="Zoom out"
            aria-label="Zoom out"
          >−</button>
          <button
            type="button"
            className="fcm-zoom-btn fcm-zoom-reset"
            onClick={zoomReset}
            disabled={view.zoom === 1}
            title="Reset zoom"
            aria-label="Reset zoom"
          >⟲</button>
        </div>

        {hovered && (
          <div
            className="fcm-tooltip"
            style={{ left: hovered.left, top: hovered.top }}
            role="tooltip"
            onMouseLeave={() => setHovered(null)}
          >
            <div className="fcm-tooltip-title">{hovered.name}</div>
            {/* Per-friend rows: avatar + name + the place-name(s) and
                short memory snippet for each memory pin that touched
                this country. Snippets come from /friends-countries
                (ai_summary || note, capped at ~90 chars on the server). */}
            <div className="fcm-tooltip-friends">
              {hovered.friends.slice(0, 5).map(f => {
                const memories = f.memories || [];
                return (
                  <div key={f.userId} className="fcm-tooltip-friend">
                    <span className="fcm-tooltip-avatar fcm-tooltip-avatar-inline">
                      {f.avatarUrl
                        ? <img src={f.avatarUrl} alt={f.displayName || ''} />
                        : <span>{(f.displayName || '?').charAt(0).toUpperCase()}</span>
                      }
                    </span>
                    <div className="fcm-tooltip-friend-body">
                      <div className="fcm-tooltip-friend-name">{f.displayName || 'Friend'}</div>
                      {memories.length > 0 && (
                        <div className="fcm-tooltip-friend-memories">
                          {memories.map((m, i) => (
                            <div key={m.pinId || i} className="fcm-tooltip-memory">
                              <span className="fcm-tooltip-memory-place">{m.placeName}</span>
                              {m.snippet && (
                                <>
                                  <span className="fcm-tooltip-memory-sep"> — </span>
                                  <span className="fcm-tooltip-memory-snippet">{m.snippet}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {hovered.friends.length > 5 && (
                <div className="fcm-tooltip-more">+{hovered.friends.length - 5} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Country detail modal — opens on click, shows each friend + their memories */}
    {modal && (
      <div className="fcm-modal-backdrop" onClick={() => setModal(null)}>
        <div className="fcm-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={modal.name}>
          <div className="fcm-modal-header">
            <h2 className="fcm-modal-title">{modal.name}</h2>
            <button
              type="button"
              className="fcm-modal-close"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="fcm-modal-body">
            {modal.friends.map(f => {
              const memories = f.memories || [];
              return (
                <div key={f.userId} className="fcm-modal-friend">
                  <div className="fcm-modal-friend-avatar">
                    {f.avatarUrl
                      ? <img src={f.avatarUrl} alt={f.displayName || ''} />
                      : <span>{(f.displayName || '?').charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="fcm-modal-friend-content">
                    <div className="fcm-modal-friend-name">{f.displayName || 'Friend'}</div>
                    {memories.length > 0 ? (
                      <ul className="fcm-modal-memories">
                        {memories.map((m, i) => (
                          <li key={m.pinId || i} className="fcm-modal-memory">
                            <span className="fcm-modal-memory-place">{m.placeName}</span>
                            {m.snippet && (
                              <span className="fcm-modal-memory-snippet"> — {m.snippet}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="fcm-modal-memory-empty">No details yet</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
