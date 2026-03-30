// PinMap — embedded map view for the PAST and FUTURE tabs.
// PAST tab: choropleth of visited countries.
// FUTURE tab: gold dot markers at dream destination coordinates.

import { useState, useEffect, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import api from '../api/client';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

function MapTooltip({ content, x, y }) {
  if (!content) return null;
  return (
    <div
      className="pin-map-tooltip"
      style={{ left: x + 12, top: y - 36, position: 'fixed', pointerEvents: 'none', zIndex: 9999 }}
    >
      {content}
    </div>
  );
}

export default function PinMap({ tab }) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState({ content: '', x: 0, y: 0 });
  const [position, setPosition] = useState({ coordinates: [10, 20], zoom: 1 });

  useEffect(() => {
    setLoading(true);
    api.get('/pins/map-data')
      .then(res => { setMapData(res.data?.data || res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const visitedSet = useMemo(() => {
    if (!mapData?.visitedCountries) return new Set();
    return new Set(mapData.visitedCountries.map(c => c.toLowerCase().trim()));
  }, [mapData]);

  const dreamPinsWithCoords = useMemo(() => {
    if (!mapData?.dreamPins) return [];
    return mapData.dreamPins.filter(p => p.lat != null && p.lng != null);
  }, [mapData]);

  const dreamPinsNoCoords = useMemo(() => {
    if (!mapData?.dreamPins) return [];
    return mapData.dreamPins.filter(p => p.lat == null || p.lng == null);
  }, [mapData]);

  function isVisited(name) {
    return visitedSet.has(name.toLowerCase().trim());
  }

  if (loading) {
    return (
      <div className="pin-map-loading">
        <div className="pin-map-spinner" />
        <span>Loading map…</span>
      </div>
    );
  }

  const totalVisited = mapData?.totalVisited || 0;
  const totalDreams = mapData?.totalDreams || 0;

  // ── MEMORIES: choropleth ──
  if (tab === 'memory') {
    return (
      <div className="pin-map-wrap">
        <div className="pin-map-bar">
          <span className="pin-map-stat">
            <span className="pin-map-stat-num">{totalVisited}</span>
            {' '}{totalVisited === 1 ? 'country' : 'countries'} visited
          </span>
          <div className="pin-map-legend">
            <span className="pin-map-swatch" />
            Visited
          </div>
        </div>

        <div className="pin-map-canvas">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: 140, center: [10, 20] }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={setPosition}
              minZoom={0.7}
              maxZoom={10}
            >
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const visited = isVisited(geo.properties.name);
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={visited ? '#C9A84C' : '#EDE9E1'}
                        stroke="#FFFFFF"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: 'none' },
                          hover: { outline: 'none', fill: visited ? '#B8923C' : '#D9D2C4', cursor: visited ? 'pointer' : 'default' },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={(e) => visited && setTooltip({ content: geo.properties.name, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => visited && setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                        onMouseLeave={() => setTooltip({ content: '', x: 0, y: 0 })}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {totalVisited === 0 && (
            <div className="pin-map-empty">
              <p>Add memories to colour in<br />the countries you've visited</p>
            </div>
          )}
        </div>

        <MapTooltip {...tooltip} />
      </div>
    );
  }

  // ── DREAMS: pin markers ──
  return (
    <div className="pin-map-wrap">
      <div className="pin-map-bar">
        <span className="pin-map-stat">
          <span className="pin-map-stat-num">{totalDreams}</span>
          {' '}{totalDreams === 1 ? 'dream destination' : 'dream destinations'}
        </span>
      </div>

      <div className="pin-map-canvas">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 140, center: [10, 20] }}
          style={{ width: '100%', height: '100%' }}
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            onMoveEnd={setPosition}
            minZoom={0.7}
            maxZoom={10}
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
                onMouseEnter={(e) => setTooltip({ content: pin.placeName, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
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
          <div className="pin-map-empty">
            <p>Add dream destinations to see<br />them appear on the map</p>
          </div>
        )}

        {/* Unlisted dreams sidebar */}
        {dreamPinsNoCoords.length > 0 && (
          <div className="pin-map-unlisted">
            <p className="pin-map-unlisted-label">Not yet located</p>
            {dreamPinsNoCoords.map(pin => (
              <span key={pin.id} className="pin-map-unlisted-item">{pin.placeName}</span>
            ))}
          </div>
        )}
      </div>

      <MapTooltip {...tooltip} />
    </div>
  );
}
