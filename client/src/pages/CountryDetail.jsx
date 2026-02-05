import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function CountryDetail() {
  const { countryCode } = useParams();
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCountryDetail();
  }, [countryCode]);

  async function fetchCountryDetail() {
    try {
      const response = await api.get(`/countries/${countryCode}/detail`);
      setCountry(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getFlagEmoji(code) {
    const codePoints = code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>;
  }

  if (error) {
    return (
      <Layout>
        <div className="error-page">
          <h2>Error</h2>
          <p>{error}</p>
          <Link to="/travels">Back to My Travels</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="country-detail-page">
        <div className="country-hero">
          <span className="hero-flag">{getFlagEmoji(countryCode)}</span>
          <h1>{country.countryName}</h1>
        </div>

        <div className="country-status">
          {country.visited && (
            <span className="status-badge visited">✓ You've been here</span>
          )}
          {country.onWishlist && (
            <span className="status-badge wishlist">
              ★ On your wishlist ({country.wishlistInfo?.interestLevel}/5)
            </span>
          )}
        </div>

        {/* Your cities visited */}
        {country.visited && (
          <div className="detail-section">
            <h3>Cities You've Visited</h3>
            {country.cities.length === 0 ? (
              <p className="muted">No cities added yet</p>
            ) : (
              <div className="cities-chips">
                {country.cities.map(city => (
                  <span key={city.id} className="city-chip">{city.cityName}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Your wishlist cities */}
        {country.onWishlist && country.wishlistInfo?.specificCities?.length > 0 && (
          <div className="detail-section">
            <h3>Cities You Want to Visit</h3>
            <div className="cities-chips">
              {country.wishlistInfo.specificCities.map((city, i) => (
                <span key={i} className="city-chip wishlist">{city}</span>
              ))}
            </div>
          </div>
        )}

        {/* Friends who've been */}
        {country.friendsVisited?.length > 0 && (
          <div className="detail-section">
            <h3>🎒 Friends Who've Been</h3>
            <div className="friends-detail-list">
              {country.friendsVisited.map(friend => (
                <Link key={friend.id} to={`/profile/${friend.id}`} className="friend-detail-card">
                  <span className="friend-name">{friend.displayName}</span>
                  {friend.citiesVisited?.length > 0 && (
                    <div className="friend-cities-detail">
                      Visited: {friend.citiesVisited.join(', ')}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Friends who want to go */}
        {country.friendsWant?.length > 0 && (
          <div className="detail-section">
            <h3>✈️ Friends Who Want to Go</h3>
            <div className="friends-detail-list">
              {country.friendsWant.map(friend => (
                <Link key={friend.id} to={`/profile/${friend.id}`} className="friend-detail-card">
                  <span className="friend-name">{friend.displayName}</span>
                  <span className="friend-interest">
                    Interest: {'★'.repeat(friend.interestLevel)}
                  </span>
                  {friend.specificCities?.length > 0 && (
                    <div className="friend-cities-detail">
                      Wants: {friend.specificCities.join(', ')}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="detail-actions">
          <Link to="/travels" className="back-link">← Back to My Travels</Link>
        </div>
      </div>
    </Layout>
  );
}

