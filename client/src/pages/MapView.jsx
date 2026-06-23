// MapView — two-tab world map: visited countries (choropleth) + dream destinations (pins)

import { useState, useEffect, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import Layout from '../components/Layout';
import api from '../api/client';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Tooltip component
function Tooltip({ content, x, y }) {
  if (!content) return null;
  return (
    <div
      className="map-tooltip"
      style={{ left: x + 12, top: y - 28, position: 'fixed', pointerEvents: 'none', zIndex: 9999 }}
    >
      {content}
    </div>
  );
}

export default function MapView() {
  const [tab, setTab] = useState('memories'); // 'memories' | 'dreams' | 'parks' | 'resorts'
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tooltip, setTooltip] = useState({ content: '', x: 0, y: 0 });
  const [position, setPosition] = useState({ coordinates: [0, 20], zoom: 1 });
  const [venueData, setVenueData] = useState(null);
  const [venueLoading, setVenueLoading] = useState(false);

  useEffect(() => {
    api.get('/pins/map-data')
      .then(res => {
        setMapData(res.data?.data || res.data);
        setLoading(false);
      })
      .catch(() => {
        setError('Could not load map data.');
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (tab !== 'parks' && tab !== 'resorts') return;
    setVenueLoading(true);
    const type = tab === 'parks' ? 'national_park' : 'ski_resort';
    api.get('/venues/all', { params: { type } })
      .then(res => {
        setVenueData(res.data?.data || []);
        setVenueLoading(false);
      })
      .catch(() => setVenueLoading(false));
  }, [tab]);

  // Visited country names as a Set for O(1) lookup (case-insensitive)
  const visitedSet = useMemo(() => {
    if (!mapData?.visitedCountries) return new Set();
    return new Set(mapData.visitedCountries.map(c => c.toLowerCase().trim()));
  }, [mapData]);

  // Dream pins with coordinates
  const dreamPinsWithCoords = useMemo(() => {
    if (!mapData?.dreamPins) return [];
    return mapData.dreamPins.filter(p => p.lat != null && p.lng != null);
  }, [mapData]);

  // Dream pins without coords (country-only) for a fallback list
  const dreamPinsNoCoords = useMemo(() => {
    if (!mapData?.dreamPins) return [];
    return mapData.dreamPins.filter(p => p.lat == null || p.lng == null);
  }, [mapData]);

  function handleMoveEnd(pos) {
    setPosition(pos);
  }

  function isVisited(geoName) {
    return visitedSet.has(geoName.toLowerCase().trim());
  }

  if (loading) {
    return (
      <Layout>
        <div className="map-page">
          <div className="map-loading">
            <div className="map-loading-spinner" />
            <p>Loading your map…</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="map-page">
          <p className="map-error">{error}</p>
        </div>
      </Layout>
    );
  }

  const totalVisited = mapData?.totalVisited || 0;
  const totalDreams = mapData?.totalDreams || 0;

  return (
    <Layout>
      <div className="map-page">
        {/* Header */}
        <div className="map-header">
          <div className="map-header-left">
            <h1 className="map-title">Your World</h1>
            <div className="map-stats">
              <span className="map-stat">
                <span className="map-stat-num">{totalVisited}</span>
                <span className="map-stat-label">{totalVisited === 1 ? 'country' : 'countries'} visited</span>
              </span>
              <span className="map-stat-sep">·</span>
              <span className="map-stat">
                <span className="map-stat-num">{totalDreams}</span>
                <span className="map-stat-label">{totalDreams === 1 ? 'dream' : 'dreams'}</span>
              </span>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="map-tabs">
            <button
              className={`map-tab${tab === 'memories' ? ' map-tab-active' : ''}`}
              onClick={() => setTab('memories')}
            >
              Memories
            </button>
            <button
              className={`map-tab${tab === 'dreams' ? ' map-tab-active' : ''}`}
              onClick={() => setTab('dreams')}
            >
              Dreams
            </button>
            <button
              className={`map-tab${tab === 'parks' ? ' map-tab-active' : ''}`}
              onClick={() => setTab('parks')}
            >
              🏞️ Parks
            </button>
            <button
              className={`map-tab${tab === 'resorts' ? ' map-tab-active' : ''}`}
              onClick={() => setTab('resorts')}
            >
              🎿 Resorts
            </button>
          </div>
        </div>

        {/* ── Memories map: visited countries choropleth ── */}
        {tab === 'memories' && (
          <div className="map-container">
            <div className="map-legend">
              <span className="map-legend-swatch map-legend-visited" />
              <span className="map-legend-text">Visited</span>
            </div>

            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 140, center: [10, 20] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates}
                onMoveEnd={handleMoveEnd}
                minZoom={0.8}
                maxZoom={8}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const visited = isVisited(geo.properties.name);
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={visited ? '#C9A84C' : 'rgba(250,250,250,0.08)'}
                          stroke="rgba(250,250,250,0.12)"
                          strokeWidth={0.4}
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none', fill: visited ? '#D4B85C' : 'rgba(250,250,250,0.14)', cursor: 'pointer' },
                            pressed: { outline: 'none' },
                          }}
                          onMouseEnter={(evt) => {
                            if (visited) {
                              setTooltip({ content: geo.properties.name, x: evt.clientX, y: evt.clientY });
                            }
                          }}
                          onMouseMove={(evt) => {
                            if (visited) {
                              setTooltip(t => ({ ...t, x: evt.clientX, y: evt.clientY }));
                            }
                          }}
                          onMouseLeave={() => setTooltip({ content: '', x: 0, y: 0 })}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {totalVisited === 0 && (
              <div className="map-empty-overlay">
                <p className="map-empty-text">
                  Add voice memories to see<br />your visited countries appear
                </p>
              </div>
            )}

            <Tooltip {...tooltip} />
          </div>
        )}

        {/* ── Dreams map: pin markers ── */}
        {tab === 'dreams' && (
          <div className="map-container">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 140, center: [10, 20] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates}
                onMoveEnd={handleMoveEnd}
                minZoom={0.8}
                maxZoom={8}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="#EDE9E1"
                        stroke="#FFFFFF"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', fill: '#E0DAD0', cursor: 'default' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {dreamPinsWithCoords.map((pin) => (
                  <Marker
                    key={pin.id}
                    coordinates={[pin.lng, pin.lat]}
                    onMouseEnter={(evt) => setTooltip({ content: pin.placeName, x: evt.clientX, y: evt.clientY })}
                    onMouseMove={(evt) => setTooltip(t => ({ ...t, x: evt.clientX, y: evt.clientY }))}
                    onMouseLeave={() => setTooltip({ content: '', x: 0, y: 0 })}
                  >
                    <circle
                      r={5 / position.zoom}
                      fill="#C9A84C"
                      stroke="#FFFFFF"
                      strokeWidth={1.5 / position.zoom}
                      style={{ cursor: 'pointer' }}
                    />
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            {totalDreams === 0 && (
              <div className="map-empty-overlay">
                <p className="map-empty-text">
                  Add dream destinations to see<br />them appear on your map
                </p>
              </div>
            )}

            {/* Dreams without coordinates — shown as a sidebar list */}
            {dreamPinsNoCoords.length > 0 && (
              <div className="map-unlisted">
                <p className="map-unlisted-label">Not yet located</p>
                {dreamPinsNoCoords.map(pin => (
                  <span key={pin.id} className="map-unlisted-item">{pin.placeName}</span>
                ))}
              </div>
            )}

            <Tooltip {...tooltip} />
          </div>
        )}

        {/* ── Venues map: national parks or ski resorts ── */}
        {(tab === 'parks' || tab === 'resorts') && (
          <div className="map-container">
            {venueLoading && (
              <div className="map-loading" style={{ position: 'absolute', zIndex: 10 }}>
                <div className="map-loading-spinner" />
              </div>
            )}
            <div className="map-legend">
              <span className="map-legend-swatch" style={{ background: tab === 'parks' ? '#2d7a4f' : '#3a6bb5' }} />
              <span className="map-legend-text">Visited</span>
              <span className="map-legend-swatch" style={{ background: 'rgba(250,250,250,0.15)', marginLeft: 12 }} />
              <span className="map-legend-text">Not yet</span>
            </div>

            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 140, center: [10, 20] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates}
                onMoveEnd={handleMoveEnd}
                minZoom={0.8}
                maxZoom={8}
              >
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill="rgba(250,250,250,0.06)"
                        stroke="rgba(250,250,250,0.12)"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none' },
                          pressed: { outline: 'none' },
                        }}
                      />
                    ))
                  }
                </Geographies>

                {(venueData || []).map((venue) => (
                  <Marker
                    key={venue.id}
                    coordinates={[venue.longitude, venue.latitude]}
                    onMouseEnter={(evt) => setTooltip({ content: venue.name, x: evt.clientX, y: evt.clientY })}
                    onMouseMove={(evt) => setTooltip(t => ({ ...t, x: evt.clientX, y: evt.clientY }))}
                    onMouseLeave={() => setTooltip({ content: '', x: 0, y: 0 })}
                  >
                    <circle
                      r={venue.visited ? 6 / position.zoom : 4 / position.zoom}
                      fill={venue.visited
                        ? (tab === 'parks' ? '#2d7a4f' : '#3a6bb5')
                        : 'rgba(250,250,250,0.2)'}
                      stroke={venue.visited ? '#FFFFFF' : 'rgba(250,250,250,0.4)'}
                      strokeWidth={1.5 / position.zoom}
                      style={{ cursor: venue.visited ? 'pointer' : 'default' }}
                    />
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            {!venueLoading && venueData && (
              <div className="map-unlisted" style={{ bottom: 16, left: 16, right: 'auto', maxWidth: 200 }}>
                <p className="map-unlisted-label">
                  {venueData.filter(v => v.visited).length} / {venueData.length} visited
                </p>
              </div>
            )}

            <Tooltip {...tooltip} />
          </div>
        )}
      </div>
    </Layout>
  );
}
