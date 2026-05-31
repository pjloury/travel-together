// SeasonalMap — Leaflet map of curated experiences.
// Pins are clickable; opens ExperienceModal with Escape dismiss,
// Favorite and Add-to-Dreams actions.
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import api from '../api/client';
import ExperienceModal, { categoryColor } from './ExperienceModal';

// Fix Vite asset paths for Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

function makePin(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="2"/>
    <line x1="12" y1="21" x2="12" y2="32" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  return L.divIcon({ html: svg, className: '', iconSize: [24, 32], iconAnchor: [12, 32] });
}

export default function SeasonalMap({ filters, favorites, onToggleFav }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [experiences, setExperiences] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load map data
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters?.inSeasonOnly) params.set('month', new Date().getMonth() + 1);
    if (filters?.category) params.set('category', filters.category);
    if (filters?.vibe) params.set('vibe', filters.vibe);
    api.get(`/seasonal/map?${params}`)
      .then(res => setExperiences(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filters?.inSeasonOnly, filters?.category, filters?.vibe]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    mapInstanceRef.current = L.map(mapRef.current, { center: [20, 0], zoom: 2, minZoom: 2 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18,
    }).addTo(mapInstanceRef.current);
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    experiences.forEach(exp => {
      const marker = L.marker([exp.lat, exp.lon], { icon: makePin(categoryColor(exp)) });
      marker.on('click', () => setSelected(exp));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [experiences]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  return (
    <div className="se-map-wrap">
      {loading && <div className="se-map-loading">Loading map…</div>}
      <div ref={mapRef} className="se-map-container" />
      {selected && (
        <ExperienceModal
          exp={selected}
          onClose={() => setSelected(null)}
          favored={favorites?.has(selected.id)}
          onToggleFav={() => onToggleFav?.(selected.id)}
        />
      )}
    </div>
  );
}
