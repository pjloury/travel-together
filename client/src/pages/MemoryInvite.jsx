// MemoryInvite — landing page for shareable memory invite URLs.
// Visited at /m/:token after someone texts the URL minted via the
// MemoryDetail "Copy invite link" button.
//
// Behavior:
//   - Logged in: claim the token immediately via POST
//     /api/pins/invite-token/:token/claim, then redirect to the
//     memory's owner profile (or home if we don't have the pin).
//   - Logged out: bounce to /login?redirect=/m/:token so we come
//     back here after auth and complete the claim.

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function MemoryInvite() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'err'
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Bounce through login, return here, then claim.
      navigate(`/login?redirect=${encodeURIComponent(`/m/${token}`)}`, { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post(`/pins/invite-token/${token}/claim`);
        if (cancelled) return;
        setStatus('ok');
        // Brief pause so the user reads the success message, then
        // redirect to home — simplest path that lands them in-app.
        setTimeout(() => navigate('/', { replace: true }), 1200);
      } catch (err) {
        if (cancelled) return;
        setStatus('err');
        setError(err.message || 'Could not accept this invite');
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user, token, navigate]);

  return (
    <div className="memory-invite-page">
      <div className="memory-invite-card">
        {status === 'loading' && (
          <>
            <div className="loading-spinner-sm" />
            <p className="memory-invite-msg">Joining the memory…</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <p className="memory-invite-emoji">✨</p>
            <h2 className="memory-invite-title">You&rsquo;re in!</h2>
            <p className="memory-invite-msg">
              You&rsquo;ve been added to this memory. Taking you to your home…
            </p>
          </>
        )}
        {status === 'err' && (
          <>
            <p className="memory-invite-emoji">😕</p>
            <h2 className="memory-invite-title">Hmm</h2>
            <p className="memory-invite-msg">{error}</p>
            <Link className="memory-invite-link" to="/">Back to home</Link>
          </>
        )}
      </div>
    </div>
  );
}
