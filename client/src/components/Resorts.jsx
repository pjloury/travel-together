// Resorts — curated grid of world-class luxury resort destinations
// Users can browse iconic resorts and add them as dream pins
// Photos are fetched lazily from the server's Unsplash proxy

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const RESORTS = [
  { name: 'Soneva Fushi', location: 'Baa Atoll', country: 'Maldives', region: 'Asia', query: 'Soneva Fushi Maldives overwater villa' },
  { name: 'Aman Tokyo', location: 'Otemachi', country: 'Japan', region: 'Asia', query: 'Aman Tokyo hotel luxury' },
  { name: 'Four Seasons Bora Bora', location: 'Bora Bora', country: 'French Polynesia', region: 'Oceania', query: 'Four Seasons Bora Bora overwater bungalow' },
  { name: 'Singita Grumeti', location: 'Serengeti', country: 'Tanzania', region: 'Africa', query: 'Singita Grumeti safari lodge Serengeti' },
  { name: 'Jade Mountain', location: 'Soufriere', country: 'Saint Lucia', region: 'Latin America', query: 'Jade Mountain Saint Lucia pitons' },
  { name: 'Six Senses Zighy Bay', location: 'Musandam', country: 'Oman', region: 'Middle East', query: 'Six Senses Zighy Bay Oman beach resort' },
  { name: 'One&Only Reethi Rah', location: 'North Male Atoll', country: 'Maldives', region: 'Asia', query: 'Reethi Rah Maldives beach villa' },
  { name: 'Amanpuri', location: 'Phuket', country: 'Thailand', region: 'Asia', query: 'Amanpuri Phuket Thailand resort' },
  { name: 'The Brando', location: 'Tetiaroa', country: 'French Polynesia', region: 'Oceania', query: 'The Brando Tetiaroa private island resort' },
  { name: 'Nihi Sumba', location: 'Sumba Island', country: 'Indonesia', region: 'Asia', query: 'Nihi Sumba Indonesia luxury resort' },
  { name: 'Amangiri', location: 'Canyon Point', country: 'United States', region: 'North America', query: 'Amangiri resort Utah desert canyon' },
  { name: 'Explora Patagonia', location: 'Torres del Paine', country: 'Chile', region: 'Latin America', query: 'Explora Patagonia Torres del Paine lodge' },
  { name: 'Borgo Egnazia', location: 'Puglia', country: 'Italy', region: 'Europe', query: 'Borgo Egnazia Puglia Italy resort' },
  { name: 'Clayoquot Wilderness', location: 'Tofino', country: 'Canada', region: 'North America', query: 'Clayoquot wilderness resort Tofino Canada' },
  { name: 'Royal Mansour', location: 'Marrakech', country: 'Morocco', region: 'Africa', query: 'Royal Mansour Marrakech riad luxury' },
];

const BATCH_SIZE = 6;

export default function Resorts() {
  const { user } = useAuth();
  const [resortPhotos, setResortPhotos] = useState({}); // { index: { imageUrl, thumbUrl } }
  const [loadedCount, setLoadedCount] = useState(0);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [selectedResort, setSelectedResort] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  const fetchBatch = useCallback(async (startIdx) => {
    if (loadingBatch || startIdx >= RESORTS.length) return;
    setLoadingBatch(true);

    const endIdx = Math.min(startIdx + BATCH_SIZE, RESORTS.length);
    const batch = RESORTS.slice(startIdx, endIdx);

    const results = await Promise.allSettled(
      batch.map(async (resort, i) => {
        try {
          const res = await api.get(`/gallery/resort-photo?query=${encodeURIComponent(resort.query)}`);
          const data = res.data || res;
          return { index: startIdx + i, photo: data };
        } catch {
          return { index: startIdx + i, photo: null };
        }
      })
    );

    setResortPhotos(prev => {
      const next = { ...prev };
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.photo) {
          next[result.value.index] = result.value.photo;
        }
      }
      return next;
    });

    setLoadedCount(endIdx);
    setLoadingBatch(false);
  }, [loadingBatch]);

  // Fetch initial batch on mount
  useEffect(() => {
    fetchBatch(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Intersection observer for lazy loading more batches
  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && loadedCount < RESORTS.length && !loadingBatch) {
          fetchBatch(loadedCount);
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [loadedCount, loadingBatch, fetchBatch]);

  async function handleDreamOfThis(resort, idx) {
    if (!user || adding) return;
    setAdding(true);
    try {
      const photo = resortPhotos[idx];
      await api.post('/pins', {
        pinType: 'dream',
        placeName: `${resort.name}, ${resort.location}, ${resort.country}`,
        dreamNote: `Dream resort: ${resort.name}`,
        unsplashImageUrl: photo?.imageUrl || null,
        unsplashAttribution: photo?.imageUrl ? 'Photo from Unsplash' : null,
      });
      setToast(`\u2713 ${resort.name} added to your dreams`);
      setTimeout(() => setToast(''), 2500);
      setSelectedResort(null);
    } catch {
      setToast('Could not add \u2014 try again');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setAdding(false);
    }
  }

  // Keyboard nav for lightbox
  useEffect(() => {
    if (selectedResort === null) return;
    function handleKey(e) {
      if (e.key === 'Escape') setSelectedResort(null);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedResort]);

  return (
    <div className="resorts">
      <div className="resorts-grid">
        {RESORTS.map((resort, idx) => {
          const photo = resortPhotos[idx];
          return (
            <div
              key={idx}
              className="resorts-card"
              onClick={() => setSelectedResort(idx)}
            >
              <div
                className="resorts-card-hero"
                style={
                  photo?.imageUrl
                    ? { backgroundImage: `url(${photo.thumbUrl || photo.imageUrl})` }
                    : { background: 'linear-gradient(145deg, #1a1a2e, #16213e)' }
                }
              >
                {!photo?.imageUrl && (
                  <div className="resorts-card-placeholder">
                    <div className="loading-spinner-sm" />
                  </div>
                )}
                <div className="resorts-card-overlay">
                  <span className="resorts-card-region">{resort.region}</span>
                  <h3 className="resorts-card-name">{resort.name}</h3>
                  <p className="resorts-card-location">{resort.location}, {resort.country}</p>
                </div>
              </div>
              {user && (
                <div className="resorts-card-body">
                  <button
                    className="resorts-dream-btn"
                    onClick={(e) => { e.stopPropagation(); handleDreamOfThis(resort, idx); }}
                    disabled={adding}
                  >
                    {'\u2726'} Dream of this
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sentinel for lazy loading */}
      {loadedCount < RESORTS.length && (
        <div ref={sentinelRef} className="resorts-sentinel">
          {loadingBatch && (
            <div className="gallery-loading">
              <div className="loading-spinner-sm" />
              <p className="loading-phrase">Loading more resorts...</p>
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {selectedResort !== null && (
        <>
          <div className="gallery-lightbox-backdrop" onClick={() => setSelectedResort(null)} />
          <div className="gallery-lightbox">
            <button className="gallery-lightbox-close" onClick={() => setSelectedResort(null)}>
              &times;
            </button>
            <img
              src={resortPhotos[selectedResort]?.imageUrl || ''}
              alt={RESORTS[selectedResort].name}
            />
            <div className="gallery-lightbox-info">
              <div className="gallery-lightbox-location">
                <h3>{RESORTS[selectedResort].name}</h3>
                <p>{RESORTS[selectedResort].location} &middot; {RESORTS[selectedResort].country} &middot; {RESORTS[selectedResort].region}</p>
              </div>
              {user && (
                <button
                  className="gallery-lightbox-dream-btn"
                  onClick={() => handleDreamOfThis(RESORTS[selectedResort], selectedResort)}
                  disabled={adding}
                >
                  {adding ? 'Adding\u2026' : `\u2726 Dream of ${RESORTS[selectedResort].name}`}
                </button>
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
