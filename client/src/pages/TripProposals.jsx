import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import CountryPicker from '../components/CountryPicker';
import api from '../api/client';

export default function TripProposals() {
  const [proposals, setProposals] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [form, setForm] = useState({ countryCode: '', countryName: '', participantIds: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [proposalsRes, friendsRes] = await Promise.all([
        api.get('/insights/trip-proposals'),
        api.get('/friends')
      ]);
      setProposals(proposalsRes.data || []);
      setFriends(friendsRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateProposal() {
    if (!form.countryCode || !form.countryName) {
      setError('Please enter a country');
      return;
    }
    setGenerating(true);
    setError('');
    try {
      const res = await api.post('/insights/trip-proposal', {
        countryCode: form.countryCode.toUpperCase(),
        countryName: form.countryName,
        participantIds: form.participantIds
      });
      setProposals(prev => [res.data, ...prev]);
      setSelectedProposal(res.data);
      setShowNew(false);
      setForm({ countryCode: '', countryName: '', participantIds: [] });
    } catch (err) {
      setError(err.message || 'Failed to generate proposal');
    } finally {
      setGenerating(false);
    }
  }

  function getFlagEmoji(code) {
    if (!code || code.length !== 2) return '🌍';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  }

  function toggleParticipant(id) {
    setForm(prev => ({
      ...prev,
      participantIds: prev.participantIds.includes(id)
        ? prev.participantIds.filter(x => x !== id)
        : [...prev.participantIds, id]
    }));
  }

  return (
    <Layout>
      <div className="proposals-page">
        <div className="page-header">
          <div>
            <h1>🗺️ Trip Proposals</h1>
            <p className="page-subtitle">AI-crafted itineraries for your group</p>
          </div>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            + New Proposal
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {showNew && (
          <div className="modal-overlay" onClick={() => setShowNew(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Generate AI Trip Proposal</h2>
              <p className="modal-subtitle">Claude will create a custom itinerary based on your group's travel profiles</p>

              <div className="form-group">
                <label>Destination Country</label>
                {!form.countryName ? (
                  <CountryPicker
                    onSelect={({ countryCode, countryName }) =>
                      setForm(prev => ({ ...prev, countryCode, countryName }))
                    }
                    mode="single"
                    title="Choose destination"
                    placeholder="Filter countries..."
                  />
                ) : (
                  <div className="selected-country">
                    <span>{getFlagEmoji(form.countryCode)} {form.countryName}</span>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, countryCode: '', countryName: '' }))}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              {friends.length > 0 && (
                <div className="form-group">
                  <label>Include Friends (optional)</label>
                  <div className="friend-selector">
                    {friends.map(f => (
                      <button
                        key={f.id}
                        className={`friend-toggle ${form.participantIds.includes(f.id) ? 'selected' : ''}`}
                        onClick={() => toggleParticipant(f.id)}
                        type="button"
                      >
                        {f.displayName || f.username}
                        {form.participantIds.includes(f.id) && ' ✓'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowNew(false)}>Cancel</button>
                <button className="btn-primary" onClick={generateProposal} disabled={generating}>
                  {generating ? '✨ Claude is planning...' : '✨ Generate with AI'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="loading-state">Loading proposals...</div>}

        {!loading && proposals.length === 0 && (
          <div className="empty-state">
            <p className="empty-icon">🗺️</p>
            <h3>No proposals yet</h3>
            <p>Generate your first AI trip proposal and share it with friends</p>
            <button className="btn-primary" onClick={() => setShowNew(true)}>Create First Proposal</button>
          </div>
        )}

        <div className="proposals-layout">
          {proposals.length > 0 && (
            <div className="proposals-list">
              {proposals.map(p => (
                <div
                  key={p.id}
                  className={`proposal-card ${selectedProposal?.id === p.id ? 'selected' : ''}`}
                  onClick={() => setSelectedProposal(p)}
                >
                  <div className="proposal-card-header">
                    <span className="proposal-flag">{getFlagEmoji(p.country_code)}</span>
                    <div>
                      <h3>{p.title || p.country_name}</h3>
                      <p className="proposal-country">{p.country_name}</p>
                    </div>
                  </div>
                  {p.tagline && <p className="proposal-tagline">{p.tagline}</p>}
                  <div className="proposal-meta">
                    <span className="mood-tag">{p.mood}</span>
                    {p.duration && <span className="duration-tag">⏱ {p.duration}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedProposal && (
            <div className="proposal-detail">
              <div className="proposal-detail-header">
                <span className="proposal-detail-flag">{getFlagEmoji(selectedProposal.country_code)}</span>
                <div>
                  <h2>{selectedProposal.title}</h2>
                  <p className="proposal-detail-country">{selectedProposal.country_name}</p>
                </div>
              </div>

              {selectedProposal.tagline && (
                <p className="proposal-detail-tagline">"{selectedProposal.tagline}"</p>
              )}

              <div className="proposal-tags">
                {selectedProposal.mood && <span className="tag mood">{selectedProposal.mood}</span>}
                {selectedProposal.duration && <span className="tag">{selectedProposal.duration}</span>}
                {selectedProposal.best_time_to_go && <span className="tag">📅 {selectedProposal.best_time_to_go}</span>}
              </div>

              {selectedProposal.itinerary && (
                <div className="proposal-section">
                  <h3>✈️ The Trip</h3>
                  <p className="proposal-itinerary">{selectedProposal.itinerary}</p>
                </div>
              )}

              {selectedProposal.activities && selectedProposal.activities.length > 0 && (
                <div className="proposal-section">
                  <h3>🎯 Key Activities</h3>
                  <ul className="activities-list">
                    {selectedProposal.activities.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedProposal.group_tip && (
                <div className="proposal-tip">
                  <span>💡 Group tip: </span>{selectedProposal.group_tip}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
