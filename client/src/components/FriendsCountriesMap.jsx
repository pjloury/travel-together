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
  // hovered already stores tooltip position relative to the wrapper
  // (computed in the Geography handler) so we never read ref.current
  // during render.
  const [hovered, setHovered] = useState(null); // { name, friends, left, top } | null
  const wrapRef = useRef(null);

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

  // Tap-anywhere-else dismissal for the tooltip (pinned by mouse leave on
  // desktop and tap-elsewhere on touch).
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
          projectionConfig={{ scale: 130, center: [10, 22] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup minZoom={0.8} maxZoom={6}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map(geo => {
                  const name = canon(geo.properties.name);
                  const friends = visitedMap.get(name.toLowerCase().trim()) || null;
                  const visited = !!friends;
                  const isActive = visited && hovered?.name === name;
                  const handler = visited ? (event) => {
                    const ev = event.nativeEvent || event;
                    const rect = wrapRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHovered({
                      name,
                      friends,
                      left: ev.clientX - rect.left,
                      top: ev.clientY - rect.top,
                    });
                  } : undefined;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      data-fcm-visited={visited ? 'true' : 'false'}
                      onMouseEnter={handler}
                      onClick={handler}
                      fill={
                        visited
                          ? (isActive ? '#E0C868' : '#C9A84C')
                          : 'rgba(250,250,250,0.08)'
                      }
                      stroke={isActive ? '#FFFFFF' : 'rgba(250,250,250,0.12)'}
                      strokeWidth={isActive ? 1.2 : 0.4}
                      style={{
                        default: { outline: 'none', cursor: visited ? 'pointer' : 'default' },
                        hover: {
                          outline: 'none',
                          fill: visited ? '#D4B85C' : 'rgba(250,250,250,0.14)',
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

        {hovered && (
          <div
            className="fcm-tooltip"
            style={{ left: hovered.left, top: hovered.top }}
            role="tooltip"
            onMouseLeave={() => setHovered(null)}
          >
            <div className="fcm-tooltip-title">{hovered.name}</div>
            <div className="fcm-tooltip-list">
              {hovered.friends.slice(0, 8).map(f => (
                <div key={f.userId} className="fcm-tooltip-friend">
                  <span className="fcm-tooltip-avatar">
                    {f.avatarUrl
                      ? <img src={f.avatarUrl} alt="" />
                      : <span>{(f.displayName || '?').charAt(0).toUpperCase()}</span>
                    }
                  </span>
                  <span className="fcm-tooltip-name">{f.displayName || 'Friend'}</span>
                </div>
              ))}
              {hovered.friends.length > 8 && (
                <div className="fcm-tooltip-more">+{hovered.friends.length - 8} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
