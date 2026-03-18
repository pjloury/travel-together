import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/client';

const STYLE_LABELS = {
  adventurer: '🧗 Adventurer',
  culture_seeker: '🏛️ Culture Seeker',
  beach_lover: '🏖️ Beach Lover',
  foodie: '🍜 Foodie',
  digital_nomad: '💻 Digital Nomad',
  luxury_traveler: '✨ Luxury Traveler',
  backpacker: '🎒 Backpacker',
  explorer: '🗺️ Explorer'
};

export default function TravelProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadStats();
    loadProfile();
  }, []);

  async function loadStats() {
    try {
      const [visited, wishlist] = await Promise.all([
        api.get('/countries'),
        api.get('/wishlist')
      ]);
      setStats({
        visited: visited.data?.length || 0,
        wishlist: wishlist.data?.length || 0
      });
    } catch {}
  }

  async function loadProfile() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/insights/travel-profile');
      setProfile(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="travel-profile-page">
        <div className="page-header">
          <div>
            <h1>🧳 My Travel Profile</h1>
            <p className="page-subtitle">AI-generated insights about your travel style</p>
          </div>
          <button className="btn-secondary" onClick={loadProfile} disabled={loading}>
            {loading ? 'Analyzing...' : '🔄 Regenerate'}
          </button>
        </div>

        {stats && (
          <div className="profile-stats">
            <div className="stat-card">
              <span className="stat-number">{stats.visited}</span>
              <span className="stat-label">Countries Visited</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.wishlist}</span>
              <span className="stat-label">On Wishlist</span>
            </div>
          </div>
        )}

        {loading && (
          <div className="discover-loading">
            <div className="loading-spinner"></div>
            <p>Claude is analyzing your travel history...</p>
          </div>
        )}

        {error && (
          <div className="error-card">
            <p>⚠️ {error}</p>
          </div>
        )}

        {!loading && !profile && !error && (
          <div className="empty-state">
            <p className="empty-icon">🌍</p>
            <h3>No profile yet</h3>
            <p>Add countries to your travels and wishlist to generate your AI travel profile</p>
          </div>
        )}

        {!loading && profile && (
          <div className="profile-content">
            {profile.travel_style && (
              <div className="profile-style-card">
                <h2>{STYLE_LABELS[profile.travel_style] || profile.travel_style}</h2>
              </div>
            )}

            {profile.profile_summary && (
              <div className="profile-section">
                <h3>About Your Travel Style</h3>
                <p className="profile-summary">{profile.profile_summary}</p>
              </div>
            )}

            {profile.top_regions && profile.top_regions.length > 0 && (
              <div className="profile-section">
                <h3>🌍 Your Favorite Regions</h3>
                <div className="regions-list">
                  {profile.top_regions.map((r, i) => (
                    <span key={i} className="region-tag">{r}</span>
                  ))}
                </div>
              </div>
            )}

            {profile.insights && profile.insights.length > 0 && (
              <div className="profile-section">
                <h3>💡 Insights</h3>
                <ul className="insights-list">
                  {profile.insights.map((insight, i) => (
                    <li key={i}>{insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {profile.next_challenge && (
              <div className="profile-challenge">
                <h3>🎯 Your Next Challenge</h3>
                <p>{profile.next_challenge}</p>
              </div>
            )}

            <p className="profile-generated">
              Generated {new Date(profile.generated_at).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
