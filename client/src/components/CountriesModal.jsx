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

export default function CountriesModal({ countries, onClose, onCountryAdded }) {
  const [view, setView] = useState('map');
  const [addInput, setAddInput] = useState('');
  const [adding, setAdding] = useState(false);
  // Story 4 — selected country in map view: { name, x, y } where x/y are
  // viewport pixel coordinates of the click point used to position the tooltip.
  const [selectedCountry, setSelectedCountry] = useState(null);
  const mapWrapRef = useRef(null);

  async function handleQuickAdd(countryName) {
    if (adding) return;
    setAdding(true);
    setAddInput('');
    try {
      await api.post('/pins', {
        pinType: 'memory',
        placeName: countryName,
        note: `Visited ${countryName}`,
        photoSourcePref: 'unsplash',
      });
      // Story 3 — tells parent to refetch so list + map both update.
      if (onCountryAdded) onCountryAdded(countryName);
    } catch { /* silent */ }
    finally { setAdding(false); }
  }

  const visitedSet = useMemo(() =>
    new Set(countries.map(c => c.country.toLowerCase().trim())),
    [countries]
  );

  const grouped = useMemo(() => {
    const groups = {};
    for (const { country, flag } of countries) {
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
  }, [countries]);

  // Autocomplete suggestions: visible while user types, hides visited countries.
  const suggestions = useMemo(() => {
    const q = addInput.trim().toLowerCase();
    if (!q) return [];
    return ALL_COUNTRIES
      .filter(c => c.toLowerCase().includes(q) && !visitedSet.has(c.toLowerCase()))
      .slice(0, 6);
  }, [addInput, visitedSet]);

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

        {/* Story 2 — country search w/ autocomplete shown in BOTH views */}
        {onCountryAdded && (
          <div className="countries-modal-add countries-modal-add-top">
            <input
              className="countries-modal-add-input"
              placeholder="Search and add a country you've visited…"
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && suggestions[0]) {
                  handleQuickAdd(suggestions[0]);
                } else if (e.key === 'Escape') {
                  setAddInput('');
                }
              }}
              disabled={adding}
            />
            {suggestions.length > 0 && (
              <div className="countries-modal-add-dropdown">
                {suggestions.map(c => (
                  <div
                    key={c}
                    className="countries-modal-add-option"
                    onClick={() => handleQuickAdd(c)}
                  >
                    {c}
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
                      const name = geo.properties.name;
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
