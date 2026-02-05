import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwnProfile = !userId || userId === currentUser?.id;
  const targetId = userId || currentUser?.id;

  useEffect(() => {
    if (targetId) {
      fetchProfile();
    }
  }, [targetId]);

  async function fetchProfile() {
    try {
      const response = await api.get(`/users/${targetId}/profile`);
      setProfile(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  if (error) {
    return (
      <Layout>
        <div className="error-page">
          <h2>Error</h2>
          <p>{error}</p>
          <Link to="/friends">Back to Friends</Link>
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="error-page">
          <h2>User Not Found</h2>
          <Link to="/friends">Back to Friends</Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-avatar">
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h1>{profile.displayName}</h1>
            <p className="username">@{profile.username}</p>
            <p className="stats">
              <span className="stat">{profile.totalCountries} countries visited</span>
              {profile.isFriend && <span className="badge friend-badge">Friend</span>}
            </p>
          </div>
        </div>

        {/* Public info - always shown */}
        <div className="profile-section summary-section">
          <h3>Travel Summary</h3>
          <div className="summary-stats">
            <div className="stat-card">
              <span className="stat-number">{profile.totalCountries}</span>
              <span className="stat-label">Countries</span>
            </div>
          </div>
        </div>

        {/* Private info - only for friends or self */}
        {(profile.isFriend || isOwnProfile) && profile.countries ? (
          <>
            <div className="profile-section">
              <h3>Countries Visited</h3>
              {profile.countries.length === 0 ? (
                <p className="muted">No countries yet</p>
              ) : (
                <div className="countries-grid">
                  {profile.countries.map(country => (
                    <div key={country.id} className="country-card-small">
                      <span className="flag">{getFlagEmoji(country.countryCode)}</span>
                      <div className="country-details">
                        <span className="name">{country.countryName}</span>
                        {country.cities?.length > 0 && (
                          <span className="cities">
                            {country.cities.map(c => c.cityName).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="profile-section">
              <h3>Wishlist</h3>
              {profile.wishlist?.length === 0 ? (
                <p className="muted">No wishlist items yet</p>
              ) : (
                <div className="wishlist-mini-grid">
                  {profile.wishlist?.map(item => (
                    <div key={item.id} className="wishlist-mini-card">
                      <span className="flag">{getFlagEmoji(item.countryCode)}</span>
                      <span className="name">{item.countryName}</span>
                      <span className="interest">
                        {'★'.repeat(item.interestLevel)}
                        {'☆'.repeat(5 - item.interestLevel)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="profile-section private-notice">
            <p>🔒 Travel details are only visible to friends</p>
            {!profile.isFriend && !isOwnProfile && (
              <p className="hint">Add {profile.displayName} as a friend to see their travel history.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

