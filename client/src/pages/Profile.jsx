import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { userId } = useParams();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [overlap, setOverlap] = useState(null);
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
      if (!isOwnProfile && response.data.isFriend) {
        fetchOverlap();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOverlap() {
    try {
      const res = await api.get(`/alignment/${targetId}`);
      setOverlap(res.data);
    } catch {
      // overlap is non-critical
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

            {/* Travel Overlap - only for friend profiles */}
            {!isOwnProfile && overlap && (
              <div className="profile-section overlap-section">
                <h3>Travel Overlap</h3>

                {overlap.sharedWishlist?.length > 0 && (
                  <div className="overlap-group">
                    <h4>Shared Wishlist</h4>
                    <div className="overlap-grid">
                      {overlap.sharedWishlist.map(item => (
                        <Link key={item.country_code} to={`/country/${item.country_code}`} className="overlap-card">
                          <span className="overlap-flag">{getFlagEmoji(item.country_code)}</span>
                          <span className="overlap-name">{item.country_name}</span>
                          <div className="overlap-stars">
                            <span>You: {'★'.repeat(item.your_interest)}</span>
                            <span>Them: {'★'.repeat(item.their_interest)}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {overlap.theyCanHelp?.length > 0 && (
                  <div className="overlap-group">
                    <h4>They Can Help You</h4>
                    <p className="overlap-desc">Countries {profile.displayName} has visited that are on your wishlist</p>
                    <div className="overlap-grid">
                      {overlap.theyCanHelp.map(item => (
                        <Link key={item.country_code} to={`/country/${item.country_code}`} className="overlap-card they-can-help">
                          <span className="overlap-flag">{getFlagEmoji(item.country_code)}</span>
                          <span className="overlap-name">{item.country_name}</span>
                          <span className="overlap-interest">Your interest: {'★'.repeat(item.your_interest)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {overlap.iCanHelp?.length > 0 && (
                  <div className="overlap-group">
                    <h4>You Can Help Them</h4>
                    <p className="overlap-desc">Countries you've visited that are on {profile.displayName}'s wishlist</p>
                    <div className="overlap-grid">
                      {overlap.iCanHelp.map(item => (
                        <Link key={item.country_code} to={`/country/${item.country_code}`} className="overlap-card i-can-help">
                          <span className="overlap-flag">{getFlagEmoji(item.country_code)}</span>
                          <span className="overlap-name">{item.country_name}</span>
                          <span className="overlap-interest">Their interest: {'★'.repeat(item.their_interest)}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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

