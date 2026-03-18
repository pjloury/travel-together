import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

const MATCH_TYPE_LABELS = {
  style_match: '✨ Matches your style',
  friend_overlap: '👥 Friends want this too',
  next_step: '🗺️ Natural next step',
  wild_card: '🎲 Wild card pick'
};

const MATCH_TYPE_COLORS = {
  style_match: '#00d4aa',
  friend_overlap: '#7c3aed',
  next_step: '#2563eb',
  wild_card: '#dc2626'
};

export default function Discover() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadRecommendations();
  }, []);

  async function loadRecommendations() {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/insights/discover');
      setData(response.data);
    } catch (err) {
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }

  function getFlagEmoji(code) {
    if (!code || code.length !== 2) return '🌍';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  }

  return (
    <Layout>
      <div className="discover-page">
        <div className="page-header">
          <div>
            <h1>✈️ Discover</h1>
            <p className="page-subtitle">AI-powered destinations picked just for you</p>
          </div>
          <button className="btn-secondary" onClick={loadRecommendations} disabled={loading}>
            {loading ? 'Generating...' : '🔄 Refresh'}
          </button>
        </div>

        {loading && (
          <div className="discover-loading">
            <div className="loading-spinner"></div>
            <p>Claude is analyzing your travel profile...</p>
            <p className="loading-sub">This takes a few seconds</p>
          </div>
        )}

        {error && (
          <div className="error-card">
            <p>⚠️ {error}</p>
            {error.includes('not configured') && (
              <p className="error-hint">Add your ANTHROPIC_API_KEY to enable AI features</p>
            )}
          </div>
        )}

        {!loading && data && (
          <>
            {data.travelPersonality && (
              <div className="personality-card">
                <h3>🧠 Your Travel Personality</h3>
                <p>{data.travelPersonality}</p>
              </div>
            )}

            <div className="recommendations-grid">
              {(data.recommendations || []).map((rec, i) => (
                <div key={i} className="recommendation-card" onClick={() => navigate(`/country/${rec.countryCode}`)}>
                  <div className="rec-header">
                    <span className="rec-flag">{getFlagEmoji(rec.countryCode)}</span>
                    <div>
                      <h3 className="rec-country">{rec.countryName}</h3>
                      <span
                        className="rec-match-badge"
                        style={{ color: MATCH_TYPE_COLORS[rec.matchType] }}
                      >
                        {MATCH_TYPE_LABELS[rec.matchType] || rec.matchType}
                      </span>
                    </div>
                  </div>
                  <p className="rec-reason">{rec.reason}</p>
                  {rec.highlight && (
                    <div className="rec-highlight">
                      <span className="highlight-label">Must do:</span> {rec.highlight}
                    </div>
                  )}
                  <div className="rec-footer">
                    <span className="rec-best-with">
                      {rec.bestWith === 'friends' ? '👥 Best with friends' :
                       rec.bestWith === 'solo' ? '🧳 Great solo' : '✅ Solo or group'}
                    </span>
                    <span className="rec-cta">Explore →</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
