import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import api from '../api/client';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [countriesRes, wishlistRes, friendsRes] = await Promise.all([
        api.get('/countries'),
        api.get('/wishlist'),
        api.get('/friends')
      ]);
      setStats({
        visited: (countriesRes.data || []).length,
        wishlist: (wishlistRes.data || []).length,
        friends: (friendsRes.data || []).length
      });
    } catch {
      // stats are non-critical, show zeros
      setStats({ visited: 0, wishlist: 0, friends: 0 });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="dashboard-page">
        <div className="page-header">
          <h1>Welcome back, {user?.displayName}</h1>
          <p className="subtitle">Ready to plan your next adventure?</p>
        </div>

        {/* Quick Stats */}
        {!loading && stats && (
          <div className="stats-grid">
            <Link to="/travels" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-number">{stats.visited}</span>
                <span className="stat-label">Countries Visited</span>
                <span className="stat-icon">🌍</span>
              </div>
            </Link>
            <Link to="/wishlist" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-number">{stats.wishlist}</span>
                <span className="stat-label">On Wishlist</span>
                <span className="stat-icon">⭐</span>
              </div>
            </Link>
            <Link to="/friends" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-number">{stats.friends}</span>
                <span className="stat-label">Travel Friends</span>
                <span className="stat-icon">👥</span>
              </div>
            </Link>
            <Link to="/world-map" className="stat-card-link">
              <div className="stat-card">
                <span className="stat-number map-icon-stat">🗺️</span>
                <span className="stat-label">World Map</span>
                <span className="stat-icon">→</span>
              </div>
            </Link>
          </div>
        )}

        {/* AI Features */}
        <div className="dashboard-section">
          <h2>AI-Powered Features</h2>
          <div className="feature-cards">
            <Link to="/discover" className="feature-card">
              <div className="feature-icon">✈️</div>
              <div className="feature-info">
                <h3>Discover</h3>
                <p>Get personalized destination recommendations based on your travel history</p>
              </div>
            </Link>
            <Link to="/trip-proposals" className="feature-card">
              <div className="feature-icon">🗺️</div>
              <div className="feature-info">
                <h3>Trip Proposals</h3>
                <p>Generate AI-crafted itineraries for your group</p>
              </div>
            </Link>
            <Link to="/travel-profile" className="feature-card">
              <div className="feature-icon">🧳</div>
              <div className="feature-info">
                <h3>Travel Profile</h3>
                <p>Discover your traveler personality and get insights</p>
              </div>
            </Link>
            <Link to="/lets-travel" className="feature-card">
              <div className="feature-icon">👫</div>
              <div className="feature-info">
                <h3>Let's Travel</h3>
                <p>Find countries you and your friends both want to visit</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Quick Links */}
        <div className="dashboard-section">
          <h2>Quick Access</h2>
          <div className="quick-links">
            <Link to="/travels" className="quick-link">My Travels</Link>
            <Link to="/wishlist" className="quick-link">Wishlist</Link>
            <Link to="/friends" className="quick-link">Friends</Link>
            <Link to="/world-map" className="quick-link">World Map</Link>
          </div>
        </div>
      </div>
    </Layout>
  );
}
