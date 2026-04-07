// Gallery — masonry grid of stunning travel photos
// Users can browse, filter by region, and add photos as dream pins

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Gallery() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('All');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);

  const PAGE_SIZE = 30;

  const fetchPhotos = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const newOffset = reset ? 0 : offset;
      const res = await api.get(`/gallery?region=${encodeURIComponent(region)}&limit=${PAGE_SIZE}&offset=${newOffset}`);
      const data = res.photos || res.data?.photos || [];
      setPhotos(reset ? data : [...photos, ...data]);
      setTotal(res.total || res.data?.total || 0);
      if (reset) setOffset(PAGE_SIZE);
      else setOffset(newOffset + PAGE_SIZE);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [region, offset, photos]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!selectedPhoto) return;
    function handleKey(e) {
      if (e.key === 'Escape') setSelectedPhoto(null);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const idx = photos.findIndex(p => p.id === selectedPhoto.id);
        if (idx === -1) return;
        const next = e.key === 'ArrowRight' ? idx + 1 : idx - 1;
        if (next >= 0 && next < photos.length) setSelectedPhoto(photos[next]);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedPhoto, photos]);

  useEffect(() => {
    setPhotos([]);
    setOffset(0);
    fetchPhotos(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  async function handleAddDream(photo) {
    if (!user) return;
    setAdding(true);
    try {
      await api.post('/pins', {
        pinType: 'dream',
        placeName: `${photo.location}, ${photo.country}`,
        dreamNote: photo.description || '',
        unsplashImageUrl: photo.imageUrl,
        unsplashAttribution: photo.photographer ? `Photo by ${photo.photographer} on Unsplash` : null,
      });
      setToast(`✓ ${photo.location} added to your dreams`);
      setTimeout(() => setToast(''), 2500);
      setSelectedPhoto(null);
    } catch {
      setToast('Could not add — try again');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setAdding(false);
    }
  }

  async function handleIveBeenHere(photo) {
    if (!user) return;
    setAdding(true);
    try {
      await api.post('/pins', {
        pinType: 'memory',
        placeName: `${photo.location}, ${photo.country}`,
        note: `Visited ${photo.location}, ${photo.country}`,
        unsplashImageUrl: photo.imageUrl,
        unsplashAttribution: photo.photographer ? `Photo by ${photo.photographer} on Unsplash` : null,
      });
      setToast(`✓ ${photo.location} added to your memories`);
      setTimeout(() => setToast(''), 2500);
      setSelectedPhoto(null);
    } catch {
      setToast('Could not add — try again');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setAdding(false);
    }
  }

  async function handleDiscoverGems() {
    if (!user || suggesting) return;
    setSuggesting(true);
    try {
      const res = await api.post('/gallery/suggest');
      const data = res.data || res;
      const newSuggestions = (data.suggestions || []).map((s, i) => ({
        id: `suggestion-${Date.now()}-${i}`,
        imageUrl: s.imageUrl,
        thumbUrl: s.thumbUrl,
        location: s.location,
        country: s.country,
        region: s.region,
        description: s.description,
        photographer: null,
        isSuggestion: true,
      }));
      setSuggestions(newSuggestions);
      setToast(`\u2726 ${newSuggestions.length} hidden gems discovered!`);
      setTimeout(() => setToast(''), 2500);
    } catch {
      setToast('Could not discover gems \u2014 try again');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setSuggesting(false);
    }
  }

  const regions = ['All', 'Africa', 'Asia', 'Europe', 'Latin America', 'Middle East', 'North America', 'Oceania', 'South America'];

  return (
    <div className="gallery">
      {/* Region filter + Discover button */}
      <div className="gallery-filters">
        {regions.map(r => (
          <button
            key={r}
            className={`explore-filter-pill${region === r ? ' active' : ''}`}
            onClick={() => setRegion(r)}
          >
            {r}
          </button>
        ))}
        {user && (
          <button
            className="gallery-discover-btn"
            onClick={handleDiscoverGems}
            disabled={suggesting}
          >
            {suggesting ? 'Discovering\u2026' : '\u2726 Discover hidden gems'}
          </button>
        )}
      </div>

      {/* AI-suggested hidden gems */}
      {suggestions.length > 0 && (
        <div className="gallery-suggestions">
          <div className="gallery-suggestions-header">
            <h3 className="gallery-suggestions-title">{'\u2726'} Hidden Gems</h3>
            <button
              className="gallery-suggestions-dismiss"
              onClick={() => setSuggestions([])}
            >
              Dismiss
            </button>
          </div>
          <div className="gallery-grid">
            {suggestions.map(photo => (
              <div
                key={photo.id}
                className="gallery-item gallery-item-suggestion"
                onClick={() => setSelectedPhoto(photo)}
              >
                {photo.imageUrl ? (
                  <img
                    src={photo.thumbUrl || photo.imageUrl}
                    alt={photo.description || photo.location}
                    loading="lazy"
                  />
                ) : (
                  <div className="gallery-item-placeholder" />
                )}
                <div className="gallery-item-overlay" style={{ opacity: 1 }}>
                  <span className="gallery-item-location">{photo.location}</span>
                  <span className="gallery-item-country">{photo.country}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo grid */}
      <div className="gallery-grid">
        {photos.map(photo => (
          <div
            key={photo.id}
            className="gallery-item"
            onClick={() => setSelectedPhoto(photo)}
          >
            <img
              src={photo.thumbUrl || photo.imageUrl}
              alt={photo.description || photo.location}
              loading="lazy"
            />
            <div className="gallery-item-overlay">
              <span className="gallery-item-location">{photo.location}</span>
              <span className="gallery-item-country">{photo.country}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Load more */}
      {photos.length < total && !loading && (
        <div className="gallery-load-more">
          <button className="gallery-load-btn" onClick={() => fetchPhotos(false)}>
            Load more ({total - photos.length} remaining)
          </button>
        </div>
      )}

      {loading && photos.length === 0 && (
        <div className="gallery-loading">
          <div className="loading-spinner-sm" />
          <p className="loading-phrase">Curating the world's most beautiful views…</p>
        </div>
      )}

      {/* Photo lightbox */}
      {selectedPhoto && (
        <>
          <div className="gallery-lightbox-backdrop" onClick={() => setSelectedPhoto(null)} />
          <div className="gallery-lightbox">
            <button className="gallery-lightbox-close" onClick={() => setSelectedPhoto(null)}>×</button>
            <img src={selectedPhoto.imageUrl} alt={selectedPhoto.description || selectedPhoto.location} />
            <div className="gallery-lightbox-info">
              <div className="gallery-lightbox-location">
                <h3>{selectedPhoto.location}</h3>
                <p>{selectedPhoto.country} · {selectedPhoto.region}</p>
              </div>
              {selectedPhoto.description && (
                <p className="gallery-lightbox-desc">{selectedPhoto.description}</p>
              )}
              {selectedPhoto.photographer && (
                <p className="gallery-lightbox-credit">Photo by {selectedPhoto.photographer}</p>
              )}
              {user && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button
                    className="gallery-lightbox-dream-btn"
                    onClick={() => handleAddDream(selectedPhoto)}
                    disabled={adding}
                  >
                    {adding ? 'Adding…' : `✦ Dream of ${selectedPhoto.location}`}
                  </button>
                  <button
                    className="gallery-lightbox-dream-btn"
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
                    onClick={() => handleIveBeenHere(selectedPhoto)}
                    disabled={adding}
                  >
                    🌍 I've been here
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div className="explore-toast">{toast}</div>}
    </div>
  );
}
