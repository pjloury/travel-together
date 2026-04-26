// Resorts — curated grid of world-class luxury resort destinations.
// Hero photos are now served as static, hand-picked, license-cleared
// JPEGs from /public/resorts/<slug>.jpg (resized to 1600px, ~450KB
// each). The previous lazy Unsplash fetch was replaced because generic
// stock queries returned anonymous beach photos that didn't actually
// show the resort being marketed.

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

// Each entry: name, location, country, region, slug, hero (resolved by
// `slug` to /resorts/<slug>.jpg), and credit (license + photographer for
// the attribution footnote). Order is preserved as the display order.
const RESORTS = [
  {
    name: 'Soneva Fushi', location: 'Baa Atoll', country: 'Maldives',
    region: 'Asia', slug: 'soneva-fushi',
    credit: 'Photo: Markus Fritze / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Aman Tokyo', location: 'Otemachi', country: 'Japan',
    region: 'Asia', slug: 'aman-tokyo',
    credit: 'Photo: Marek Okon / Unsplash',
  },
  {
    name: 'Four Seasons Bora Bora', location: 'Bora Bora',
    country: 'French Polynesia', region: 'Oceania',
    slug: 'four-seasons-bora-bora',
    credit: 'Photo: Barbara Kraft via DL2A · CC BY-SA 3.0',
  },
  {
    name: 'Singita Grumeti', location: 'Serengeti', country: 'Tanzania',
    region: 'Africa', slug: 'singita-grumeti',
    credit: 'Photo: Mark Williams / Singita PR · CC BY-ND 2.0',
  },
  {
    name: 'Jade Mountain', location: 'Soufrière', country: 'Saint Lucia',
    region: 'Latin America', slug: 'jade-mountain',
    credit: 'Photo: Prayitno / Wikimedia · CC BY 2.0',
  },
  {
    name: 'Six Senses Zighy Bay', location: 'Musandam', country: 'Oman',
    region: 'Middle East', slug: 'six-senses-zighy-bay',
    credit: 'Photo: Wikimedia Commons · CC BY 2.5',
  },
  {
    name: 'One&Only Reethi Rah', location: 'North Malé Atoll',
    country: 'Maldives', region: 'Asia', slug: 'one-and-only-reethi-rah',
    credit: 'Photo: Studio Sarah Lou / Flickr · CC BY 2.0',
  },
  {
    name: 'Amanpuri', location: 'Phuket', country: 'Thailand',
    region: 'Asia', slug: 'amanpuri',
    credit: 'Photo: Christian Harrison / Flickr · CC BY-SA 2.0',
  },
  {
    name: 'The Brando', location: 'Tetiaroa',
    country: 'French Polynesia', region: 'Oceania', slug: 'the-brando',
    credit: 'Photo: Supertoff / Wikimedia · CC BY-SA 3.0',
  },
  {
    name: 'Nihi Sumba', location: 'Sumba Island', country: 'Indonesia',
    region: 'Asia', slug: 'nihi-sumba',
    credit: 'Photo: Wikimedia Commons · CC BY-SA 4.0',
  },
  {
    name: 'Amangiri', location: 'Canyon Point', country: 'United States',
    region: 'North America', slug: 'amangiri',
    credit: 'Photo: Steve Jurvetson / Wikimedia · CC BY 2.0',
  },
  {
    name: 'Explora Patagonia', location: 'Torres del Paine',
    country: 'Chile', region: 'Latin America',
    slug: 'explora-patagonia',
    credit: 'Photo: Travel South America / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Borgo Egnazia', location: 'Puglia', country: 'Italy',
    region: 'Europe', slug: 'borgo-egnazia',
    credit: 'Photo: Harald Philipp / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Clayoquot Wilderness', location: 'Tofino', country: 'Canada',
    region: 'North America', slug: 'clayoquot-wilderness',
    credit: 'Photo: Wikimedia Commons · CC BY-SA 4.0',
  },
  {
    name: 'Royal Mansour', location: 'Marrakech', country: 'Morocco',
    region: 'Africa', slug: 'royal-mansour',
    credit: 'Photo: Patrick Schierer / Flickr · CC BY-ND 2.0',
  },
];

function heroFor(resort) {
  return `/resorts/${resort.slug}.jpg`;
}

export default function Resorts() {
  const { user } = useAuth();
  const [selectedResort, setSelectedResort] = useState(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  async function handleDreamOfThis(resort) {
    if (!user || adding) return;
    setAdding(true);
    try {
      // Send the local hero path as the cover so the new dream pin keeps
      // the same hand-picked image instead of triggering an Unsplash
      // lookup at create time.
      const heroUrl = window.location.origin + heroFor(resort);
      await api.post('/pins', {
        pinType: 'dream',
        placeName: `${resort.name}, ${resort.location}, ${resort.country}`,
        dreamNote: `Dream resort: ${resort.name}`,
        unsplashImageUrl: heroUrl,
        unsplashAttribution: resort.credit,
      });
      setToast(`✓ ${resort.name} added to your dreams`);
      setTimeout(() => setToast(''), 2500);
      setSelectedResort(null);
    } catch {
      setToast('Could not add — try again');
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
        {RESORTS.map((resort, idx) => (
          <div
            key={resort.slug}
            className="resorts-card"
            onClick={() => setSelectedResort(idx)}
          >
            <div
              className="resorts-card-hero"
              style={{ backgroundImage: `url(${heroFor(resort)})` }}
            >
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
                  onClick={(e) => { e.stopPropagation(); handleDreamOfThis(resort); }}
                  disabled={adding}
                >
                  {'✦'} Dream of this
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {selectedResort !== null && (
        <>
          <div className="gallery-lightbox-backdrop" onClick={() => setSelectedResort(null)} />
          <div className="gallery-lightbox">
            <button className="gallery-lightbox-close" onClick={() => setSelectedResort(null)}>
              &times;
            </button>
            <img
              src={heroFor(RESORTS[selectedResort])}
              alt={RESORTS[selectedResort].name}
            />
            <div className="gallery-lightbox-info">
              <div className="gallery-lightbox-location">
                <h3>{RESORTS[selectedResort].name}</h3>
                <p>{RESORTS[selectedResort].location} &middot; {RESORTS[selectedResort].country} &middot; {RESORTS[selectedResort].region}</p>
                <p className="gallery-lightbox-credit">{RESORTS[selectedResort].credit}</p>
              </div>
              {user && (
                <button
                  className="gallery-lightbox-dream-btn"
                  onClick={() => handleDreamOfThis(RESORTS[selectedResort])}
                  disabled={adding}
                >
                  {adding ? 'Adding…' : `✦ Dream of ${RESORTS[selectedResort].name}`}
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
