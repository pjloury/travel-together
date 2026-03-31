// PinMap — Leaflet map showing memory/dream pins with click-to-detail.
// Uses leaflet directly (no React wrapper) to avoid ESM/Rollup issues.

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default marker icon broken paths in Vite builds
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom circular marker for memories (warm gold) and dreams (blue)
function makeCircleIcon(color, label) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="38" viewBox="0 0 32 38">
      <circle cx="16" cy="16" r="13" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="16" y="21" text-anchor="middle" font-size="14">${label}</text>
      <path d="M16 38 L16 29" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -40],
  });
}

const MEMORY_ICON = makeCircleIcon('#C9A84C', '📍');
const DREAM_ICON  = makeCircleIcon('#1A8FBF', '✦');

/**
 * PinMap renders a Leaflet map with a marker per pin that has coordinates.
 *
 * @param {Object} props
 * @param {Array} props.pins - All pins (need .latitude, .longitude, .placeName, .pinType)
 * @param {'memory'|'dream'} props.tab
 * @param {function} [props.onPinPress] - Called with pin object when marker is clicked
 */
export default function PinMap({ pins, tab, onPinPress }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 1,
      maxZoom: 16,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when pins change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const located = (pins || []).filter(p => p.latitude && p.longitude);
    // Also collect additional stops from pin.locations
    const stopPoints = [];
    (pins || []).forEach(pin => {
      if (pin.locations && pin.locations.length > 0) {
        pin.locations.forEach(loc => {
          if (loc.latitude && loc.longitude) {
            stopPoints.push({ ...loc, _parentPin: pin });
          }
        });
      }
    });

    if (located.length === 0 && stopPoints.length === 0) return;

    const icon = tab === 'memory' ? MEMORY_ICON : DREAM_ICON;
    // Smaller icon for sub-stops (slightly translucent version)
    const stopIcon = makeCircleIcon(
      tab === 'memory' ? 'rgba(201,168,76,0.6)' : 'rgba(26,143,191,0.6)',
      '📍'
    );
    const bounds = [];

    located.forEach(pin => {
      const marker = L.marker([pin.latitude, pin.longitude], { icon })
        .addTo(map);

      marker.bindTooltip(pin.placeName, {
        permanent: false,
        direction: 'top',
        offset: [0, -36],
        className: 'pin-map-tooltip',
      });

      if (onPinPress) {
        marker.on('click', () => onPinPress(pin));
      }

      markersRef.current.push(marker);
      bounds.push([pin.latitude, pin.longitude]);
    });

    // Render stop markers (clicking opens the parent pin)
    stopPoints.forEach(stop => {
      const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
        .addTo(map);

      const label = stop.placeName + (stop.normalizedCountry ? `, ${stop.normalizedCountry}` : '');
      marker.bindTooltip(label, {
        permanent: false,
        direction: 'top',
        offset: [0, -36],
        className: 'pin-map-tooltip',
      });

      if (onPinPress) {
        marker.on('click', () => onPinPress(stop._parentPin));
      }

      markersRef.current.push(marker);
      bounds.push([stop.latitude, stop.longitude]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
    }
  }, [pins, tab, onPinPress]);

  const located = (pins || []).filter(p => p.latitude && p.longitude);
  const stopCount = (pins || []).reduce((acc, p) => acc + (p.locations?.filter(l => l.latitude)?.length || 0), 0);
  const total = (pins || []).length;
  const missing = total - located.length;

  return (
    <div className="pin-map-wrap">
      <div ref={containerRef} className="pin-map-container" />
      {(missing > 0 || stopCount > 0) && (
        <p className="pin-map-notice">
          {located.length} of {total} {tab === 'memory' ? 'memories' : 'dreams'} mapped
          {stopCount > 0 && ` · ${stopCount} extra stop${stopCount > 1 ? 's' : ''}`}
          {missing > 0 && ` · ${missing} pending lookup`}
        </p>
      )}
    </div>
  );
}
