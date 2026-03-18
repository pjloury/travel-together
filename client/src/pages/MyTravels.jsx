import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import CountryPicker from '../components/CountryPicker';
import CityAutocomplete from '../components/CityAutocomplete';
import api from '../api/client';

export default function MyTravels() {
  const [countries, setCountries] = useState([]);
  const [wishlistCodes, setWishlistCodes] = useState([]);
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [countriesRes, wishlistRes] = await Promise.all([
        api.get('/countries'),
        api.get('/wishlist')
      ]);
      setCountries(countriesRes.data);
      setWishlistCodes(wishlistRes.data.map(w => w.countryCode));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCountry({ countryCode, countryName }) {
    // Check if already added
    if (countries.find(c => c.countryCode === countryCode)) {
      return;
    }
    try {
      await api.post('/countries', { countryCode, countryName });
      fetchData();
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
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteCity(cityId) {
    try {
      await api.delete(`/cities/${cityId}`);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateCountry(countryCode, updates) {
    try {
      await api.put(`/countries/${countryCode}`, updates);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  const visitedCodes = countries.map(c => c.countryCode);

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
        <button 
          className="add-btn"
          onClick={() => setShowPicker(!showPicker)}
        >
          {showPicker ? '✕ Close' : '+ Add Countries'}
        </button>
        
        {showPicker && (
          <div className="country-picker-container">
            <CountryPicker
              onSelect={handleAddCountry}
              visitedCountries={visitedCodes}
              wishlistCountries={wishlistCodes}
              mode="single"
              title="Add a country you've visited"
              placeholder="Filter countries..."
            />
          </div>
        )}
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

                  <div className="enjoyment-section">
                    <div className="enjoyment-rating">
                      <h4>Enjoyment Rating</h4>
                      <div className="interest-stars">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            className={`star ${star <= (country.enjoymentRating || 0) ? 'filled' : ''}`}
                            onClick={() => handleUpdateCountry(country.countryCode, { enjoymentRating: star })}
                            title={`Rate ${star} star${star !== 1 ? 's' : ''}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="year-visited">
                      <h4>Year Visited</h4>
                      <input
                        type="number"
                        className="year-input"
                        min="1950"
                        max={new Date().getFullYear()}
                        defaultValue={country.visitedYear || ''}
                        placeholder="e.g. 2023"
                        onBlur={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (val >= 1950 && val <= new Date().getFullYear()) {
                            handleUpdateCountry(country.countryCode, { visitedYear: val });
                          }
                        }}
                      />
                    </div>
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

