import { useState, useEffect, useRef } from 'react';

export default function CountryAutocomplete({ onSelect, placeholder = "Search for a country..." }) {
  const [countries, setCountries] = useState([]);
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const wrapperRef = useRef(null);

  useEffect(() => {
    // Fetch countries from REST Countries API
    const cached = localStorage.getItem('countries');
    if (cached) {
      setCountries(JSON.parse(cached));
      setLoading(false);
    } else {
      fetch('https://restcountries.com/v3.1/all?fields=name,cca2')
        .then(res => res.json())
        .then(data => {
          const sorted = data
            .map(c => ({ code: c.cca2, name: c.name.common }))
            .sort((a, b) => a.name.localeCompare(b.name));
          localStorage.setItem('countries', JSON.stringify(sorted));
          setCountries(sorted);
          setLoading(false);
        })
        .catch(err => {
          console.error('Failed to fetch countries:', err);
          setLoading(false);
        });
    }
  }, []);

  useEffect(() => {
    // Close dropdown on outside click
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setFiltered([]);
      return;
    }
    const lower = query.toLowerCase();
    setFiltered(countries.filter(c => c.name.toLowerCase().includes(lower)).slice(0, 10));
  }, [query, countries]);

  function handleSelect(country) {
    onSelect({ countryCode: country.code, countryName: country.name });
    setQuery('');
    setShowDropdown(false);
  }

  if (loading) {
    return <input placeholder="Loading countries..." disabled />;
  }

  return (
    <div className="autocomplete-wrapper" ref={wrapperRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
        className="autocomplete-input"
      />
      {showDropdown && filtered.length > 0 && (
        <ul className="autocomplete-dropdown">
          {filtered.map(country => (
            <li key={country.code} onClick={() => handleSelect(country)}>
              <span className="country-flag">{getFlagEmoji(country.code)}</span>
              {country.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getFlagEmoji(countryCode) {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

