import { useState, useEffect, useMemo } from 'react';
import './CountryPicker.css';

// Continent mapping based on UN M49 regions
const CONTINENTS = {
  AF: { name: 'Africa', emoji: '🌍' },
  AN: { name: 'Antarctica', emoji: '🌏' },
  AS: { name: 'Asia', emoji: '🌏' },
  EU: { name: 'Europe', emoji: '🌍' },
  NA: { name: 'Americas', emoji: '🌎' },
  OC: { name: 'Oceania', emoji: '🌏' },
  SA: { name: 'Americas', emoji: '🌎' },
};

// Map country codes to continents
const COUNTRY_CONTINENT = {
  // Africa
  DZ: 'AF', AO: 'AF', BJ: 'AF', BW: 'AF', BF: 'AF', BI: 'AF', CV: 'AF', CM: 'AF', CF: 'AF', TD: 'AF',
  KM: 'AF', CG: 'AF', CD: 'AF', CI: 'AF', DJ: 'AF', EG: 'AF', GQ: 'AF', ER: 'AF', SZ: 'AF', ET: 'AF',
  GA: 'AF', GM: 'AF', GH: 'AF', GN: 'AF', GW: 'AF', KE: 'AF', LS: 'AF', LR: 'AF', LY: 'AF', MG: 'AF',
  MW: 'AF', ML: 'AF', MR: 'AF', MU: 'AF', YT: 'AF', MA: 'AF', MZ: 'AF', NA: 'AF', NE: 'AF', NG: 'AF',
  RE: 'AF', RW: 'AF', SH: 'AF', ST: 'AF', SN: 'AF', SC: 'AF', SL: 'AF', SO: 'AF', ZA: 'AF', SS: 'AF',
  SD: 'AF', TZ: 'AF', TG: 'AF', TN: 'AF', UG: 'AF', EH: 'AF', ZM: 'AF', ZW: 'AF',
  // Americas (North)
  AI: 'NA', AG: 'NA', AW: 'NA', BS: 'NA', BB: 'NA', BZ: 'NA', BM: 'NA', BQ: 'NA', CA: 'NA', KY: 'NA',
  CR: 'NA', CU: 'NA', CW: 'NA', DM: 'NA', DO: 'NA', SV: 'NA', GL: 'NA', GD: 'NA', GP: 'NA', GT: 'NA',
  HT: 'NA', HN: 'NA', JM: 'NA', MQ: 'NA', MX: 'NA', MS: 'NA', NI: 'NA', PA: 'NA', PR: 'NA', BL: 'NA',
  KN: 'NA', LC: 'NA', MF: 'NA', PM: 'NA', VC: 'NA', SX: 'NA', TT: 'NA', TC: 'NA', US: 'NA', VG: 'NA',
  VI: 'NA',
  // Americas (South)
  AR: 'SA', BO: 'SA', BR: 'SA', CL: 'SA', CO: 'SA', EC: 'SA', FK: 'SA', GF: 'SA', GY: 'SA', PY: 'SA',
  PE: 'SA', SR: 'SA', UY: 'SA', VE: 'SA',
  // Asia
  AF: 'AS', AM: 'AS', AZ: 'AS', BH: 'AS', BD: 'AS', BT: 'AS', BN: 'AS', KH: 'AS', CN: 'AS', CY: 'AS',
  GE: 'AS', HK: 'AS', IN: 'AS', ID: 'AS', IR: 'AS', IQ: 'AS', IL: 'AS', JP: 'AS', JO: 'AS', KZ: 'AS',
  KW: 'AS', KG: 'AS', LA: 'AS', LB: 'AS', MO: 'AS', MY: 'AS', MV: 'AS', MN: 'AS', MM: 'AS', NP: 'AS',
  KP: 'AS', OM: 'AS', PK: 'AS', PS: 'AS', PH: 'AS', QA: 'AS', SA: 'AS', SG: 'AS', KR: 'AS', LK: 'AS',
  SY: 'AS', TW: 'AS', TJ: 'AS', TH: 'AS', TL: 'AS', TR: 'AS', TM: 'AS', AE: 'AS', UZ: 'AS', VN: 'AS',
  YE: 'AS',
  // Europe
  AL: 'EU', AD: 'EU', AT: 'EU', BY: 'EU', BE: 'EU', BA: 'EU', BG: 'EU', HR: 'EU', CZ: 'EU', DK: 'EU',
  EE: 'EU', FO: 'EU', FI: 'EU', FR: 'EU', DE: 'EU', GI: 'EU', GR: 'EU', GG: 'EU', HU: 'EU', IS: 'EU',
  IE: 'EU', IM: 'EU', IT: 'EU', JE: 'EU', XK: 'EU', LV: 'EU', LI: 'EU', LT: 'EU', LU: 'EU', MT: 'EU',
  MD: 'EU', MC: 'EU', ME: 'EU', NL: 'EU', MK: 'EU', NO: 'EU', PL: 'EU', PT: 'EU', RO: 'EU', RU: 'EU',
  SM: 'EU', RS: 'EU', SK: 'EU', SI: 'EU', ES: 'EU', SJ: 'EU', SE: 'EU', CH: 'EU', UA: 'EU', GB: 'EU',
  VA: 'EU',
  // Oceania
  AS: 'OC', AU: 'OC', CK: 'OC', FJ: 'OC', PF: 'OC', GU: 'OC', KI: 'OC', MH: 'OC', FM: 'OC', NR: 'OC',
  NC: 'OC', NZ: 'OC', NU: 'OC', NF: 'OC', MP: 'OC', PW: 'OC', PG: 'OC', PN: 'OC', WS: 'OC', SB: 'OC',
  TK: 'OC', TO: 'OC', TV: 'OC', VU: 'OC', WF: 'OC',
  // Antarctica
  AQ: 'AN',
};

// Preferred display order for continents
const CONTINENT_ORDER = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC', 'AN'];

function getFlagEmoji(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

export default function CountryPicker({ 
  onSelect, 
  selectedCountries = [],   // { code, name }[]
  visitedCountries = [],    // string[] of country codes
  wishlistCountries = [],   // string[] of country codes
  mode = 'single',          // 'single' | 'multi'
  title = 'Select Countries',
  placeholder = 'Filter countries...'
}) {
  const [allCountries, setAllCountries] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [collapsedContinents, setCollapsedContinents] = useState({});

  useEffect(() => {
    // Fetch countries from REST Countries API
    const cached = localStorage.getItem('countries-full');
    if (cached) {
      setAllCountries(JSON.parse(cached));
      setLoading(false);
    } else {
      fetch('https://restcountries.com/v3.1/all?fields=name,cca2,region')
        .then(res => res.json())
        .then(data => {
          const processed = data.map(c => ({
            code: c.cca2,
            name: c.name.common,
            continent: COUNTRY_CONTINENT[c.cca2] || 'AF'
          }));
          localStorage.setItem('countries-full', JSON.stringify(processed));
          setAllCountries(processed);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch countries:', err);
          setLoading(false);
        });
    }
  }, []);

  const selectedCodes = useMemo(() => 
    new Set(selectedCountries.map(c => c.code)),
    [selectedCountries]
  );

  const visitedSet = useMemo(() => new Set(visitedCountries), [visitedCountries]);
  const wishlistSet = useMemo(() => new Set(wishlistCountries), [wishlistCountries]);

  const groupedCountries = useMemo(() => {
    const filtered = filter.trim().toLowerCase()
      ? allCountries.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()))
      : allCountries;

    // Group by continent
    const groups = {};
    CONTINENT_ORDER.forEach(cont => {
      groups[cont] = [];
    });

    filtered.forEach(country => {
      const continent = country.continent;
      if (groups[continent]) {
        groups[continent].push(country);
      }
    });

    // Sort each group alphabetically
    Object.keys(groups).forEach(cont => {
      groups[cont].sort((a, b) => a.name.localeCompare(b.name));
    });

    return groups;
  }, [allCountries, filter]);

  function handleCountryClick(country) {
    if (mode === 'single') {
      onSelect({ countryCode: country.code, countryName: country.name });
    } else {
      // Toggle selection for multi mode
      const isSelected = selectedCodes.has(country.code);
      if (isSelected) {
        const updated = selectedCountries.filter(c => c.code !== country.code);
        onSelect(updated);
      } else {
        onSelect([...selectedCountries, { code: country.code, name: country.name }]);
      }
    }
  }

  function toggleContinent(continent) {
    setCollapsedContinents(prev => ({
      ...prev,
      [continent]: !prev[continent]
    }));
  }

  function getCountryStatus(code) {
    if (visitedSet.has(code)) return 'visited';
    if (wishlistSet.has(code)) return 'wishlist';
    return null;
  }

  if (loading) {
    return (
      <div className="country-picker loading">
        <div className="loading-spinner">Loading countries...</div>
      </div>
    );
  }

  return (
    <div className="country-picker">
      <div className="picker-header">
        <h3>{title}</h3>
        <div className="filter-input">
          <span className="filter-icon">🔍</span>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={placeholder}
          />
          {filter && (
            <button className="clear-filter" onClick={() => setFilter('')}>×</button>
          )}
        </div>
      </div>

      <div className="continents-list">
        {CONTINENT_ORDER.map(continent => {
          const countries = groupedCountries[continent];
          if (!countries || countries.length === 0) return null;

          const isCollapsed = collapsedContinents[continent];
          const continentInfo = CONTINENTS[continent];
          // Merge NA and SA into Americas
          const displayName = continent === 'SA' ? null : continentInfo.name;
          
          // Skip SA as a separate header (merged with NA)
          if (continent === 'SA') {
            return (
              <div key={continent} className="continent-section merged">
                <div className="countries-grid">
                  {countries.map(country => (
                    <CountryItem
                      key={country.code}
                      country={country}
                      isSelected={selectedCodes.has(country.code)}
                      status={getCountryStatus(country.code)}
                      onClick={() => handleCountryClick(country)}
                    />
                  ))}
                </div>
              </div>
            );
          }

          return (
            <div key={continent} className="continent-section">
              <div 
                className="continent-header"
                onClick={() => toggleContinent(continent)}
              >
                <span className="continent-emoji">{continentInfo.emoji}</span>
                <span className="continent-name">{displayName}</span>
                <span className="country-count">{countries.length}</span>
                <span className={`collapse-arrow ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
              </div>
              
              {!isCollapsed && (
                <div className="countries-grid">
                  {countries.map(country => (
                    <CountryItem
                      key={country.code}
                      country={country}
                      isSelected={selectedCodes.has(country.code)}
                      status={getCountryStatus(country.code)}
                      onClick={() => handleCountryClick(country)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CountryItem({ country, isSelected, status, onClick }) {
  return (
    <button
      className={`country-item ${isSelected ? 'selected' : ''} ${status || ''}`}
      onClick={onClick}
      title={country.name}
    >
      <span className="flag">{getFlagEmoji(country.code)}</span>
      <span className="name">{country.name}</span>
      {isSelected && <span className="check">✓</span>}
      {status === 'visited' && !isSelected && <span className="badge visited">✓ Visited</span>}
      {status === 'wishlist' && !isSelected && <span className="badge wishlist">★ Wishlist</span>}
    </button>
  );
}

