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
import { useAuth } from '../context/AuthContext';

// Fix Vite asset paths for Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const CATEGORY_COLORS = {
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

function pinColor(exp) {
  return CATEGORY_COLORS[exp.categories?.[0]] || DEFAULT_COLOR;
}

function makePin(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="32" viewBox="0 0 24 32">
    <circle cx="12" cy="12" r="9" fill="${color}" stroke="white" stroke-width="2"/>
    <line x1="12" y1="21" x2="12" y2="32" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -34],
  });
}

export default function SeasonalMap({ filters }) {
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
    mapInstanceRef.current = L.map(mapRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(mapInstanceRef.current);
  }, []);

  // Sync markers when experiences change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    experiences.forEach(exp => {
      const marker = L.marker([exp.lat, exp.lon], { icon: makePin(pinColor(exp)) });
      marker.on('click', () => setSelected(exp));
      marker.addTo(map);
      markersRef.current.push(marker);
    });
  }, [experiences]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div className="se-map-wrap">
      {loading && <div className="se-map-loading">Loading map…</div>}
      <div ref={mapRef} className="se-map-container" />
      {selected && (
        <ExperienceModal exp={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function ExperienceModal({ exp, onClose }) {
  const { user } = useAuth();
  const [imgError, setImgError] = useState(false);
  const [favored, setFavored] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  // Escape key dismiss
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
      });
      showToast(`✓ Added "${exp.name}" to your dreams`);
    } catch {
      showToast('Could not add — try again');
    } finally {
      setAdding(false);
    }
  }

  const months = exp.months?.length ? exp.months.map(m => MONTH_ABBR[m - 1]).join(', ') : 'Year-round';
  const color = CATEGORY_COLORS[exp.categories?.[0]] || DEFAULT_COLOR;

  return (
    <>
      <div className="se-modal-backdrop" onClick={onClose} />
      <div className="se-modal">
        <button className="se-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {/* Hero */}
        <div className="se-modal-hero" style={{ background: `linear-gradient(135deg, ${color}99, ${color}44)` }}>
          {exp.imageUrl && !imgError ? (
            <img src={exp.imageUrl} alt={exp.name} className="se-modal-hero-img" onError={() => setImgError(true)} />
          ) : (
            <div className="se-modal-hero-placeholder" style={{ background: `linear-gradient(135deg, ${color}cc, ${color}66)` }} />
          )}
        </div>

        {/* Content */}
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

          {exp.description && (
            <p className="se-modal-desc">{exp.description}</p>
          )}

          {exp.vibeTags?.length > 0 && (
            <div className="se-modal-vibes">
              {exp.vibeTags.map(t => (
                <span key={t} className="se-card-vibe-tag">#{t}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="se-modal-actions">
            <button
              className={`se-modal-fav-btn${favored ? ' se-modal-fav-btn-active' : ''}`}
              onClick={() => setFavored(f => !f)}
              title="Favorite"
            >
              {favored ? '♥ Favorited' : '♡ Favorite'}
            </button>

            {user ? (
              <button
                className="se-modal-dream-btn"
                onClick={handleAddToDreams}
                disabled={adding}
              >
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
