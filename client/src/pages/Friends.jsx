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
      setFriends(friendsRes.data);
      setPending(pendingRes.data);
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
      const response = await api.get(`/users/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data);
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
    return pending.some(p => p.requesterId === userId);
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Friends</h1>
        <p className="subtitle">Connect with fellow travelers</p>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Search Section */}
      <div className="search-section">
        <h3>Find Friends</h3>
        <div className="search-bar">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by username..."
          />
          <button onClick={handleSearch}>Search</button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-info">
                  <span className="display-name">{user.displayName}</span>
                  <span className="username">@{user.username}</span>
                </div>
                {isAlreadyFriend(user.id) ? (
                  <span className="status-badge friend">Friends</span>
                ) : hasPendingRequest(user.id) ? (
                  <span className="status-badge pending">Pending</span>
                ) : sentRequests.has(user.id) ? (
                  <span className="status-badge sent">Request Sent</span>
                ) : (
                  <button 
                    className="add-friend-btn"
                    onClick={() => sendRequest(user.id)}
                  >
                    Add Friend
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Requests */}
      {pending.length > 0 && (
        <div className="section pending-section">
          <h3>Pending Requests ({pending.length})</h3>
          <div className="pending-list">
            {pending.map(request => (
              <div key={request.id} className="pending-card">
                <div className="user-info">
                  <span className="display-name">{request.requesterName}</span>
                  <span className="username">@{request.requesterUsername}</span>
                </div>
                <div className="actions">
                  <button 
                    className="accept-btn"
                    onClick={() => acceptRequest(request.id)}
                  >
                    Accept
                  </button>
                  <button 
                    className="decline-btn"
                    onClick={() => declineOrRemove(request.id)}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Friends List */}
      <div className="section friends-section">
        <h3>Your Friends ({friends.length})</h3>
        {friends.length === 0 ? (
          <div className="empty-state">
            <p>No friends yet. Search for people to connect with!</p>
          </div>
        ) : (
          <div className="friends-grid">
            {friends.map(friend => (
              <Link 
                key={friend.id} 
                to={`/profile/${friend.id}`}
                className="friend-card"
              >
                <div className="friend-avatar">
                  {friend.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="friend-info">
                  <span className="display-name">{friend.displayName}</span>
                  <span className="username">@{friend.username}</span>
                  <span className="countries-count">
                    {friend.totalCountries || 0} countries
                  </span>
                </div>
                <button 
                  className="remove-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    if (confirm('Remove this friend?')) {
                      declineOrRemove(friend.friendshipId);
                    }
                  }}
                >
                  ×
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

