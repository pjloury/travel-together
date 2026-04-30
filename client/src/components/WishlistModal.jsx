// WishlistModal — analogous to CountriesModal, but for the user's
// wishlist of countries they hope to visit.
//
// Behavior parallels CountriesModal:
//   - Map view: click any country to open a tooltip with flag + name +
//     CTA. Wishlisted countries pop in a vibrant teal; visited countries
//     are recessed (dull tan); unvisited / not-on-list use cream.
//   - Tooltip CTA states:
//       on wishlist        → Remove from wishlist
//       not visited        → + Add to wishlist
//       already visited    → "✓ Already visited" (no CTA — server contract:
//                             you can't wishlist a country you've been to)
//   - List view: continent-grouped, each row shows flag + name + remove ×.
//   - Search box: autocomplete, hides visited + already-on-list.

import { useState, useMemo, useRef, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import api from '../api/client';
import { countryFlag, COUNTRY_CODES } from '../utils/countryFlag';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Continent map + display order — same source-of-truth shape as
// CountriesModal. Kept inline so the two modals stay independent (no
// risk that a tweak to one's display silently changes the other).
const CONTINENT_MAP = {
  // Africa
  'Algeria':'Africa','Angola':'Africa','Benin':'Africa','Botswana':'Africa',
  'Burkina Faso':'Africa','Burundi':'Africa','Cameroon':'Africa','Cape Verde':'Africa',
  'Central African Republic':'Africa','Chad':'Africa','Comoros':'Africa',
  'Congo':'Africa','Democratic Republic of the Congo':'Africa','Djibouti':'Africa',
  'Egypt':'Africa','Equatorial Guinea':'Africa','Eritrea':'Africa','Eswatini':'Africa',
  'Ethiopia':'Africa','Gabon':'Africa','Gambia':'Africa','Ghana':'Africa',
  'Guinea':'Africa','Guinea-Bissau':'Africa','Ivory Coast':'Africa','Kenya':'Africa',
  'Lesotho':'Africa','Liberia':'Africa','Libya':'Africa','Madagascar':'Africa',
  'Malawi':'Africa','Mali':'Africa','Mauritania':'Africa','Mauritius':'Africa',
  'Morocco':'Africa','Mozambique':'Africa','Namibia':'Africa','Niger':'Africa',
  'Nigeria':'Africa','Rwanda':'Africa','Senegal':'Africa','Sierra Leone':'Africa',
  'Somalia':'Africa','South Africa':'Africa','South Sudan':'Africa','Sudan':'Africa',
  'Tanzania':'Africa','Togo':'Africa','Tunisia':'Africa','Uganda':'Africa',
  'Zambia':'Africa','Zimbabwe':'Africa',
  // Asia
  'Afghanistan':'Asia','Armenia':'Asia','Azerbaijan':'Asia','Bahrain':'Asia',
  'Bangladesh':'Asia','Bhutan':'Asia','Brunei':'Asia','Cambodia':'Asia',
  'China':'Asia','Georgia':'Asia','India':'Asia','Indonesia':'Asia',
  'Iran':'Asia','Iraq':'Asia','Israel':'Asia','Japan':'Asia','Jordan':'Asia',
  'Kazakhstan':'Asia','Kuwait':'Asia','Kyrgyzstan':'Asia','Laos':'Asia',
  'Lebanon':'Asia','Malaysia':'Asia','Maldives':'Asia','Mongolia':'Asia',
  'Myanmar':'Asia','Nepal':'Asia','North Korea':'Asia','Oman':'Asia',
  'Pakistan':'Asia','Palestine':'Asia','Philippines':'Asia','Qatar':'Asia',
  'Saudi Arabia':'Asia','Singapore':'Asia','South Korea':'Asia','Sri Lanka':'Asia',
  'Syria':'Asia','Taiwan':'Asia','Tajikistan':'Asia','Thailand':'Asia',
  'Timor-Leste':'Asia','Turkey':'Asia','Turkmenistan':'Asia',
  'United Arab Emirates':'Asia','Uzbekistan':'Asia','Vietnam':'Asia','Yemen':'Asia',
  'Hong Kong':'Asia',
  // Europe
  'Albania':'Europe','Andorra':'Europe','Austria':'Europe','Belarus':'Europe',
  'Belgium':'Europe','Bosnia and Herzegovina':'Europe','Bulgaria':'Europe',
  'Croatia':'Europe','Cyprus':'Europe','Czech Republic':'Europe','Czechia':'Europe',
  'Denmark':'Europe','Estonia':'Europe','Finland':'Europe','France':'Europe',
  'Germany':'Europe','Greece':'Europe','Hungary':'Europe','Iceland':'Europe',
  'Ireland':'Europe','Italy':'Europe','Kosovo':'Europe','Latvia':'Europe',
  'Liechtenstein':'Europe','Lithuania':'Europe','Luxembourg':'Europe',
  'Malta':'Europe','Moldova':'Europe','Monaco':'Europe','Montenegro':'Europe',
  'Netherlands':'Europe','North Macedonia':'Europe','Norway':'Europe',
  'Poland':'Europe','Portugal':'Europe','Romania':'Europe','Russia':'Europe',
  'San Marino':'Europe','Serbia':'Europe','Slovakia':'Europe','Slovenia':'Europe',
  'Spain':'Europe','Sweden':'Europe','Switzerland':'Europe','Ukraine':'Europe',
  'United Kingdom':'Europe','Vatican City':'Europe',
  // North America
  'Antigua and Barbuda':'North America','Bahamas':'North America','Barbados':'North America',
  'Belize':'North America','Canada':'North America','Costa Rica':'North America',
  'Cuba':'North America','Dominica':'North America','Dominican Republic':'North America',
  'El Salvador':'North America','Grenada':'North America','Guatemala':'North America',
  'Haiti':'North America','Honduras':'North America','Jamaica':'North America',
  'Mexico':'North America','Nicaragua':'North America','Panama':'North America',
  'Saint Lucia':'North America','Trinidad and Tobago':'North America',
  'United States':'North America',
  // South America
  'Argentina':'South America','Bolivia':'South America','Brazil':'South America',
  'Chile':'South America','Colombia':'South America','Ecuador':'South America',
  'Guyana':'South America','Paraguay':'South America','Peru':'South America',
  'Suriname':'South America','Uruguay':'South America','Venezuela':'South America',
  // Oceania
  'Australia':'Oceania','Fiji':'Oceania','New Zealand':'Oceania',
  'Papua New Guinea':'Oceania','Samoa':'Oceania','Tonga':'Oceania','Vanuatu':'Oceania',
};
const CONTINENT_ORDER = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
const CONTINENT_EMOJI = {
  'Europe':'🏰','Asia':'🏯','Africa':'🌍','North America':'🗽','South America':'🌎','Oceania':'🏝️',
};
const ALL_COUNTRIES = Object.keys(CONTINENT_MAP);

const GEO_NAME_TO_CANONICAL = {
  'United States of America':'United States',
  'Russian Federation':'Russia','Russia':'Russia',
  'Lao PDR':'Laos',"Lao People's Democratic Republic":'Laos',
  'Viet Nam':'Vietnam',
  'Republic of Korea':'South Korea',
  "Democratic People's Republic of Korea":'North Korea',
  'United Republic of Tanzania':'Tanzania',
  'Iran (Islamic Republic of)':'Iran',
  'Syrian Arab Republic':'Syria',
  'Bolivia (Plurinational State of)':'Bolivia',
  'Venezuela (Bolivarian Republic of)':'Venezuela',
  'Czech Republic':'Czech Republic','Czechia':'Czech Republic',
  'Slovak Republic':'Slovakia',
  "Côte d'Ivoire":'Ivory Coast',
  'Republic of the Congo':'Congo','Congo':'Congo',
  'Dem. Rep. Congo':'Democratic Republic of the Congo',
  'Democratic Republic of the Congo':'Democratic Republic of the Congo',
  'Republic of Moldova':'Moldova',
  'Republic of North Macedonia':'North Macedonia',
  'The former Yugoslav Republic of Macedonia':'North Macedonia',
  'Brunei Darussalam':'Brunei',
  'Cabo Verde':'Cape Verde',
  'Eswatini':'Eswatini','Swaziland':'Eswatini',
  'Myanmar':'Myanmar','Burma':'Myanmar',
  'Timor-Leste':'Timor-Leste','East Timor':'Timor-Leste',
  'United Kingdom of Great Britain and Northern Ireland':'United Kingdom',
  'United Arab Emirates':'United Arab Emirates',
  'Türkiye':'Turkey','Turkey':'Turkey',
  'Palestine, State of':'Palestine','State of Palestine':'Palestine',
  'Vatican':'Vatican City','Holy See':'Vatican City',
};
function geoNameToCanonical(name) {
  return GEO_NAME_TO_CANONICAL[name] || name;
}

/**
 * @param {Object[]} props.wishlist  — current wishlist items, each { country, flag }
 * @param {Object[]} props.visited   — visited countries, used to recess + gate adds
 * @param {Function} props.onClose
 * @param {Function} props.onWishlistAdded   - called with countryName after server ack
 * @param {Function} props.onWishlistRemoved - called with countryName; return false to abort
 * @param {Function} props.onPromotedToVisited - called with countryName after a wishlist
 *                                                country becomes a visited country (server
 *                                                creates a country-only memory pin, server's
 *                                                auto-cleanup hook drops it from the wishlist)
 */
export default function WishlistModal({ wishlist, visited, onClose, onWishlistAdded, onWishlistRemoved, onPromotedToVisited }) {
  const [view, setView] = useState('map');
  const [addInput, setAddInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [localAdds, setLocalAdds] = useState([]);
  const [localRemoves, setLocalRemoves] = useState(() => new Set());
  const [highlightIdx, setHighlightIdx] = useState(0);
  const mapWrapRef = useRef(null);

  const visitedSet = useMemo(() =>
    new Set((visited || []).map(c => c.country.toLowerCase().trim())),
    [visited]
  );

  const effectiveWishlist = useMemo(() => {
    const seen = new Set(wishlist.map(c => c.country.toLowerCase().trim()));
    const merged = [...wishlist];
    for (const add of localAdds) {
      if (!seen.has(add.country.toLowerCase().trim())) {
        merged.push(add);
        seen.add(add.country.toLowerCase().trim());
      }
    }
    return merged.filter(c => !localRemoves.has(c.country.toLowerCase().trim()));
  }, [wishlist, localAdds, localRemoves]);

  const wishlistSet = useMemo(() =>
    new Set(effectiveWishlist.map(c => c.country.toLowerCase().trim())),
    [effectiveWishlist]
  );

  async function handleQuickAdd(countryName) {
    if (busy) return;
    // Server contract: visited countries can't go on the wishlist.
    if (visitedSet.has(countryName.toLowerCase())) return;
    const lc = countryName.toLowerCase().trim();
    if (localRemoves.has(lc)) {
      setLocalRemoves(prev => { const next = new Set(prev); next.delete(lc); return next; });
      setAddInput(''); setHighlightIdx(0);
      return;
    }
    const flag = countryFlag(countryName) || '🌐';
    setLocalAdds(prev =>
      prev.some(a => a.country.toLowerCase() === countryName.toLowerCase())
        ? prev
        : [...prev, { country: countryName, flag }]
    );
    setAddInput(''); setHighlightIdx(0);

    setBusy(true);
    try {
      const code = COUNTRY_CODES[countryName];
      if (!code) throw new Error('No country code for ' + countryName);
      await api.post('/wishlist', {
        countryCode: code,
        countryName,
      });
      if (onWishlistAdded) onWishlistAdded(countryName);
    } catch {
      setLocalAdds(prev => prev.filter(a => a.country.toLowerCase() !== countryName.toLowerCase()));
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkVisited(countryName) {
    if (busy) return;
    const lc = countryName.toLowerCase().trim();
    // Optimistically drop the country from the local wishlist surface so
    // the map fill flips from teal to recessed tan immediately. The
    // server's auto-cleanup hook on memory-pin creation will mirror the
    // delete; we bail out optimistically anyway.
    setLocalRemoves(prev => { const next = new Set(prev); next.add(lc); return next; });
    setLocalAdds(prev => prev.filter(a => a.country.toLowerCase() !== lc));

    setBusy(true);
    try {
      await api.post('/pins', {
        pinType: 'memory',
        placeName: countryName,
        countryOnly: true,
      });
      if (onPromotedToVisited) onPromotedToVisited(countryName);
    } catch {
      // Roll back the local removal on failure.
      setLocalRemoves(prev => { const next = new Set(prev); next.delete(lc); return next; });
    } finally {
      setBusy(false);
    }
  }

  async function handleQuickRemove(countryName) {
    if (busy) return;
    const lc = countryName.toLowerCase().trim();
    setLocalRemoves(prev => { const next = new Set(prev); next.add(lc); return next; });
    setLocalAdds(prev => prev.filter(a => a.country.toLowerCase() !== lc));
    setAddInput(''); setHighlightIdx(0);

    setBusy(true);
    try {
      const code = COUNTRY_CODES[countryName];
      if (!code) throw new Error('No country code for ' + countryName);
      await api.delete('/wishlist/' + code);
      if (onWishlistRemoved) onWishlistRemoved(countryName);
    } catch {
      setLocalRemoves(prev => { const next = new Set(prev); next.delete(lc); return next; });
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const groups = {};
    for (const { country, flag } of effectiveWishlist) {
      const continent = CONTINENT_MAP[country] || 'Other';
      if (!groups[continent]) groups[continent] = [];
      groups[continent].push({ country, flag });
    }
    return CONTINENT_ORDER
      .filter(c => groups[c])
      .map(c => ({ continent: c, countries: groups[c].sort((a, b) => a.country.localeCompare(b.country)) }))
      .concat(
        groups['Other'] ? [{ continent: 'Other', countries: groups['Other'].sort((a, b) => a.country.localeCompare(b.country)) }] : []
      );
  }, [effectiveWishlist]);

  // Suggestions: hide visited + already-wishlisted. Suggestion rows show
  // a "✓ visited" badge for visited countries (so the user can see why
  // they don't appear in their wishlist) — but those rows are NOT
  // clickable.
  const suggestions = useMemo(() => {
    const q = addInput.trim().toLowerCase();
    if (!q) return [];
    const prefix = [];
    const contains = [];
    const seen = new Set();
    const push = (bucket, name) => {
      if (seen.has(name)) return;
      seen.add(name);
      bucket.push({
        name,
        wishlisted: wishlistSet.has(name.toLowerCase()),
        visited: visitedSet.has(name.toLowerCase()),
      });
    };
    for (const c of ALL_COUNTRIES) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q)) push(prefix, c);
      else if (lc.includes(q)) push(contains, c);
    }
    return [...prefix, ...contains].slice(0, 8);
  }, [addInput, wishlistSet, visitedSet]);

  useEffect(() => {
    setHighlightIdx(i => Math.min(i, Math.max(0, suggestions.length - 1)));
  }, [suggestions]);

  // Close-on-outside (mirrors CountriesModal). Don't dismiss when click
  // lands on a country path or inside the tooltip itself.
  useEffect(() => {
    if (!selectedCountry || view !== 'map') return;
    function onDocClick(e) {
      if (e.target.closest('.wishlist-modal-tooltip')) return;
      if (e.target.closest('[data-wishlist-country]')) return;
      setSelectedCountry(null);
    }
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [selectedCountry, view]);

  const tooltipPos = (() => {
    if (!selectedCountry || !mapWrapRef.current) return null;
    const rect = mapWrapRef.current.getBoundingClientRect();
    return { left: selectedCountry.x - rect.left, top: selectedCountry.y - rect.top };
  })();

  return (
    <>
      <div className="countries-modal-backdrop" onClick={onClose} />
      <div className="countries-modal wishlist-modal">
        <div className="countries-modal-header">
          <h2 className="countries-modal-title">
            {wishlist.length} {wishlist.length === 1 ? 'Country' : 'Countries'} on Wishlist
          </h2>
          <div className="countries-modal-tabs">
            <button className={`countries-modal-tab${view === 'map' ? ' active' : ''}`} onClick={() => setView('map')}>Map</button>
            <button className={`countries-modal-tab${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>List</button>
          </div>
          <button className="countries-modal-close" onClick={onClose}>×</button>
        </div>

        {onWishlistAdded && (
          <div className="countries-modal-add countries-modal-add-top">
            <input
              className="countries-modal-add-input"
              placeholder="Search and add a country to your wishlist…"
              value={addInput}
              onChange={e => { setAddInput(e.target.value); setHighlightIdx(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightIdx(i => suggestions.length ? (i + 1) % suggestions.length : 0);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightIdx(i => suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : 0);
                } else if (e.key === 'Enter') {
                  const pick = suggestions[highlightIdx] || suggestions[0];
                  if (!pick || pick.visited) return;
                  e.preventDefault();
                  if (pick.wishlisted) handleQuickRemove(pick.name);
                  else handleQuickAdd(pick.name);
                } else if (e.key === 'Escape') {
                  setAddInput(''); setHighlightIdx(0);
                }
              }}
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <div className="countries-modal-add-dropdown" role="listbox">
                {suggestions.map((s, i) => (
                  <div
                    key={s.name}
                    role="option"
                    aria-selected={i === highlightIdx}
                    className={
                      'countries-modal-add-option' +
                      (i === highlightIdx ? ' countries-modal-add-option-active' : '') +
                      (s.wishlisted ? ' countries-modal-add-option-visited' : '') +
                      (s.visited ? ' countries-modal-add-option-disabled' : '')
                    }
                    onMouseEnter={() => setHighlightIdx(i)}
                    onMouseDown={(ev) => {
                      if (s.visited) return;
                      ev.preventDefault();
                      if (s.wishlisted) handleQuickRemove(s.name);
                      else handleQuickAdd(s.name);
                    }}
                  >
                    <span>{s.name}</span>
                    {s.visited && (
                      <span className="countries-modal-add-option-meta">✓ already visited</span>
                    )}
                    {!s.visited && s.wishlisted && (
                      <span className="countries-modal-add-option-meta">✓ on wishlist — tap to remove</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'map' && (
          <div className="countries-modal-map" ref={mapWrapRef}>
            <ComposableMap
              projection="geoEqualEarth"
              projectionConfig={{ scale: 175, center: [12, 18] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup minZoom={0.85} maxZoom={6}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      const rawName = geo.properties.name;
                      const name = geoNameToCanonical(rawName);
                      const lc = name.toLowerCase();
                      const onWishlist = wishlistSet.has(lc);
                      const isVisited = visitedSet.has(lc);
                      const isSelected = selectedCountry?.name === name;
                      const knownCountry = !!CONTINENT_MAP[name];
                      const clickable = knownCountry; // any known country is clickable
                      // Color treatment per spec:
                      //   wishlist  → vibrant teal (pops)
                      //   visited   → recessed soft tan (still visible, but
                      //               not the focus of this view)
                      //   other     → cream
                      let fill;
                      if (onWishlist) fill = isSelected ? '#0E4D6E' : '#1A8FBF';
                      else if (isVisited) fill = '#D4C7A8';
                      else fill = '#EDE2C9';
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          data-wishlist-country={onWishlist ? 'true' : 'false'}
                          onClick={clickable ? (event) => {
                            const ev = event.nativeEvent || event;
                            setSelectedCountry({ name, x: ev.clientX, y: ev.clientY });
                          } : undefined}
                          fill={fill}
                          stroke={isSelected ? '#072B3D' : '#D4C7A8'}
                          strokeWidth={isSelected ? 1.2 : 0.5}
                          style={{
                            default: { outline: 'none', cursor: clickable ? 'pointer' : 'default' },
                            hover: {
                              outline: 'none',
                              fill: onWishlist ? '#1773A0' : (isVisited ? '#C7B894' : '#E5D6B5'),
                              cursor: clickable ? 'pointer' : 'default',
                            },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>

            {selectedCountry && tooltipPos && (() => {
              const lc = selectedCountry.name.toLowerCase().trim();
              const onWishlist = wishlistSet.has(lc);
              const isVisited = visitedSet.has(lc);
              const flag = countryFlag(selectedCountry.name) || '🌐';
              return (
                <div
                  className="wishlist-modal-tooltip"
                  style={{ left: tooltipPos.left, top: tooltipPos.top }}
                  role="tooltip"
                >
                  <div className="wishlist-modal-tooltip-row">
                    <span className="wishlist-modal-tooltip-flag">{flag}</span>
                    <span className="wishlist-modal-tooltip-name">{selectedCountry.name}</span>
                  </div>
                  {isVisited ? (
                    <span className="wishlist-modal-tooltip-meta">✓ Already visited</span>
                  ) : onWishlist ? (
                    <div className="wishlist-modal-tooltip-actions">
                      {onPromotedToVisited && (
                        <button
                          className="wishlist-modal-tooltip-btn wishlist-modal-tooltip-btn-promote"
                          disabled={busy}
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleMarkVisited(selectedCountry.name);
                            setSelectedCountry(null);
                          }}
                        >
                          ✓ I've been here
                        </button>
                      )}
                      <button
                        className="wishlist-modal-tooltip-btn wishlist-modal-tooltip-btn-remove"
                        disabled={busy}
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleQuickRemove(selectedCountry.name);
                          setSelectedCountry(null);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      className="wishlist-modal-tooltip-btn wishlist-modal-tooltip-btn-add"
                      disabled={busy}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleQuickAdd(selectedCountry.name);
                        setSelectedCountry(null);
                      }}
                    >
                      + Add to wishlist
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {view === 'list' && (
          <div className="countries-modal-list">
            {grouped.length === 0 ? (
              <div className="wishlist-modal-empty">
                Your wishlist is empty. Tap a country on the map to add it.
              </div>
            ) : grouped.map(({ continent, countries: cList }) => (
              <div key={continent} className="countries-modal-group">
                <h3 className="countries-modal-continent">
                  {CONTINENT_EMOJI[continent] || '🌐'} {continent}
                  <span className="countries-modal-continent-count">{cList.length}</span>
                </h3>
                <div className="countries-modal-country-grid">
                  {cList.map(({ country, flag }) => (
                    <div key={country} className="countries-modal-country wishlist-modal-country">
                      <span className="countries-modal-flag">{flag}</span>
                      <span className="countries-modal-name">{country}</span>
                      <button
                        className="wishlist-modal-row-remove"
                        title="Remove from wishlist"
                        onClick={() => handleQuickRemove(country)}
                        disabled={busy}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
