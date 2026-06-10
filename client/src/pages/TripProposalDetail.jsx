import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TripProposalDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [addingDream, setAddingDream] = useState(false);
  const [dreamAdded, setDreamAdded] = useState(false);

  useEffect(() => {
    api.get(`/insights/trip-proposals/${id}`)
      .then(res => setProposal(res.data.data))
      .catch(err => setError(err.message || 'Failed to load itinerary'))
      .finally(() => setLoading(false));
  }, [id]);

  function getFlagEmoji(code) {
    if (!code || code.length !== 2) return '🌍';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  }

  async function addToDreams() {
    if (!user || addingDream) return;
    setAddingDream(true);
    try {
      const itineraryNote = [
        proposal.tagline ? `"${proposal.tagline}"` : '',
        proposal.itinerary || '',
        proposal.activities?.length ? '\n\nKey activities:\n' + proposal.activities.map(a => `- ${a}`).join('\n') : '',
        proposal.group_tip ? `\n\nGroup tip: ${proposal.group_tip}` : '',
      ].filter(Boolean).join('\n\n').trim();

      await api.post('/pins', {
        pinType: 'dream',
        placeName: proposal.country_name,
        dreamNote: itineraryNote,
        aiSummary: itineraryNote,
      });
      setDreamAdded(true);
    } catch (err) {
      console.error('Add to dreams failed', err);
    } finally {
      setAddingDream(false);
    }
  }

  async function copyShareUrl() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="proposal-detail-page">
          <div className="discover-loading"><div className="loading-spinner" /></div>
        </div>
      </Layout>
    );
  }

  if (error || !proposal) {
    return (
      <Layout>
        <div className="proposal-detail-page">
          <div className="error-card"><p>⚠️ {error || 'Itinerary not found'}</p></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="proposal-detail-page">
        <div className="proposal-detail-page-inner">

          <div className="proposal-detail-page-header">
            <button className="btn-ghost proposal-back-btn" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <div className="proposal-header-actions">
              {user && (
                <button
                  className="btn-secondary"
                  onClick={addToDreams}
                  disabled={addingDream || dreamAdded}
                >
                  {dreamAdded ? '✓ Added to Dreams' : addingDream ? 'Adding…' : '✦ Add to Dreams'}
                </button>
              )}
              <button
                className={`btn-secondary proposal-share-btn${copied ? ' copied' : ''}`}
                onClick={copyShareUrl}
              >
                {copied ? '✓ Copied!' : '🔗 Share'}
              </button>
            </div>
          </div>

          <div className="proposal-hero">
            <span className="proposal-hero-flag">{getFlagEmoji(proposal.country_code)}</span>
            <div>
              <h1 className="proposal-hero-title">{proposal.title || proposal.country_name}</h1>
              <p className="proposal-hero-country">{proposal.country_name}</p>
            </div>
          </div>

          {proposal.tagline && (
            <p className="proposal-hero-tagline">"{proposal.tagline}"</p>
          )}

          <div className="proposal-tags">
            {proposal.mood && <span className="tag mood">{proposal.mood}</span>}
            {proposal.duration && <span className="tag">⏱ {proposal.duration}</span>}
            {proposal.best_time_to_go && <span className="tag">📅 {proposal.best_time_to_go}</span>}
          </div>

          {proposal.itinerary && (
            <div className="proposal-section">
              <h2>✈️ The Trip</h2>
              <p className="proposal-itinerary-full">{proposal.itinerary}</p>
            </div>
          )}

          {proposal.activities && proposal.activities.length > 0 && (
            <div className="proposal-section">
              <h2>🎯 Key Activities</h2>
              <ul className="activities-list">
                {proposal.activities.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          {proposal.group_tip && (
            <div className="proposal-tip">
              <span>💡 Group tip: </span>{proposal.group_tip}
            </div>
          )}

          {!user && (
            <div className="proposal-signup-cta">
              <h3>Plan your own adventure</h3>
              <p>Join Travel Together to create AI-powered itineraries, track your dreams, and plan with friends.</p>
              <Link to="/login" className="btn-primary">Sign up free →</Link>
            </div>
          )}

        </div>
      </div>
    </Layout>
  );
}
