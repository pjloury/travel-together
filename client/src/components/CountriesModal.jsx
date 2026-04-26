// CountriesModal — world map + continent-grouped list of visited countries
// Opens when user clicks anywhere on the country bar on the board.
//
// Story 1: triggered by tapping the whole country bar (handled in BoardView).
// Story 2: country search w/ autocomplete is visible in BOTH map + list view.
// Story 3: picking an autocomplete result optimistically adds to visited and
//          re-fetches via onCountryAdded — both views update.
// Story 4: in map view, tapping a visited country highlights it (different
//          fill + selection ring) and pops a tooltip with the country name.
// Story 5: tapping outside the tooltip dismisses it; tapping another country
//          replaces the selection.

import { useState, useMemo, useRef, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import api from '../api/client';
import { countryFlag } from '../utils/countryFlag';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Map country names to continents
const CONTINENT_MAP = {
  // Africa
  'Algeria': 'Africa', 'Angola': 'Africa', 'Benin': 'Africa', 'Botswana': 'Africa',
  'Burkina Faso': 'Africa', 'Burundi': 'Africa', 'Cameroon': 'Africa', 'Cape Verde': 'Africa',
  'Central African Republic': 'Africa', 'Chad': 'Africa', 'Comoros': 'Africa',
  'Congo': 'Africa', 'Democratic Republic of the Congo': 'Africa', 'Djibouti': 'Africa',
  'Egypt': 'Africa', 'Equatorial Guinea': 'Africa', 'Eritrea': 'Africa', 'Eswatini': 'Africa',
  'Ethiopia': 'Africa', 'Gabon': 'Africa', 'Gambia': 'Africa', 'Ghana': 'Africa',
  'Guinea': 'Africa', 'Guinea-Bissau': 'Africa', 'Ivory Coast': 'Africa', 'Kenya': 'Africa',
  'Lesotho': 'Africa', 'Liberia': 'Africa', 'Libya': 'Africa', 'Madagascar': 'Africa',
  'Malawi': 'Africa', 'Mali': 'Africa', 'Mauritania': 'Africa', 'Mauritius': 'Africa',
  'Morocco': 'Africa', 'Mozambique': 'Africa', 'Namibia': 'Africa', 'Niger': 'Africa',
  'Nigeria': 'Africa', 'Rwanda': 'Africa', 'Senegal': 'Africa', 'Sierra Leone': 'Africa',
  'Somalia': 'Africa', 'South Africa': 'Africa', 'South Sudan': 'Africa', 'Sudan': 'Africa',
  'Tanzania': 'Africa', 'Togo': 'Africa', 'Tunisia': 'Africa', 'Uganda': 'Africa',
  'Zambia': 'Africa', 'Zimbabwe': 'Africa',
  // Asia
  'Afghanistan': 'Asia', 'Armenia': 'Asia', 'Azerbaijan': 'Asia', 'Bahrain': 'Asia',
  'Bangladesh': 'Asia', 'Bhutan': 'Asia', 'Brunei': 'Asia', 'Cambodia': 'Asia',
  'China': 'Asia', 'Georgia': 'Asia', 'India': 'Asia', 'Indonesia': 'Asia',
  'Iran': 'Asia', 'Iraq': 'Asia', 'Israel': 'Asia', 'Japan': 'Asia', 'Jordan': 'Asia',
  'Kazakhstan': 'Asia', 'Kuwait': 'Asia', 'Kyrgyzstan': 'Asia', 'Laos': 'Asia',
  'Lebanon': 'Asia', 'Malaysia': 'Asia', 'Maldives': 'Asia', 'Mongolia': 'Asia',
  'Myanmar': 'Asia', 'Nepal': 'Asia', 'North Korea': 'Asia', 'Oman': 'Asia',
  'Pakistan': 'Asia', 'Palestine': 'Asia', 'Philippines': 'Asia', 'Qatar': 'Asia',
  'Saudi Arabia': 'Asia', 'Singapore': 'Asia', 'South Korea': 'Asia', 'Sri Lanka': 'Asia',
  'Syria': 'Asia', 'Taiwan': 'Asia', 'Tajikistan': 'Asia', 'Thailand': 'Asia',
  'Timor-Leste': 'Asia', 'Turkey': 'Asia', 'Turkmenistan': 'Asia',
  'United Arab Emirates': 'Asia', 'Uzbekistan': 'Asia', 'Vietnam': 'Asia', 'Yemen': 'Asia',
  'Hong Kong': 'Asia',
  // Europe
  'Albania': 'Europe', 'Andorra': 'Europe', 'Austria': 'Europe', 'Belarus': 'Europe',
  'Belgium': 'Europe', 'Bosnia and Herzegovina': 'Europe', 'Bulgaria': 'Europe',
  'Croatia': 'Europe', 'Cyprus': 'Europe', 'Czech Republic': 'Europe', 'Czechia': 'Europe',
  'Denmark': 'Europe', 'Estonia': 'Europe', 'Finland': 'Europe', 'France': 'Europe',
  'Germany': 'Europe', 'Greece': 'Europe', 'Hungary': 'Europe', 'Iceland': 'Europe',
  'Ireland': 'Europe', 'Italy': 'Europe', 'Kosovo': 'Europe', 'Latvia': 'Europe',
  'Liechtenstein': 'Europe', 'Lithuania': 'Europe', 'Luxembourg': 'Europe',
  'Malta': 'Europe', 'Moldova': 'Europe', 'Monaco': 'Europe', 'Montenegro': 'Europe',
  'Netherlands': 'Europe', 'North Macedonia': 'Europe', 'Norway': 'Europe',
  'Poland': 'Europe', 'Portugal': 'Europe', 'Romania': 'Europe', 'Russia': 'Europe',
  'San Marino': 'Europe', 'Serbia': 'Europe', 'Slovakia': 'Europe', 'Slovenia': 'Europe',
  'Spain': 'Europe', 'Sweden': 'Europe', 'Switzerland': 'Europe', 'Ukraine': 'Europe',
  'United Kingdom': 'Europe', 'Vatican City': 'Europe',
  // North America
  'Antigua and Barbuda': 'North America', 'Bahamas': 'North America', 'Barbados': 'North America',
  'Belize': 'North America', 'Canada': 'North America', 'Costa Rica': 'North America',
  'Cuba': 'North America', 'Dominica': 'North America', 'Dominican Republic': 'North America',
  'El Salvador': 'North America', 'Grenada': 'North America', 'Guatemala': 'North America',
  'Haiti': 'North America', 'Honduras': 'North America', 'Jamaica': 'North America',
  'Mexico': 'North America', 'Nicaragua': 'North America', 'Panama': 'North America',
  'Saint Lucia': 'North America', 'Trinidad and Tobago': 'North America',
  'United States': 'North America',
  // South America
  'Argentina': 'South America', 'Bolivia': 'South America', 'Brazil': 'South America',
  'Chile': 'South America', 'Colombia': 'South America', 'Ecuador': 'South America',
  'Guyana': 'South America', 'Paraguay': 'South America', 'Peru': 'South America',
  'Suriname': 'South America', 'Uruguay': 'South America', 'Venezuela': 'South America',
  // Oceania
  'Australia': 'Oceania', 'Fiji': 'Oceania', 'New Zealand': 'Oceania',
  'Papua New Guinea': 'Oceania', 'Samoa': 'Oceania', 'Tonga': 'Oceania', 'Vanuatu': 'Oceania',
};

const CONTINENT_ORDER = ['Europe', 'Asia', 'Africa', 'North America', 'South America', 'Oceania'];
const CONTINENT_EMOJI = {
  'Europe': '🏰', 'Asia': '🏯', 'Africa': '🌍', 'North America': '🗽',
  'South America': '🌎', 'Oceania': '🏝️',
};
const ALL_COUNTRIES = Object.keys(CONTINENT_MAP);

// Common-variant aliases → canonical name in CONTINENT_MAP. Typing any of
// these in the search box should resolve to the canonical country.
const COUNTRY_ALIASES = {
  'usa': 'United States',
  'u.s.a.': 'United States',
  'u.s.': 'United States',
  'us': 'United States',
  'united states of america': 'United States',
  'america': 'United States',
  'uk': 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  'britain': 'United Kingdom',
  'england': 'United Kingdom',
  'scotland': 'United Kingdom',
  'wales': 'United Kingdom',
  'czechia': 'Czech Republic',
  'türkiye': 'Turkey',
  'turkiye': 'Turkey',
  'south korea': 'South Korea',
  'korea': 'South Korea',
  'north korea': 'North Korea',
  'congo-kinshasa': 'Democratic Republic of the Congo',
  'drc': 'Democratic Republic of the Congo',
  'dr congo': 'Democratic Republic of the Congo',
  'côte d’ivoire': 'Ivory Coast',
  "cote d'ivoire": 'Ivory Coast',
  'myanmar (burma)': 'Myanmar',
  'burma': 'Myanmar',
  'holland': 'Netherlands',
  'the netherlands': 'Netherlands',
  'uae': 'United Arab Emirates',
  'emirates': 'United Arab Emirates',
};
function aliasMatches(query) {
  // Returns the canonical CONTINENT_MAP key whose alias starts-with or
  // contains the query, if any.
  const q = query.toLowerCase();
  const hits = new Set();
  for (const [alias, canon] of Object.entries(COUNTRY_ALIASES)) {
    if (alias.includes(q)) hits.add(canon);
  }
  return hits;
}

// Map from the world-atlas v2 geography names to our canonical
// CONTINENT_MAP keys. Without this, countries whose official UN name
// differs from the colloquial name (e.g. United States of America vs
// United States, Russian Federation vs Russia, Lao PDR vs Laos) wouldn't
// get filled on the map even though they appear in the user's list.
const GEO_NAME_TO_CANONICAL = {
  'United States of America': 'United States',
  'Russian Federation': 'Russia',
  'Russia': 'Russia',
  'Lao PDR': 'Laos',
  "Lao People's Democratic Republic": 'Laos',
  'Viet Nam': 'Vietnam',
  'Republic of Korea': 'South Korea',
  "Democratic People's Republic of Korea": 'North Korea',
  'United Republic of Tanzania': 'Tanzania',
  'Iran (Islamic Republic of)': 'Iran',
  'Syrian Arab Republic': 'Syria',
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Venezuela (Bolivarian Republic of)': 'Venezuela',
  'Czech Republic': 'Czech Republic',
  'Czechia': 'Czech Republic',
  'Slovak Republic': 'Slovakia',
  "Côte d'Ivoire": 'Ivory Coast',
  'Republic of the Congo': 'Congo',
  'Congo': 'Congo',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  'Democratic Republic of the Congo': 'Democratic Republic of the Congo',
  'Republic of Moldova': 'Moldova',
  'Republic of North Macedonia': 'North Macedonia',
  'The former Yugoslav Republic of Macedonia': 'North Macedonia',
  'Brunei Darussalam': 'Brunei',
  'Cabo Verde': 'Cape Verde',
  'Eswatini': 'Eswatini',
  'Swaziland': 'Eswatini',
  'Myanmar': 'Myanmar',
  'Burma': 'Myanmar',
  'Timor-Leste': 'Timor-Leste',
  'East Timor': 'Timor-Leste',
  'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
  'United Arab Emirates': 'United Arab Emirates',
  'Türkiye': 'Turkey',
  'Turkey': 'Turkey',
  'Palestine, State of': 'Palestine',
  'State of Palestine': 'Palestine',
  'Vatican': 'Vatican City',
  'Holy See': 'Vatican City',
};
function geoNameToCanonical(name) {
  return GEO_NAME_TO_CANONICAL[name] || name;
}

export default function CountriesModal({ countries, onClose, onCountryAdded, onCountryRemoved }) {
  const [view, setView] = useState('map');
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  // Story 4 — selected country in map view: { name, x, y } where x/y are
  // viewport pixel coordinates of the click point used to position the tooltip.
  const [selectedCountry, setSelectedCountry] = useState(null);
  // Locally-added countries during this modal session. Lets the map + list
  // re-render instantly with no flicker — we still call onCountryAdded so
  // the parent eventually refetches in the background, but the modal does
  // NOT depend on that round-trip to repaint.
  const [localAdds, setLocalAdds] = useState([]); // [{ country, flag }]
  // Locally-removed countries (canonical names, lowercased) — symmetric
  // optimistic counterpart for the unselect-to-remove flow.
  const [localRemoves, setLocalRemoves] = useState(() => new Set());
  // Highlighted suggestion index for arrow-key navigation.
  const [highlightIdx, setHighlightIdx] = useState(0);
  // Opt-in: when checked, quick-add ALSO creates a memory pin for each
  // country (the pre-existing behavior). When unchecked (default), the
  // country is recorded as a lightweight "country-only" marker — it
  // shows on the map / list but doesn't clutter the memory grid.
  // Persisted in localStorage so a user who likes the auto-memory
  // workflow doesn't have to re-check it every visit.
  const [autoCreateMemory, setAutoCreateMemory] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('tt_country_auto_memory') === '1';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'tt_country_auto_memory',
        autoCreateMemory ? '1' : '0'
      );
    }
  }, [autoCreateMemory]);
  const mapWrapRef = useRef(null);

  // Composite list = parent-provided pins + locally-added countries
  // (de-duped) − locally-removed countries.
  const effectiveCountries = useMemo(() => {
    const seen = new Set(countries.map(c => c.country.toLowerCase().trim()));
    const merged = [...countries];
    for (const add of localAdds) {
      if (!seen.has(add.country.toLowerCase().trim())) {
        merged.push(add);
        seen.add(add.country.toLowerCase().trim());
      }
    }
    return merged.filter(c => !localRemoves.has(c.country.toLowerCase().trim()));
  }, [countries, localAdds, localRemoves]);

  async function handleQuickAdd(countryName) {
    if (adding) return;
    // If this country is currently in localRemoves, just unset that — the
    // user is restoring something they removed in this session.
    const lc = countryName.toLowerCase().trim();
    if (localRemoves.has(lc)) {
      setLocalRemoves(prev => {
        const next = new Set(prev); next.delete(lc); return next;
      });
      setAddInput('');
      setHighlightIdx(0);
      return;
    }
    // Optimistic local update — visible immediately on the map and list
    // with zero flicker. Reset the input + suggestions in the same tick.
    const flag = countryFlag(countryName) || '🌐';
    setLocalAdds(prev =>
      prev.some(a => a.country.toLowerCase() === countryName.toLowerCase())
        ? prev
        : [...prev, { country: countryName, flag }]
    );
    setAddInput('');
    setHighlightIdx(0);

    setAdding(true);
    try {
      await api.post('/pins', {
        pinType: 'memory',
        placeName: countryName,
        // When the user opts into auto-creating memories we attach the
        // canned note + Unsplash cover, otherwise we leave it as a bare
        // country-only marker that doesn't show in the memory grid.
        note: autoCreateMemory ? `Visited ${countryName}` : null,
        photoSourcePref: autoCreateMemory ? 'unsplash' : null,
        countryOnly: !autoCreateMemory,
      });
      // Tell the parent so its cache refreshes for next time the modal opens —
      // but we do NOT wait on it for the visible update.
      if (onCountryAdded) onCountryAdded(countryName);
    } catch {
      // Rollback the optimistic add on error so the UI matches reality.
      setLocalAdds(prev => prev.filter(a => a.country.toLowerCase() !== countryName.toLowerCase()));
    } finally {
      setAdding(false);
    }
  }

  async function handleQuickRemove(countryName) {
    if (adding) return;
    if (!onCountryRemoved) return;
    const lc = countryName.toLowerCase().trim();
    // Optimistic remove — instant UI update on map + list.
    setLocalRemoves(prev => {
      const next = new Set(prev); next.add(lc); return next;
    });
    // Also drop from localAdds in case the user added then immediately removed
    // it within the same session.
    setLocalAdds(prev => prev.filter(a => a.country.toLowerCase() !== lc));
    setAddInput('');
    setHighlightIdx(0);

    setAdding(true);
    try {
      const ok = await onCountryRemoved(countryName);
      if (ok === false) throw new Error('parent declined');
    } catch {
      // Rollback the optimistic remove on error.
      setLocalRemoves(prev => {
        const next = new Set(prev); next.delete(lc); return next;
      });
    } finally {
      setAdding(false);
    }
  }

  const visitedSet = useMemo(() =>
    new Set(effectiveCountries.map(c => c.country.toLowerCase().trim())),
    [effectiveCountries]
  );

  const grouped = useMemo(() => {
    const groups = {};
    for (const { country, flag } of effectiveCountries) {
      const continent = CONTINENT_MAP[country] || 'Other';
      if (!groups[continent]) groups[continent] = [];
      groups[continent].push({ country, flag });
    }
    // Sort by continent order, then alphabetically within
    return CONTINENT_ORDER
      .filter(c => groups[c])
      .map(c => ({ continent: c, countries: groups[c].sort((a, b) => a.country.localeCompare(b.country)) }))
      .concat(
        groups['Other'] ? [{ continent: 'Other', countries: groups['Other'].sort((a, b) => a.country.localeCompare(b.country)) }] : []
      );
  }, [effectiveCountries]);

  // Autocomplete suggestions: visible while user types. Now includes:
  //   - prefix matches on canonical country names
  //   - substring matches on canonical country names
  //   - alias matches (e.g. "USA" → United States, "UK" → United Kingdom)
  //   - countries the user has ALREADY visited (with a `visited: true` flag
  //     so the row can render an "✓ added — tap to remove" affordance)
  const suggestions = useMemo(() => {
    const q = addInput.trim().toLowerCase();
    if (!q) return [];
    const aliasHits = aliasMatches(q); // canonical names matched via aliases
    const prefix = [];
    const contains = [];
    const aliased = [];
    const seen = new Set();
    const push = (bucket, name) => {
      if (seen.has(name)) return;
      seen.add(name);
      bucket.push({ name, visited: visitedSet.has(name.toLowerCase()) });
    };
    for (const c of ALL_COUNTRIES) {
      const lc = c.toLowerCase();
      if (lc.startsWith(q)) push(prefix, c);
      else if (lc.includes(q)) push(contains, c);
    }
    for (const canon of aliasHits) push(aliased, canon);
    return [...prefix, ...aliased, ...contains].slice(0, 8);
  }, [addInput, visitedSet]);

  // Reset highlight when the suggestion set changes from underneath us.
  useEffect(() => {
    setHighlightIdx(i => Math.min(i, Math.max(0, suggestions.length - 1)));
  }, [suggestions]);

  // Story 5 — clicking outside the tooltip dismisses it. Listen on the map
  // wrapper; if the click target isn't a Geography path or the tooltip itself
  // we clear the selection. Geography clicks set a fresh selection (handled in
  // onClick prop below).
  useEffect(() => {
    if (!selectedCountry || view !== 'map') return;
    function onDocClick(e) {
      // If click is inside the tooltip or on a visited <path>, leave it alone
      // (visited path's own onClick will replace selection).
      if (e.target.closest('.countries-modal-tooltip')) return;
      if (e.target.closest('[data-visited-country="true"]')) return;
      setSelectedCountry(null);
    }
    // Use mousedown so we beat the Geography onClick? No — Geography onClick
    // fires on click, so use 'click' here too with a small delay via ref.
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [selectedCountry, view]);

  // Compute tooltip pixel position relative to the map wrapper.
  const tooltipPos = (() => {
    if (!selectedCountry || !mapWrapRef.current) return null;
    const rect = mapWrapRef.current.getBoundingClientRect();
    return { left: selectedCountry.x - rect.left, top: selectedCountry.y - rect.top };
  })();

  return (
    <>
      <div className="countries-modal-backdrop" onClick={onClose} />
      <div className="countries-modal">
        <div className="countries-modal-header">
          <h2 className="countries-modal-title">{countries.length} {countries.length === 1 ? 'Country' : 'Countries'} Visited</h2>
          <div className="countries-modal-tabs">
            <button className={`countries-modal-tab${view === 'map' ? ' active' : ''}`} onClick={() => setView('map')}>Map</button>
            <button className={`countries-modal-tab${view === 'list' ? ' active' : ''}`} onClick={() => setView('list')}>List</button>
          </div>
          <button className="countries-modal-close" onClick={onClose}>×</button>
        </div>

        {/* Story 2 — country search w/ autocomplete shown in BOTH views.
            ↑/↓ moves highlight, Enter picks the highlighted suggestion,
            Esc clears the input. */}
        {onCountryAdded && (
          <div className="countries-modal-add countries-modal-add-top">
            <input
              className="countries-modal-add-input"
              placeholder="Search and add a country you've visited…"
              value={addInput}
              onChange={e => { setAddInput(e.target.value); setHighlightIdx(0); }}
              onKeyDown={e => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightIdx(i =>
                    suggestions.length ? (i + 1) % suggestions.length : 0
                  );
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightIdx(i =>
                    suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : 0
                  );
                } else if (e.key === 'Enter') {
                  const pick = suggestions[highlightIdx] || suggestions[0];
                  if (pick) {
                    e.preventDefault();
                    if (pick.visited) handleQuickRemove(pick.name);
                    else handleQuickAdd(pick.name);
                  }
                } else if (e.key === 'Escape') {
                  setAddInput('');
                  setHighlightIdx(0);
                }
              }}
              autoComplete="off"
            />
            <label className="countries-modal-auto-memory">
              <input
                type="checkbox"
                checked={autoCreateMemory}
                onChange={e => setAutoCreateMemory(e.target.checked)}
              />
              <span>Auto-create memory for each country I add</span>
            </label>
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
                      (s.visited ? ' countries-modal-add-option-visited' : '')
                    }
                    onMouseEnter={() => setHighlightIdx(i)}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      if (s.visited) handleQuickRemove(s.name);
                      else handleQuickAdd(s.name);
                    }}
                  >
                    <span>{s.name}</span>
                    {s.visited && (
                      <span className="countries-modal-add-option-meta">
                        ✓ added — tap to remove
                      </span>
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
              projection="geoMercator"
              projectionConfig={{ scale: 120, center: [10, 20] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup minZoom={0.8} maxZoom={6}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      // Normalize the geography's name to our canonical form
                      // before testing visited-set membership. This is what
                      // makes "United States of America" match a pin saved
                      // as "United States", etc.
                      const rawName = geo.properties.name;
                      const name = geoNameToCanonical(rawName);
                      const visited = visitedSet.has(name.toLowerCase().trim());
                      const isSelected = visited && selectedCountry?.name === name;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          data-visited-country={visited ? 'true' : 'false'}
                          onClick={visited ? (event) => {
                            // Use the native event's clientX/Y to anchor the tooltip
                            const ev = event.nativeEvent || event;
                            setSelectedCountry({ name, x: ev.clientX, y: ev.clientY });
                          } : undefined}
                          fill={
                            visited
                              ? (isSelected ? '#E0C868' : '#C9A84C')
                              : 'rgba(250,250,250,0.08)'
                          }
                          stroke={isSelected ? '#FFFFFF' : 'rgba(250,250,250,0.12)'}
                          strokeWidth={isSelected ? 1.2 : 0.4}
                          style={{
                            default: { outline: 'none', cursor: visited ? 'pointer' : 'default' },
                            hover: {
                              outline: 'none',
                              fill: visited ? '#D4B85C' : 'rgba(250,250,250,0.14)',
                              cursor: visited ? 'pointer' : 'default',
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

            {/* Story 4/5 — selection tooltip */}
            {selectedCountry && tooltipPos && (
              <div
                className="countries-modal-tooltip"
                style={{ left: tooltipPos.left, top: tooltipPos.top }}
                role="tooltip"
              >
                {selectedCountry.name}
              </div>
            )}
          </div>
        )}

        {view === 'list' && (
          <div className="countries-modal-list">
            {grouped.map(({ continent, countries: cList }) => (
              <div key={continent} className="countries-modal-group">
                <h3 className="countries-modal-continent">
                  {CONTINENT_EMOJI[continent] || '🌐'} {continent}
                  <span className="countries-modal-continent-count">{cList.length}</span>
                </h3>
                <div className="countries-modal-country-grid">
                  {cList.map(({ country, flag }) => (
                    <div key={country} className="countries-modal-country">
                      <span className="countries-modal-flag">{flag}</span>
                      <span className="countries-modal-name">{country}</span>
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
