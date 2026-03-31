import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [pending, setPending] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [sentRequests, setSentRequests] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        api.get('/friends'),
        api.get('/friends/pending')
      ]);
      setFriends(friendsRes.data || []);
      setPending(pendingRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await api.get(`/search/users?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data || response || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function sendRequest(userId) {
    try {
      await api.post('/friends/request', { userId });
      setSentRequests(new Set([...sentRequests, userId]));
    } catch (err) {
      setError(err.message);
    }
  }

  async function acceptRequest(friendshipId) {
    try {
      await api.post(`/friends/accept/${friendshipId}`);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function declineOrRemove(friendshipId) {
    try {
      await api.delete(`/friends/${friendshipId}`);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  function isAlreadyFriend(userId) {
    return friends.some(f => f.id === userId);
  }

  function hasPendingRequest(userId) {
    return pending.some(p => p.requestedBy?.id === userId);
  }

  if (loading) {
    return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div></Layout>;
  }

  return (
    <Layout>
      <div className="friends-page">

        {/* Header */}
        <div className="friends-header">
          <h1 className="friends-title">Friends</h1>
          <p className="friends-subtitle">Connect with fellow travelers</p>
        </div>

        {error && (
          <div className="friends-error">{error}</div>
        )}

        {/* Search */}
        <div className="friends-search-section">
          <h2 className="friends-section-title">Find Friends</h2>
          <div className="friends-search-bar">
            <input
              className="friends-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by name or username…"
            />
            <button className="friends-search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="friends-results">
              {searchResults.map(user => (
                <div key={user.id} className="friends-result-row">
                  <div className="friends-avatar-sm">
                    {user.avatarUrl
                      ? <img src={user.avatarUrl} alt={user.displayName} />
                      : <span>{(user.displayName || user.username || '?').charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="friends-result-info">
                    <span className="friends-result-name">{user.displayName}</span>
                    {user.username && <span className="friends-result-handle">@{user.username}</span>}
                  </div>
                  {isAlreadyFriend(user.id) ? (
                    <span className="friends-badge friends-badge-connected">Connected</span>
                  ) : hasPendingRequest(user.id) ? (
                    <span className="friends-badge friends-badge-pending">Pending</span>
                  ) : sentRequests.has(user.id) ? (
                    <span className="friends-badge friends-badge-sent">Sent</span>
                  ) : (
                    <button className="friends-add-btn" onClick={() => sendRequest(user.id)}>
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Requests */}
        {pending.length > 0 && (
          <div className="friends-section">
            <h2 className="friends-section-title">
              Requests
              <span className="friends-count-badge">{pending.length}</span>
            </h2>
            <div className="friends-list">
              {pending.map(request => (
                <div key={request.id} className="friends-pending-row">
                  <div className="friends-avatar-sm">
                    <span>{(request.requestedBy?.displayName || '?').charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="friends-result-info">
                    <span className="friends-result-name">{request.requestedBy?.displayName}</span>
                    {request.requestedBy?.username && (
                      <span className="friends-result-handle">@{request.requestedBy.username}</span>
                    )}
                  </div>
                  <div className="friends-pending-actions">
                    <button className="friends-accept-btn" onClick={() => acceptRequest(request.id)}>
                      Accept
                    </button>
                    <button className="friends-decline-btn" onClick={() => declineOrRemove(request.id)}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="friends-section">
          <h2 className="friends-section-title">
            Your Friends
            {friends.length > 0 && <span className="friends-count-badge">{friends.length}</span>}
          </h2>
          {friends.length === 0 ? (
            <div className="friends-empty">
              <p>No friends yet.</p>
              <p>Search for people to connect with above.</p>
            </div>
          ) : (
            <div className="friends-grid">
              {friends.map(friend => (
                <Link key={friend.id} to={`/user/${friend.id}`} className="friends-card">
                  <div className="friends-card-avatar">
                    {friend.avatarUrl
                      ? <img src={friend.avatarUrl} alt={friend.displayName} />
                      : <span>{(friend.displayName || '?').charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="friends-card-info">
                    <span className="friends-card-name">{friend.displayName}</span>
                    {friend.username && (
                      <span className="friends-card-handle">@{friend.username}</span>
                    )}
                    <span className="friends-card-stats">
                      {friend.memoryCount || 0} memories · {friend.dreamCount || 0} dreams
                    </span>
                  </div>
                  <button
                    className="friends-remove-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm('Remove this friend?')) {
                        declineOrRemove(friend.friendshipId);
                      }
                    }}
                    title="Remove friend"
                  >
                    ×
                  </button>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
