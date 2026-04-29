import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const { login, loginWithGoogle, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

  // Already authenticated — skip straight into the app
  useEffect(() => {
    if (user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, navigate, redirectTo]);

  // Track whether this Login instance is still mounted. The GSI prompt
  // callback can fire asynchronously after the user has navigated away
  // (e.g. tapped "Create one" to go to /register while the silent prompt
  // was still pending). Without this guard we'd call setState + navigate
  // from an unmounted component.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleGoogleResponse = useCallback(async (response) => {
    if (!mountedRef.current) return;
    setGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(response.credential);
      if (mountedRef.current) navigate(redirectTo);
    } catch (err) {
      if (mountedRef.current) setError(err.message || 'Google sign-in failed');
    } finally {
      if (mountedRef.current) setGoogleLoading(false);
    }
  }, [loginWithGoogle, navigate, redirectTo]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    // If the user previously signed in with Google, auto-trigger One Tap
    // so they're dropped straight into the app without having to click
    // "Continue as <email>". The flag is set in AuthContext.loginWithGoogle
    // and cleared on logout. (Most returning users skip this page entirely
    // because the 90-day JWT in localStorage hydrates AuthContext before
    // /login mounts — this auto-prompt only matters after explicit logout
    // or token expiry.)
    const hasPriorGoogleSignIn = localStorage.getItem('lastGoogleSignIn') === '1';
    if (hasPriorGoogleSignIn) {
      setGoogleLoading(true);
    }

    // Idempotent script load — avoid stacking <script> tags when the
    // user navigates back and forth between /login and /register.
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    let script;
    let promptFallbackTimer;

    function initOnLoad() {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: hasPriorGoogleSignIn,
        // FedCM is Google's modern, cookie-less One-Tap path. Without
        // this, Safari / Brave / Chrome-with-strict-tracking block the
        // legacy 3rd-party cookie path and prompt() silently no-ops,
        // leaving the user staring at a "Continue as <name>" button.
        // With FedCM the browser shows a native chooser and silent
        // re-auth actually works.
        use_fedcm_for_prompt: true,
      });
      setGsiReady(true);
      if (!hasPriorGoogleSignIn) return;

      try {
        window.google?.accounts.id.prompt((notification) => {
          const skipped = notification?.isNotDisplayed?.() ||
                          notification?.isSkippedMoment?.();
          if (skipped && mountedRef.current) {
            // One Tap couldn't fire silently — show the form/button.
            setGoogleLoading(false);
          }
        });
        // Belt-and-suspenders: if Google never invokes the notification
        // callback (some FedCM paths just hang), fall back to showing
        // the form after 4s rather than spinning forever.
        promptFallbackTimer = setTimeout(() => {
          if (mountedRef.current) setGoogleLoading(false);
        }, 4000);
      } catch {
        if (mountedRef.current) setGoogleLoading(false);
      }
    }

    if (existing && window.google?.accounts?.id) {
      // Script already loaded from a prior mount — initialize directly.
      initOnLoad();
    } else if (existing) {
      // Script tag exists but library not ready yet — wait for its load.
      existing.addEventListener('load', initOnLoad, { once: true });
    } else {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      script.onload = initOnLoad;
    }

    return () => {
      if (promptFallbackTimer) clearTimeout(promptFallbackTimer);
      // Don't remove the script tag — leaving it cached avoids a fresh
      // network round-trip on next mount.
    };
  }, [handleGoogleResponse]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(redirectTo);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Render the "Continue with Google" button into its container whenever
  // the container is mounted and Google's GSI script is loaded. This
  // runs independently of the script-load effect so that it also fires
  // after a failed auto-sign-in (when the form is revealed and the
  // container appears in the DOM for the first time).
  //
  // We used to also synthesize a .click() on the rendered button via
  // querySelector('[role="button"]') for returning users. That was a
  // hack: cross-origin GSI iframes block synthetic clicks in most
  // browsers, it relied on Google's internal DOM structure, and when
  // it DID work it raced with One Tap's silent prompt() callback,
  // causing a double POST to /api/auth/google. Removed in favor of
  // trusting the 90-day JWT (returning users skip /login entirely via
  // AuthProvider.fetchUser) + One Tap with FedCM on browsers that
  // support it. On older browsers where neither works, the user just
  // taps the button — same as any other Google sign-in flow.
  useEffect(() => {
    if (!gsiReady || googleLoading) return;
    const container = document.getElementById('google-signin-btn');
    if (!container || container.childElementCount > 0) return;
    try {
      window.google?.accounts.id.renderButton(container, {
        theme: 'filled_black', size: 'large', width: '100%', text: 'continue_with',
      });
    } catch { /* noop */ }
  }, [gsiReady, googleLoading]);

  // While checking if we already have a session, don't flash the login form.
  // Also suppress the form while we're auto-signing a returning Google user
  // back in — the prompt callback will either redirect them or set
  // googleLoading back to false and let the form render.
  const autoSigningIn = googleLoading && typeof window !== 'undefined' &&
    localStorage.getItem('lastGoogleSignIn') === '1';
  if (authLoading || user || autoSigningIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner-sm" />
      </div>
    );
  }

  return (
    <div className="lp-root">

      {/* Full-bleed photo background */}
      <div className="lp-bg" aria-hidden="true">
        <img src="/hero-bg.jpg" alt="" className="lp-bg-img" />
        <div className="lp-bg-gradient" />
      </div>

      {/* Wordmark top-left */}
      <div className="lp-wordmark">Travel Together</div>

      {/* Center hero text */}
      <div className="lp-hero">
        <h1 className="lp-tagline">travel the world</h1>
        <p className="lp-sub">Capture where you've been. Dream of where you're going.</p>
        <div className="lp-value-props">
          <span className="lp-value-prop">🌍 Pin your travel memories</span>
          <span className="lp-value-prop">✨ Dream of where to go next</span>
          <span className="lp-value-prop">🤝 Share with friends</span>
          <span className="lp-value-prop">📷 Beautiful travel photography</span>
        </div>
      </div>

      {/* Auth card */}
      <div className="lp-card">
        <h2 className="lp-card-title">Sign in</h2>

        {error && <div className="lp-error">{error}</div>}

        {GOOGLE_CLIENT_ID && (
          <>
            <div id="google-signin-btn" className="lp-google-btn" />
            {googleLoading && <p className="lp-loading">Signing in with Google…</p>}
            <div className="lp-divider"><span>or</span></div>
          </>
        )}

        <form onSubmit={handleSubmit} className="lp-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading} className="lp-submit">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="lp-links">
          No account? <Link to="/register">Create one</Link>
          &ensp;·&ensp;
          <Link to="/forgot-password">Forgot password</Link>
        </p>
        <Link to="/discover" className="lp-browse-link">Browse trips first →</Link>
      </div>

      {/* Photo attribution */}
      <p className="lp-attribution">
        Photo: Anna Tsolidou, CC BY-SA 4.0 via Wikimedia Commons
      </p>
    </div>
  );
}
