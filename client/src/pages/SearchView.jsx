// SearchView page - user search with real-time results.
//
// Spec: docs/app/spec.md Section 4, GET /api/search/users
// @implements REQ-NAV-005, SCN-NAV-005-01

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

/**
 * SearchView provides user search with real-time results.
 *
 * @implements REQ-NAV-005 (global search by display name/username)
 * @implements SCN-NAV-005-01 (user cards; non-friends see Top 8 only)
 *
 * - Search input (autofocus on open)
 * - Real-time search as user types (debounced 300ms, min 2 chars)
 * - Results: user cards showing avatar, display name, memory/dream counts,
 *   top tag emojis, "Friends" badge or "Add Friend" button
 * - Tap a user card -> navigate to /user/:userId
 */
export default function SearchView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [friendRequestsSent, setFriendRequestsSent] = useState(new Set());
  const debounceRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`/search/users?q=${encodeURIComponent(query.trim())}`);
        setResults(response.data || []);
        setSearched(true);
      } catch {
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleAddFriend(userId, e) {
    e.stopPropagation();
    try {
      await api.post('/friends/request', { userId });
      setFriendRequestsSent(new Set([...friendRequestsSent, userId]));
    } catch {
      // Silently fail
    }
  }

  function handleUserClick(userId) {
    navigate(`/user/${userId}`);
  }

  return (
    <Layout>
      <div className="search-view">
        <div className="search-input-container">
          <input
            type="text"
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or username..."
            autoFocus
          />
        </div>

        {loading && <div className="search-loading">Searching...</div>}

        {!loading && searched && results.length === 0 && (
          <div className="search-no-results">
            <p>No users found for "{query}"</p>
          </div>
        )}

        <div className="search-results-list">
          {results.map(user => (
            <div
              key={user.id}
              className="search-user-card"
              onClick={() => handleUserClick(user.id)}
              role="button"
              tabIndex={0}
            >
              <div className="search-user-avatar">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName} className="search-avatar-img" />
                ) : (
                  <div className="search-avatar-placeholder">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="search-user-info">
                <span className="search-display-name">{user.displayName}</span>
                <span className="search-username">@{user.username}</span>
                <div className="search-user-counts">
                  <span>{user.memoryCount || 0} memories</span>
                  <span>&middot;</span>
                  <span>{user.dreamCount || 0} dreams</span>
                </div>
                {user.topTags && user.topTags.length > 0 && (
                  <div className="search-user-tags">
                    {user.topTags.map((tag, i) => (
                      <span key={i} className="search-tag-emoji">{tag.emoji}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="search-user-action">
                {user.isFriend ? (
                  <span className="search-friend-badge">Friends</span>
                ) : friendRequestsSent.has(user.id) ? (
                  <span className="search-request-sent">Request Sent</span>
                ) : (
                  <button
                    className="search-add-friend-btn"
                    onClick={(e) => handleAddFriend(user.id, e)}
                  >
                    Add Friend
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
