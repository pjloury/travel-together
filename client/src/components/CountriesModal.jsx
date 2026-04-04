// CountriesModal — world map + continent-grouped list of visited countries
// Opens when user clicks the "N countries" label on the board

import { useState, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';

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

export default function CountriesModal({ countries, onClose }) {
  const [view, setView] = useState('map'); // 'map' | 'list'

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

        {view === 'map' && (
          <div className="countries-modal-map">
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 120, center: [10, 20] }}
              style={{ width: '100%', height: '100%' }}
            >
              <ZoomableGroup minZoom={0.8} maxZoom={6}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }) =>
                    geographies.map(geo => {
                      const visited = visitedSet.has(geo.properties.name.toLowerCase().trim());
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={visited ? '#C9A84C' : 'rgba(250,250,250,0.08)'}
                          stroke="rgba(250,250,250,0.12)"
                          strokeWidth={0.4}
                          style={{
                            default: { outline: 'none' },
                            hover: { outline: 'none', fill: visited ? '#D4B85C' : 'rgba(250,250,250,0.14)' },
                            pressed: { outline: 'none' },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
              </ZoomableGroup>
            </ComposableMap>
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
