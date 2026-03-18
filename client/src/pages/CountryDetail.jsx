import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function CountryDetail() {
  const { countryCode } = useParams();
  const [country, setCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

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

  async function loadInsights() {
    setInsightsLoading(true);
    try {
      const nameParam = country?.countryName || countryCode;
      const response = await api.get(`/insights/country/${countryCode}?name=${encodeURIComponent(nameParam)}`);
      setInsights(response.data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setInsightsLoading(false);
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

  if (error && !country) {
    return (
      <Layout>
        <div className="country-detail-page">
          <div className="country-hero">
            <span className="hero-flag">{getFlagEmoji(countryCode)}</span>
            <h1>{countryCode}</h1>
          </div>
          <p className="muted" style={{ marginBottom: '16px' }}>
            This country is not in your travels or wishlist yet.
          </p>
          {!insights && !insightsLoading && (
            <button className="insights-trigger-btn" onClick={loadInsights}>
              ✨ Get AI Travel Insights
            </button>
          )}
          {insightsLoading && (
            <div className="discover-loading">
              <div className="loading-spinner"></div>
              <p>Generating insights...</p>
            </div>
          )}
          {insights && (
            <div className="country-insights-section">
              {insights.vibe && <div className="insight-vibe">"{insights.vibe}"</div>}
            </div>
          )}
          <div className="detail-actions">
            <Link to="/travels" className="back-link">← Back to My Travels</Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="country-detail-page">
        <div className="country-hero">
          <span className="hero-flag">{getFlagEmoji(countryCode)}</span>
          <h1>{country?.countryName || countryCode}</h1>
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

        {/* AI Insights */}
        {!insights && !insightsLoading && (
          <button className="insights-trigger-btn" onClick={loadInsights}>
            ✨ Get AI Travel Insights
          </button>
        )}

        {insightsLoading && (
          <div className="discover-loading">
            <div className="loading-spinner"></div>
            <p>Generating insights...</p>
          </div>
        )}

        {insights && (
          <div className="country-insights-section">
            {insights.vibe && (
              <div className="insight-vibe">"{insights.vibe}"</div>
            )}

            {insights.best_times && (
              <div className="insight-card">
                <h3>📅 Best Times to Visit</h3>
                <div className="best-times-grid">
                  {(typeof insights.best_times === 'string' ? JSON.parse(insights.best_times) : insights.best_times).map((bt, i) => (
                    <div key={i} className="best-time-item">
                      <div className="best-time-months">{bt.months}</div>
                      <div className="best-time-reason">{bt.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.cultural_facts && insights.cultural_facts.length > 0 && (
              <div className="insight-card">
                <h3>🏛️ Cultural Facts</h3>
                <ul className="cultural-facts-list">
                  {insights.cultural_facts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {insights.general_tips && insights.general_tips.length > 0 && (
              <div className="insight-card">
                <h3>💡 Travel Tips</h3>
                <ul className="tips-list">
                  {insights.general_tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {insights.top_experiences && (
              <div className="insight-card">
                <h3>🌟 Top Experiences</h3>
                <div className="experiences-grid">
                  {(typeof insights.top_experiences === 'string' ? JSON.parse(insights.top_experiences) : insights.top_experiences).map((exp, i) => (
                    <div key={i} className="experience-item">
                      <span className="exp-type-badge">{exp.type}</span>
                      <div className="exp-name">{exp.name}</div>
                      <div className="exp-desc">{exp.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="detail-actions">
          <Link to="/travels" className="back-link">← Back to My Travels</Link>
        </div>
      </div>
    </Layout>
  );
}

