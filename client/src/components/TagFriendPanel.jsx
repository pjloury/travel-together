// TagFriendPanel — shared "tag a friend" inline picker for Memory and Dream detail views.
//
// Props:
//   pinId          string  — the pin to tag friends on
//   companions     string[] — current companion labels already on the pin
//   pinType        'memory' | 'dream' — drives which invite email is sent
//   onCompanionsChange(newList) — called after a user is tagged
//   open           bool   — controlled: whether the expanded picker is shown
//   onOpen()       — parent should call setShowTagFriend(true)
//   onClose()      — parent should call setShowTagFriend(false) / reset
//   readOnly       bool   — if true renders nothing

import { useState, useEffect, useRef } from 'react';
import useDropdownKeyboard from '../hooks/useDropdownKeyboard';
import api from '../api/client';

export default function TagFriendPanel({
  pinId, companions = [], pinType = 'memory',
  onCompanionsChange, open, onOpen, onClose, readOnly,
}) {
  const [query, setQuery]             = useState('');
  const [results, setResults]         = useState([]);
  const [searching, setSearching]     = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [flash, setFlash]             = useState(null);
  const [pendingTags, setPendingTags] = useState([]);
  const [inviteUrl, setInviteUrl]     = useState('');
  const [inviteUrlCopied, setInviteUrlCopied] = useState(false);
  const [inviteSending, setInviteSending]     = useState(false);
  const debounceRef = useRef(null);
  const inputRef    = useRef(null);

  const kb = useDropdownKeyboard(results.length, () => {}, () => {});

  // Reset when panel closes
  useEffect(() => {
    if (!open) {
      setQuery(''); setResults([]); setInviteEmail(''); setFlash(null);
      setInviteUrl(''); setInviteUrlCopied(false);
    }
  }, [open]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Debounced user search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(debounceRef.current);
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(query.trim())}`);
        setResults(res.data || []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
  }, [query]);

  // Flash auto-clear
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 3000);
    return () => clearTimeout(t);
  }, [flash]);

  // Fetch pending tags when opened
  useEffect(() => {
    if (!open || !pinId) { setPendingTags([]); return; }
    let cancelled = false;
    api.get(`/pins/${pinId}/pending-tags`)
      .then(r => { if (!cancelled) setPendingTags(r.data?.pendingTags || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, pinId]);

  const noResults       = query.trim().length > 1 && !searching && results.length === 0;
  const looksLikeEmail  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  const inviteEmailPrefill = inviteEmail || (looksLikeEmail ? query.trim() : '');
  const inviteEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmailPrefill.trim());

  // Auto-seed invite email from query when no results and query looks like email
  useEffect(() => {
    if (noResults && looksLikeEmail && !inviteEmail) setInviteEmail(query.trim());
  }, [query, searching, noResults, looksLikeEmail, inviteEmail]);

  function refreshPendingTags() {
    if (!pinId) return;
    api.get(`/pins/${pinId}/pending-tags`)
      .then(r => setPendingTags(r.data?.pendingTags || []))
      .catch(() => {});
  }

  async function handleSelect(user) {
    const label = user.display_name || user.username;
    if (companions.includes(label)) {
      setFlash({ kind: 'already', name: label });
      setQuery(''); setResults([]);
      return;
    }
    const updated = [...companions, label];
    try {
      await api.put(`/pins/${pinId}`, { companions: updated });
      if (onCompanionsChange) onCompanionsChange(updated);
      setFlash({ kind: 'tagged', name: label });
      if (pinType === 'memory') {
        const friendId = user.userId || user.id;
        if (friendId) api.post(`/pins/${pinId}/share`, { targetUserId: friendId }).catch(() => {});
      }
    } catch { /* silent */ }
    setQuery(''); setResults([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleInvite() {
    const email = inviteEmailPrefill.trim();
    if (!email) return;
    setInviteSending(true);
    try {
      if (pinType === 'dream') {
        await api.post('/invites/dream-companion', { email, pinId });
        await api.post(`/pins/${pinId}/pending-tags`, { email, label: query.trim() }).catch(() => {});
      } else {
        await api.post(`/pins/${pinId}/pending-tags`, { email, label: query.trim() }).catch(() => {});
        await api.post('/invites/send', { email }).catch(() => {});
      }
    } catch { /* non-fatal */ }
    finally { setInviteSending(false); }
    refreshPendingTags();
    setFlash({ kind: 'invited', email });
    setQuery(''); setResults([]); setInviteEmail('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleResend(tagId, email) {
    try {
      await api.post(`/pins/pending-tags/${tagId}/resend`);
      if (email) await api.post('/invites/send', { email }).catch(() => {});
      setFlash({ kind: 'invited', email });
      refreshPendingTags();
    } catch {}
  }

  async function handleCancelTag(tagId) {
    try {
      await api.delete(`/pins/pending-tags/${tagId}`);
      setPendingTags(prev => prev.filter(p => p.id !== tagId));
    } catch {}
  }

  async function handleCopyInviteUrl() {
    setInviteUrlCopied(false);
    try {
      let token;
      const existing = pendingTags.find(p => p.token && !p.email);
      if (existing) {
        token = existing.token;
      } else {
        const res = await api.post(`/pins/${pinId}/invite-token`);
        token = res.data?.token;
        refreshPendingTags();
      }
      if (!token) return;
      const url = `${window.location.origin}/m/${token}`;
      setInviteUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        setInviteUrlCopied(true);
        setTimeout(() => setInviteUrlCopied(false), 2500);
      } catch {}
    } catch {}
  }

  if (readOnly) return null;

  if (!open) {
    return (
      <div className="md-tag-friend-row">
        <button type="button" className="md-tag-friend-btn" onClick={onOpen}>
          👤 Tag a friend
        </button>
      </div>
    );
  }

  return (
    <div className="md-tf-wrap">
      <div className="md-tf-header">
        <span className="md-tf-title">Tag friends</span>
        <button type="button" className="md-tf-close-btn" onClick={onClose}>Done</button>
      </div>

      <div className="md-tf-share-row">
        <button type="button" className="md-tf-share-btn" onClick={handleCopyInviteUrl}
          title="Copy a shareable invite link">
          {inviteUrlCopied ? '✓ Link copied' : '🔗 Copy invite link'}
        </button>
        {inviteUrl && !inviteUrlCopied && (
          <input type="text" className="md-tf-share-url" readOnly value={inviteUrl}
            onFocus={e => e.target.select()} />
        )}
      </div>

      {pendingTags.length > 0 && (
        <div className="md-tf-pending">
          <p className="md-tf-pending-title">Pending invites</p>
          {pendingTags.map(p => (
            <div key={p.id} className="md-tf-pending-row">
              <span className="md-tf-pending-label">
                {p.email
                  ? <>📧 {p.label || p.email}{p.label && <span className="md-tf-pending-sub"> · {p.email}</span>}</>
                  : <>🔗 Shareable link · {p.sendCount} {p.sendCount === 1 ? 'view' : 'views'}</>
                }
              </span>
              <span className="md-tf-pending-actions">
                {p.email && (
                  <button type="button" className="md-tf-pending-btn"
                    onClick={() => handleResend(p.id, p.email)}>Resend</button>
                )}
                <button type="button" className="md-tf-pending-btn md-tf-pending-cancel"
                  onClick={() => handleCancelTag(p.id)} title="Cancel">×</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {flash && (
        <div className={`md-tf-flash md-tf-flash-${flash.kind}`}>
          {flash.kind === 'tagged'  && <>✓ Tagged <strong>{flash.name}</strong> — add another below</>}
          {flash.kind === 'already' && <><strong>{flash.name}</strong> is already tagged</>}
          {flash.kind === 'invited' && <>✓ Invite sent to <strong>{flash.email}</strong></>}
        </div>
      )}

      <div className="md-tf-search-wrap">
        <input
          ref={inputRef}
          type="text"
          className="md-tf-input"
          placeholder="Search by name or username…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              kb.handleKeyDown(e);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              const idx = kb.highlightedIndex >= 0 ? kb.highlightedIndex : 0;
              if (results[idx]) handleSelect(results[idx]);
            } else if (e.key === 'Escape') {
              e.nativeEvent?.stopImmediatePropagation();
              onClose();
            }
          }}
        />

        {query.trim().length > 0 && (
          <div className="md-tf-dropdown">
            {searching && <div className="md-tf-searching">Searching…</div>}
            {!searching && results.map((user, i) => (
              <div
                key={user.id}
                className={`md-tf-result${i === kb.highlightedIndex ? ' md-tf-result-highlighted' : ''}`}
                onMouseEnter={() => kb.setHighlightedIndex(i)}
                onClick={() => handleSelect(user)}
              >
                <div className="md-tf-avatar">
                  {user.avatar_url
                    ? <img src={user.avatar_url} alt={user.display_name} />
                    : (user.display_name || user.username || '?')[0].toUpperCase()
                  }
                </div>
                <div>
                  <div className="md-tf-name">{user.display_name || user.username}</div>
                  {user.username && <div className="md-tf-username">@{user.username}</div>}
                </div>
              </div>
            ))}
            {noResults && (
              <div className="md-tf-no-results">
                No users found for &ldquo;{query}&rdquo;
              </div>
            )}
          </div>
        )}

        {noResults && (
          <div className="md-tf-invite-prompt">
            <p className="md-tf-invite-label">
              <strong>{query}</strong> isn&rsquo;t on Travel Together yet.
              Send them an invite to view your profile and join.
            </p>
            <div className="md-tf-invite-row">
              <input
                type="email"
                className="md-tf-email-input"
                placeholder="their@email.com"
                value={inviteEmailPrefill}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleInvite(); }}
              />
              <button
                type="button"
                className="md-tf-send-btn"
                onClick={handleInvite}
                disabled={inviteSending || !inviteEmailIsValid}
              >
                {inviteSending ? 'Sending…' : 'Invite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
