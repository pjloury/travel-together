import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import CountryAutocomplete from '../components/CountryAutocomplete';
import CityAutocomplete from '../components/CityAutocomplete';
import api from '../api/client';

export default function MyTravels() {
  const [countries, setCountries] = useState([]);
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCountries();
  }, []);

  async function fetchCountries() {
    try {
      const response = await api.get('/countries');
      setCountries(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCountry({ countryCode, countryName }) {
    try {
      await api.post('/countries', { countryCode, countryName });
      fetchCountries();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCountry(countryCode) {
    if (!confirm('Delete this country and all its cities?')) return;
    try {
      await api.delete(`/countries/${countryCode}`);
      setCountries(countries.filter(c => c.countryCode !== countryCode));
      if (expandedCountry === countryCode) setExpandedCountry(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCity(countryCode, cityData) {
    try {
      await api.post(`/countries/${countryCode}/cities`, cityData);
      fetchCountries();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCity(cityId) {
    try {
      await api.delete(`/cities/${cityId}`);
      fetchCountries();
    } catch (err) {
      setError(err.message);
    }
  }

  function getFlagEmoji(countryCode) {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>My Travels</h1>
        <p className="subtitle">Countries and cities you've visited</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="add-country-section">
        <h3>Add a country you've visited</h3>
        <CountryAutocomplete onSelect={handleAddCountry} />
      </div>

      {countries.length === 0 ? (
        <div className="empty-state">
          <p>No countries yet. Add your first travel destination above!</p>
        </div>
      ) : (
        <div className="countries-list">
          {countries.map(country => (
            <div key={country.countryCode} className="country-card">
              <div 
                className="country-header"
                onClick={() => setExpandedCountry(
                  expandedCountry === country.countryCode ? null : country.countryCode
                )}
              >
                <span className="country-flag">{getFlagEmoji(country.countryCode)}</span>
                <span className="country-name">{country.countryName}</span>
                <span className="city-count">
                  {country.cities?.length || 0} cities
                </span>
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCountry(country.countryCode);
                  }}
                >
                  ×
                </button>
              </div>

              {expandedCountry === country.countryCode && (
                <div className="country-expanded">
                  <div className="cities-section">
                    <h4>Cities visited</h4>
                    {country.cities?.length > 0 ? (
                      <ul className="cities-list">
                        {country.cities.map(city => (
                          <li key={city.id} className="city-item">
                            <span>{city.cityName}</span>
                            <button 
                              className="delete-btn small"
                              onClick={() => handleDeleteCity(city.id)}
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="no-cities">No cities added yet</p>
                    )}
                    <CityAutocomplete 
                      onSelect={(cityData) => handleAddCity(country.countryCode, cityData)}
                      countryCode={country.countryCode}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

