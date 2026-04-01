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
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';

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
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
      });
      window.google?.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        { theme: 'filled_black', size: 'large', width: '100%', text: 'continue_with' }
      );
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
