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

  // Suggestions
  const [suggestions, setSuggestions] = useState([]);

  // Invite state
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState('');

  useEffect(() => {
    fetchData();
    fetchSuggestions();
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

  async function fetchSuggestions() {
    try {
      const res = await api.get('/search/suggestions');
      setSuggestions(res.data || []);
    } catch { /* silent */ }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    try {
      const response = await api.get(`/search/users?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data || response || []);
    } catch (err) { setError(err.message); }
  }

  async function sendRequest(userId) {
    try {
      await api.post('/friends/request', { userId });
      setSentRequests(new Set([...sentRequests, userId]));
    } catch (err) { setError(err.message); }
  }

  async function acceptRequest(friendshipId) {
    try { await api.post(`/friends/accept/${friendshipId}`); fetchData(); }
    catch (err) { setError(err.message); }
  }

  async function declineOrRemove(friendshipId) {
    try { await api.delete(`/friends/${friendshipId}`); fetchData(); }
    catch (err) { setError(err.message); }
  }

  function isAlreadyFriend(userId) { return friends.some(f => f.id === userId); }
  function hasPendingRequest(userId) { return pending.some(p => p.requestedBy?.id === userId); }

  // Invite helpers
  async function handleGenerateLink() {
    try {
      const res = await api.post('/invites/link');
      setInviteLink(res.link || res.data?.link || '');
    } catch { setError('Could not generate invite link'); }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* fallback */ }
  }

  async function handleSendEmailInvites() {
    const emails = inviteEmails.split(/[,;\n]+/).map(e => e.trim()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!emails.length) { setInviteResult('Enter at least one valid email.'); return; }
    setSendingInvites(true); setInviteResult('');
    try {
      const res = await api.post('/invites/send', { emails });
      const results = res.results || res.data?.results || [];
      const sent = results.filter(r => r.sent).length;
      setInviteResult(`${sent} invitation${sent !== 1 ? 's' : ''} sent`);
      if (sent > 0) setInviteEmails('');
    } catch { setInviteResult('Could not send. Try again.'); }
    finally { setSendingInvites(false); }
  }

  if (loading) {
    return <Layout><div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div></Layout>;
  }

  return (
    <Layout>
      <div className="friends-page">
        <div className="friends-header">
          <h1 className="friends-title">Friends</h1>
          <p className="friends-subtitle">Connect with fellow travelers</p>
        </div>

        {error && <div className="friends-error">{error}</div>}

        {/* ── Pending Requests (urgent) ── */}
        {pending.length > 0 && (
          <div className="friends-section">
            <h2 className="friends-section-title">
              Requests <span className="friends-count-badge">{pending.length}</span>
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
                    <button className="friends-accept-btn" onClick={() => acceptRequest(request.id)}>Accept</button>
                    <button className="friends-decline-btn" onClick={() => declineOrRemove(request.id)}>Decline</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Your Friends (main content) ── */}
        <div className="friends-section">
          <h2 className="friends-section-title">
            Your Friends
            {friends.length > 0 && <span className="friends-count-badge">{friends.length}</span>}
          </h2>
          {friends.length === 0 ? (
            <div className="friends-empty">
              <p>No friends yet — invite your travel buddies or search below.</p>
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
                    {friend.username && <span className="friends-card-handle">@{friend.username}</span>}
                    <span className="friends-card-stats">
                      {friend.memoryCount || 0} memories · {friend.dreamCount || 0} dreams
                    </span>
                  </div>
                  <button
                    className="friends-remove-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.confirm('Remove this friend?')) declineOrRemove(friend.friendshipId);
                    }}
                    title="Remove friend"
                  >×</button>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── People You May Know ── */}
        {suggestions.length > 0 && (
          <div className="friends-section">
            <h2 className="friends-section-title">People you may know</h2>
            <div className="friends-results">
              {suggestions.map(user => {
                const uid = user.userId || user.id;
                return (
                  <div key={uid} className="friends-result-row">
                    <div className="friends-avatar-sm">
                      {user.avatarUrl
                        ? <img src={user.avatarUrl} alt={user.displayName} />
                        : <span>{(user.displayName || '?').charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div className="friends-result-info">
                      <span className="friends-result-name">{user.displayName}</span>
                      {user.username && <span className="friends-result-handle">@{user.username}</span>}
                      <span className="friends-result-stats">
                        {user.memoryCount} memories · {user.dreamCount} dreams
                      </span>
                    </div>
                    {sentRequests.has(uid) ? (
                      <span className="friends-badge friends-badge-sent">Sent</span>
                    ) : (
                      <button className="friends-add-btn" onClick={() => {
                        sendRequest(uid);
                        setSuggestions(prev => prev.filter(s => (s.userId || s.id) !== uid));
                      }}>Add</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Find Friends ── */}
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
            <button className="friends-search-btn" onClick={handleSearch}>Search</button>
          </div>
          {searchResults.length > 0 && (
            <div className="friends-results">
              {searchResults.map(user => {
                const uid = user.userId || user.id;
                return (
                  <div key={uid} className="friends-result-row">
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
                    {user.isFriend || isAlreadyFriend(uid) ? (
                      <span className="friends-badge friends-badge-connected">Connected</span>
                    ) : hasPendingRequest(uid) ? (
                      <span className="friends-badge friends-badge-pending">Pending</span>
                    ) : sentRequests.has(uid) ? (
                      <span className="friends-badge friends-badge-sent">Sent</span>
                    ) : (
                      <button className="friends-add-btn" onClick={() => sendRequest(uid)}>Add</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Invite Friends (bottom) ── */}
        <div className="friends-section invite-section">
          <h2 className="friends-section-title">Invite Friends</h2>
          <div className="invite-block">
            <p className="invite-label">Share a link</p>
            {!inviteLink ? (
              <button className="invite-generate-btn" onClick={handleGenerateLink}>Generate invite link</button>
            ) : (
              <div className="invite-link-row">
                <input className="invite-link-text" value={inviteLink} readOnly onClick={e => e.target.select()} />
                <button className="invite-copy-btn" onClick={handleCopyLink}>{linkCopied ? '✓ Copied' : 'Copy'}</button>
                {navigator.share && (
                  <button className="invite-share-btn" onClick={() => navigator.share({ title: 'Join me on Travel Together', url: inviteLink }).catch(() => {})}>Share</button>
                )}
              </div>
            )}
          </div>
          <div className="invite-block">
            <p className="invite-label">Send email invitations</p>
            <textarea
              className="invite-email-input"
              placeholder="friend@email.com, another@email.com"
              value={inviteEmails}
              onChange={e => setInviteEmails(e.target.value)}
              rows={2}
            />
            <button className="invite-send-btn" onClick={handleSendEmailInvites} disabled={sendingInvites || !inviteEmails.trim()}>
              {sendingInvites ? 'Sending…' : 'Send invitations'}
            </button>
            {inviteResult && <p className="invite-result">{inviteResult}</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
