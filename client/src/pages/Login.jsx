import { useState, useEffect, useCallback } from 'react';
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

  const handleGoogleResponse = useCallback(async (response) => {
    setGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(response.credential);
      navigate(redirectTo);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogle, navigate, redirectTo]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    // If the user previously signed in with Google, auto-trigger One Tap so
    // they're dropped straight into the app without having to click
    // "Continue as <email>". The flag is set in AuthContext.loginWithGoogle
    // and cleared on logout.
    const hasPriorGoogleSignIn = localStorage.getItem('lastGoogleSignIn') === '1';
    if (hasPriorGoogleSignIn) {
      setGoogleLoading(true);
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: hasPriorGoogleSignIn,
      });
      // Mark Google ready so the render-button effect can attach to the
      // container once it exists in the DOM (it's hidden while we attempt
      // a silent auto-sign-in for returning users).
      setGsiReady(true);
      // Show One Tap. With auto_select=true and a previously-used account,
      // Google will silently issue a credential and our callback will run,
      // sending the user straight into the app. If One Tap can't display
      // (third-party cookies blocked, no prior consent, etc.) we fall back
      // to the rendered "Continue with Google" button.
      if (hasPriorGoogleSignIn) {
        try {
          window.google?.accounts.id.prompt((notification) => {
            const skipped = notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.();
            if (skipped) setGoogleLoading(false);
          });
        } catch {
          setGoogleLoading(false);
        }
      }
    };
    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
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

  // Render the "Continue with Google" button into its container whenever the
  // container is mounted and Google's GSI script is loaded. This runs
  // independently of the script-load effect so that it also fires after a
  // failed auto-sign-in (when the form is revealed and the container appears
  // in the DOM for the first time).
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
