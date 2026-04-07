// PinMap — Leaflet map showing memory/dream pins with click-to-detail.
// Uses leaflet directly (no React wrapper) to avoid ESM/Rollup issues.

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { countryFlag } from '../utils/countryFlag';

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

// Custom circular marker icons
function makeCircleIcon(color, label, size = 32) {
  const r = size * 0.4;
  const h = size * 1.19;
  const cx = size / 2;
  const cy = size / 2;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="2.5"/>
      <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="${size * 0.44}">${label}</text>
      <path d="M${cx} ${h} L${cx} ${cy + r}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, h],
    iconAnchor: [cx, h],
    popupAnchor: [0, -h - 4],
  });
}

// Focused (enlarged, white-ringed) variant
function makeFocusedIcon(color, label) {
  const size = 42;
  const r = 17;
  const h = 52;
  const cx = 21;
  const cy = 21;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${h}" viewBox="0 0 ${size} ${h}">
      <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="white" opacity="0.25"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="3"/>
      <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="18">${label}</text>
      <path d="M${cx} ${h} L${cx} ${cy + r}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size, h],
    iconAnchor: [cx, h],
    popupAnchor: [0, -h - 4],
  });
}

const MEMORY_COLOR = '#C9A84C';
const DREAM_COLOR  = '#1A8FBF';

/**
 * Pick the best emoji for a pin marker:
 * 1. First tag's emoji (e.g. 🍜 Food & Drink, 🌊 Beach & Water)
 * 2. Country flag emoji derived from normalizedCountry
 * 3. Default fallback (📍 for memories, ✦ for dreams)
 */
function getPinEmoji(pin, fallback) {
  // Try first tag emoji
  if (pin.tags && pin.tags.length > 0) {
    const tagEmoji = pin.tags[0].emoji;
    if (tagEmoji) return tagEmoji;
  }
  // Try country flag
  const flag = countryFlag(pin.normalizedCountry);
  if (flag) return flag;
  // Default
  return fallback;
}

/**
 * PinMap renders a Leaflet map with a marker per pin.
 *
 * @param {Array}    props.pins       - All pins
 * @param {string}   props.tab        - 'memory' | 'dream'
 * @param {function} [props.onPinPress]  - Called with pin when marker clicked
 * @param {Object}   [props.focusedPin] - Pin to fly to + highlight
 */
export default function PinMap({ pins, tab, onPinPress, focusedPin, focusedPinLocations }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);   // { marker, pin, isStop, emoji } objects
  const subMarkersRef = useRef([]);  // sub-location markers for focused pin
  const pinsRef      = useRef(pins); // latest pins for focused-icon swap

  pinsRef.current = pins;

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Rebuild markers when pins or tab changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(({ marker }) => marker.remove());
    markersRef.current = [];

    const color    = tab === 'memory' ? MEMORY_COLOR : DREAM_COLOR;
    const fallback = tab === 'memory' ? '📍' : '✦';
    const stopColor = tab === 'memory' ? 'rgba(201,168,76,0.55)' : 'rgba(26,143,191,0.55)';
    const stopIcon  = makeCircleIcon(stopColor, '📍', 24);

    const bounds = [];

    (pins || []).forEach(pin => {
      if (!pin.latitude || !pin.longitude) return;

      const emoji = getPinEmoji(pin, fallback);
      const icon  = makeCircleIcon(color, emoji);

      const marker = L.marker([pin.latitude, pin.longitude], { icon }).addTo(map);
      marker.bindTooltip(pin.placeName, {
        permanent: false, direction: 'top', offset: [0, -36], className: 'pin-map-tooltip',
      });
      if (onPinPress) marker.on('click', () => onPinPress(pin));

      markersRef.current.push({ marker, pin, isStop: false, emoji });
      bounds.push([pin.latitude, pin.longitude]);

      // Sub-stop markers
      (pin.locations || []).forEach(loc => {
        if (!loc.latitude || !loc.longitude) return;
        const sm = L.marker([loc.latitude, loc.longitude], { icon: stopIcon }).addTo(map);
        const lbl = loc.placeName + (loc.normalizedCountry ? `, ${loc.normalizedCountry}` : '');
        sm.bindTooltip(lbl, {
          permanent: false, direction: 'top', offset: [0, -28], className: 'pin-map-tooltip',
        });
        if (onPinPress) sm.on('click', () => onPinPress(pin));
        markersRef.current.push({ marker: sm, pin, isStop: true, emoji: '📍' });
        bounds.push([loc.latitude, loc.longitude]);
      });
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, tab]);

  // Fly to + highlight focused pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const color = tab === 'memory' ? MEMORY_COLOR : DREAM_COLOR;

    // Reset all primary markers to their own emoji icon
    markersRef.current.forEach(({ marker, isStop, emoji }) => {
      if (!isStop) marker.setIcon(makeCircleIcon(color, emoji));
    });

    if (!focusedPin) return;

    // Find and highlight the focused marker
    const entry = markersRef.current.find(
      ({ pin, isStop }) => !isStop && pin.id === focusedPin.id
    );
    if (entry) {
      entry.marker.setIcon(makeFocusedIcon(color, entry.emoji));
      entry.marker.setZIndexOffset(1000);
    }

    // Fly to pin location if it has coordinates
    if (focusedPin.latitude && focusedPin.longitude) {
      map.flyTo([focusedPin.latitude, focusedPin.longitude], 6, {
        animate: true,
        duration: 0.8,
      });
    }

    // Show sub-location markers for the focused pin
    // Clean up previous sub-markers
    subMarkersRef.current.forEach(m => map.removeLayer(m));
    subMarkersRef.current = [];

    const locs = focusedPinLocations || focusedPin.locations || [];
    const focusStopIcon = makeCircleIcon('#666', '📍', 24);
    const subBounds = [];

    // Add the main pin to bounds
    if (focusedPin.latitude && focusedPin.longitude) {
      subBounds.push([focusedPin.latitude, focusedPin.longitude]);
    }

    locs.forEach(loc => {
      if (!loc.latitude || !loc.longitude) return;
      const sm = L.marker([loc.latitude, loc.longitude], { icon: focusStopIcon }).addTo(map);
      sm.bindTooltip(loc.placeName || '', {
        permanent: false, direction: 'top', offset: [0, -28], className: 'pin-map-tooltip',
      });
      sm.setZIndexOffset(500);
      subMarkersRef.current.push(sm);
      subBounds.push([loc.latitude, loc.longitude]);
    });

    // If there are sub-locations, reframe to fit all pins
    if (subBounds.length > 1) {
      map.fitBounds(subBounds, { padding: [50, 50], maxZoom: 10, animate: true });
    }
  }, [focusedPin, focusedPinLocations, tab]);

  const located  = (pins || []).filter(p => p.latitude && p.longitude);
  const stopCount = (pins || []).reduce(
    (acc, p) => acc + (p.locations?.filter(l => l.latitude)?.length || 0), 0
  );
  const total   = (pins || []).length;
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
