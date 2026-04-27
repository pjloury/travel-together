// Resorts — curated grid of world-class luxury resort destinations.
// Hero photos are now served as static, hand-picked, license-cleared
// JPEGs from /public/resorts/<slug>.jpg (resized to 1600px, ~450KB
// each). The previous lazy Unsplash fetch was replaced because generic
// stock queries returned anonymous beach photos that didn't actually
// show the resort being marketed.

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

// Each entry: name, location, country, region, slug, hasHero (true if
// /public/resorts/<slug>.jpg has been hand-curated and committed), and
// credit (attribution for the photo). Entries with hasHero=false render
// with a deterministic warm gradient placeholder until a hero arrives.
//
// The list draws on the consensus of luxury-travel "world's best" lists
// (Travel + Leisure World's Best, Conde Nast Gold List, La Liste, the
// World's 50 Best Hotels, and Aman / Six Senses / Belmond / Rosewood /
// Mandarin Oriental / Cheval Blanc / Four Seasons / Raffles flagships)
// rather than any single source.
const RESORTS = [
  // ── Maldives + Indian Ocean ────────────────────────────────────────
  {
    name: 'Soneva Fushi', location: 'Baa Atoll', country: 'Maldives',
    region: 'Asia', slug: 'soneva-fushi', hasHero: true,
    credit: 'Photo: Markus Fritze / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Soneva Jani', location: 'Noonu Atoll', country: 'Maldives',
    region: 'Asia', slug: 'soneva-jani',
  },
  {
    name: 'One&Only Reethi Rah', location: 'North Malé Atoll',
    country: 'Maldives', region: 'Asia', slug: 'one-and-only-reethi-rah',
    hasHero: true,
    credit: 'Photo: Studio Sarah Lou / Flickr · CC BY 2.0',
  },
  {
    name: 'Cheval Blanc Randheli', location: 'Noonu Atoll',
    country: 'Maldives', region: 'Asia', slug: 'cheval-blanc-randheli',
  },
  {
    name: 'Velaa Private Island', location: 'Noonu Atoll',
    country: 'Maldives', region: 'Asia', slug: 'velaa-private-island',
  },

  // ── Asia / Pacific ────────────────────────────────────────────────
  {
    name: 'Aman Tokyo', location: 'Otemachi', country: 'Japan',
    region: 'Asia', slug: 'aman-tokyo', hasHero: true,
    credit: 'Photo: Marek Okon / Unsplash',
  },
  {
    name: 'Aman Kyoto', location: 'Kyoto', country: 'Japan',
    region: 'Asia', slug: 'aman-kyoto',
  },
  {
    name: 'Amankora', location: 'Paro · Thimphu · Punakha',
    country: 'Bhutan', region: 'Asia', slug: 'amankora', hasHero: true,
    credit: 'Photo: Olivier Lejade / Flickr · CC BY-SA 2.0',
  },
  {
    name: 'Amanpuri', location: 'Phuket', country: 'Thailand',
    region: 'Asia', slug: 'amanpuri', hasHero: true,
    credit: 'Photo: Trisorn Triboon / Wikimedia · CC BY 3.0',
  },
  {
    name: 'Amankila', location: 'East Bali', country: 'Indonesia',
    region: 'Asia', slug: 'amankila',
  },
  {
    name: 'Amanyangyun', location: 'Shanghai', country: 'China',
    region: 'Asia', slug: 'amanyangyun',
  },
  {
    name: 'Six Senses Zighy Bay', location: 'Musandam', country: 'Oman',
    region: 'Middle East', slug: 'six-senses-zighy-bay', hasHero: true,
    credit: 'Photo: Wikimedia Commons · CC BY 2.5',
  },
  {
    name: 'Six Senses Yao Noi', location: 'Phang Nga Bay',
    country: 'Thailand', region: 'Asia', slug: 'six-senses-yao-noi',
  },
  {
    name: 'Six Senses Con Dao', location: 'Con Dao', country: 'Vietnam',
    region: 'Asia', slug: 'six-senses-con-dao',
  },
  {
    name: 'Mandarin Oriental Bangkok', location: 'Bangkok',
    country: 'Thailand', region: 'Asia', slug: 'mandarin-oriental-bangkok',
    hasHero: true,
    credit: 'Photo: Wolfgang Weber / Wikimedia · CC BY 3.0',
  },
  {
    name: 'Raffles Singapore', location: 'Singapore',
    country: 'Singapore', region: 'Asia', slug: 'raffles-singapore',
    hasHero: true,
    credit: 'Photo: Diego Delso / Wikimedia · CC BY-SA 4.0',
  },
  {
    name: 'Capella Ubud', location: 'Ubud · Bali',
    country: 'Indonesia', region: 'Asia', slug: 'capella-ubud',
  },
  {
    name: 'Nihi Sumba', location: 'Sumba Island', country: 'Indonesia',
    region: 'Asia', slug: 'nihi-sumba', hasHero: true,
    credit: 'Photo: Wikimedia Commons · CC BY-SA 4.0',
  },
  {
    name: 'Cape Weligama', location: 'Weligama', country: 'Sri Lanka',
    region: 'Asia', slug: 'cape-weligama',
  },
  {
    name: 'Rosewood Hong Kong', location: 'Tsim Sha Tsui',
    country: 'Hong Kong', region: 'Asia', slug: 'rosewood-hong-kong',
    hasHero: true,
    credit: 'Photo: Wpcpey / Wikimedia · CC BY-SA 4.0',
  },

  // ── Pacific / Polynesia ────────────────────────────────────────────
  {
    name: 'Four Seasons Bora Bora', location: 'Bora Bora',
    country: 'French Polynesia', region: 'Oceania',
    slug: 'four-seasons-bora-bora', hasHero: true,
    credit: 'Photo: Barbara Kraft via DL2A · CC BY-SA 3.0',
  },
  {
    name: 'The Brando', location: 'Tetiaroa',
    country: 'French Polynesia', region: 'Oceania', slug: 'the-brando',
    hasHero: true,
    credit: 'Photo: Supertoff / Wikimedia · CC BY-SA 3.0',
  },
  {
    name: 'Four Seasons Hualalai', location: 'Kona Coast · Hawai‘i',
    country: 'United States', region: 'Oceania',
    slug: 'four-seasons-hualalai', hasHero: true,
    credit: 'Photo: Steve Jurvetson / Wikimedia · CC BY 2.0',
  },

  // ── Africa ────────────────────────────────────────────────────────
  {
    name: 'Singita Grumeti', location: 'Serengeti', country: 'Tanzania',
    region: 'Africa', slug: 'singita-grumeti', hasHero: true,
    credit: 'Photo: Mark Williams / Singita PR · CC BY-ND 2.0',
  },
  {
    name: 'Four Seasons Safari Lodge', location: 'Serengeti',
    country: 'Tanzania', region: 'Africa', slug: 'four-seasons-serengeti',
  },
  {
    name: 'Wilderness Mombo Camp', location: 'Okavango Delta',
    country: 'Botswana', region: 'Africa', slug: 'mombo-camp',
    hasHero: true,
    credit: 'Photo: Steve Jurvetson / Flickr · CC BY 2.0',
  },
  {
    name: 'Royal Malewane', location: 'Greater Kruger',
    country: 'South Africa', region: 'Africa', slug: 'royal-malewane',
  },
  {
    name: 'Tswalu Kalahari', location: 'Kalahari', country: 'South Africa',
    region: 'Africa', slug: 'tswalu-kalahari',
  },
  {
    name: 'Bisate Lodge', location: 'Volcanoes NP', country: 'Rwanda',
    region: 'Africa', slug: 'bisate-lodge',
  },
  {
    name: 'Royal Mansour', location: 'Marrakech', country: 'Morocco',
    region: 'Africa', slug: 'royal-mansour', hasHero: true,
    credit: 'Photo: Patrick Schierer / Flickr · CC BY-ND 2.0',
  },

  // ── Europe ────────────────────────────────────────────────────────
  {
    name: 'Aman Venice', location: 'Venice', country: 'Italy',
    region: 'Europe', slug: 'aman-venice', hasHero: true,
    credit: 'Photo: MariaSmith89 / Wikimedia · CC BY 4.0',
  },
  {
    name: 'Belmond Hotel Cipriani', location: 'Venice', country: 'Italy',
    region: 'Europe', slug: 'belmond-cipriani', hasHero: true,
    credit: 'Photo: Joe Shlabotnik / Flickr · CC BY-NC-SA 2.0',
  },
  {
    name: 'Belmond Hotel Caruso', location: 'Ravello · Amalfi Coast',
    country: 'Italy', region: 'Europe', slug: 'belmond-caruso', hasHero: true,
    credit: 'Photo: Curt Smith / Flickr · CC BY 2.0',
  },
  {
    name: 'Le Sirenuse', location: 'Positano · Amalfi Coast',
    country: 'Italy', region: 'Europe', slug: 'le-sirenuse', hasHero: true,
    credit: 'Photo: Gregg Kellogg / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Passalacqua', location: 'Lake Como', country: 'Italy',
    region: 'Europe', slug: 'passalacqua', hasHero: true,
    credit: 'Photo: Phyrexian / Wikimedia · CC BY-SA 4.0',
  },
  {
    name: 'Rosewood Castiglion del Bosco', location: 'Tuscany',
    country: 'Italy', region: 'Europe', slug: 'castiglion-del-bosco',
  },
  {
    name: 'Borgo Egnazia', location: 'Puglia', country: 'Italy',
    region: 'Europe', slug: 'borgo-egnazia', hasHero: true,
    credit: 'Photo: Harald Philipp / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Hotel du Cap-Eden-Roc', location: 'Antibes',
    country: 'France', region: 'Europe', slug: 'hotel-du-cap-eden-roc',
    hasHero: true,
    credit: 'Photo: John Jason Junior / Wikimedia · CC BY-SA 3.0',
  },
  {
    name: 'Cheval Blanc Courchevel', location: 'Courchevel',
    country: 'France', region: 'Europe', slug: 'cheval-blanc-courchevel',
  },
  {
    name: 'Amanzoe', location: 'Peloponnese', country: 'Greece',
    region: 'Europe', slug: 'amanzoe',
  },
  {
    name: 'Bürgenstock', location: 'Lake Lucerne',
    country: 'Switzerland', region: 'Europe', slug: 'burgenstock',
    hasHero: true,
    credit: 'Photo: Asurnipal / Wikimedia · CC BY-SA 4.0',
  },

  // ── North America / Caribbean ─────────────────────────────────────
  {
    name: 'Amangiri', location: 'Canyon Point', country: 'United States',
    region: 'North America', slug: 'amangiri', hasHero: true,
    credit: 'Photo: Steve Jurvetson — Pool at Sunset / Wikimedia · CC BY 2.0',
  },
  {
    name: 'Post Ranch Inn', location: 'Big Sur · California',
    country: 'United States', region: 'North America', slug: 'post-ranch-inn',
    hasHero: true,
    credit: 'Photo: Jay Cross / Flickr · CC BY 2.0',
  },
  {
    name: 'Twin Farms', location: 'Vermont', country: 'United States',
    region: 'North America', slug: 'twin-farms', hasHero: true,
    credit: 'Photo: Adrian Scottow / Wikimedia · CC BY-SA 2.0',
  },
  {
    name: 'Clayoquot Wilderness', location: 'Tofino', country: 'Canada',
    region: 'North America', slug: 'clayoquot-wilderness', hasHero: true,
    credit: 'Photo: Billyshiverstick / Wikimedia · CC BY-SA 4.0',
  },
  {
    name: 'Rosewood Mayakoba', location: 'Riviera Maya',
    country: 'Mexico', region: 'North America', slug: 'rosewood-mayakoba',
  },
  {
    name: 'Belmond Cap Juluca', location: 'Maundays Bay',
    country: 'Anguilla', region: 'North America', slug: 'belmond-cap-juluca',
  },
  {
    name: 'Eden Rock', location: 'St. Jean · St. Barths',
    country: 'Saint Barthélemy', region: 'North America', slug: 'eden-rock',
  },

  // ── Latin America ────────────────────────────────────────────────
  {
    name: 'Jade Mountain', location: 'Soufrière', country: 'Saint Lucia',
    region: 'Latin America', slug: 'jade-mountain', hasHero: true,
    credit: 'Photo: Prayitno / Wikimedia · CC BY 2.0',
  },
  {
    name: 'Belmond das Cataratas', location: 'Iguaçu Falls',
    country: 'Brazil', region: 'Latin America', slug: 'belmond-cataratas',
    hasHero: true,
    credit: 'Photo: dany13 / Wikimedia · CC BY 2.0',
  },
  {
    name: 'Explora Patagonia', location: 'Torres del Paine',
    country: 'Chile', region: 'Latin America',
    slug: 'explora-patagonia', hasHero: true,
    credit: 'Photo: Travel South America / Flickr · CC BY-NC-ND 2.0',
  },
  {
    name: 'Awasi Atacama', location: 'San Pedro de Atacama',
    country: 'Chile', region: 'Latin America', slug: 'awasi-atacama',
  },
  {
    name: 'Pikaia Lodge', location: 'Galápagos', country: 'Ecuador',
    region: 'Latin America', slug: 'pikaia-lodge',
  },
];

// Deterministic warm gradient for resorts that don't yet have a hero
// photo. Hash on slug so the placeholder is stable across renders.
const PLACEHOLDER_GRADIENTS = [
  ['#6B4A18', '#B8860B'], ['#5A3D11', '#A37424'], ['#4A2D08', '#8B5A2B'],
  ['#704020', '#C8945C'], ['#3F2A11', '#A38556'], ['#5B3A1C', '#D2A464'],
];
function placeholderGradient(slug) {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  const pair = PLACEHOLDER_GRADIENTS[Math.abs(h) % PLACEHOLDER_GRADIENTS.length];
  return `linear-gradient(145deg, ${pair[0]}, ${pair[1]})`;
}

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
      // lookup at create time. Resorts without a curated hero get the
      // pin without a cover; the AI lookup on the server can fill it.
      const heroUrl = resort.hasHero
        ? window.location.origin + heroFor(resort)
        : null;
      await api.post('/pins', {
        pinType: 'dream',
        placeName: `${resort.name}, ${resort.location}, ${resort.country}`,
        dreamNote: `Dream resort: ${resort.name}`,
        unsplashImageUrl: heroUrl,
        unsplashAttribution: heroUrl ? resort.credit : null,
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
              style={
                resort.hasHero
                  ? { backgroundImage: `url(${heroFor(resort)})` }
                  : { backgroundImage: placeholderGradient(resort.slug) }
              }
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
            {RESORTS[selectedResort].hasHero ? (
              <img
                src={heroFor(RESORTS[selectedResort])}
                alt={RESORTS[selectedResort].name}
              />
            ) : (
              <div
                className="resorts-card-hero"
                style={{
                  backgroundImage: placeholderGradient(RESORTS[selectedResort].slug),
                  height: '50vh',
                }}
              />
            )}
            <div className="gallery-lightbox-info">
              <div className="gallery-lightbox-location">
                <h3>{RESORTS[selectedResort].name}</h3>
                <p>{RESORTS[selectedResort].location} &middot; {RESORTS[selectedResort].country} &middot; {RESORTS[selectedResort].region}</p>
                {RESORTS[selectedResort].credit && (
                  <p className="gallery-lightbox-credit">{RESORTS[selectedResort].credit}</p>
                )}
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
