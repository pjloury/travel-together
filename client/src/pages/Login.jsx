import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

  const handleGoogleResponse = useCallback(async (response) => {
    setGoogleLoading(true);
    setError('');
    try {
      await loginWithGoogle(response.credential);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogle, navigate]);

  useEffect(() => {
    // Initialize Google Sign-In
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
        { 
          theme: 'filled_black', 
          size: 'large',
          width: '100%',
          text: 'continue_with'
        }
      );
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [handleGoogleResponse]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Travel Together</h1>
        <h2>Login</h2>
        
        {error && <div className="error">{error}</div>}

        {GOOGLE_CLIENT_ID && (
          <>
            <div id="google-signin-btn" className="google-btn-container"></div>
            {googleLoading && <p className="loading-text">Signing in with Google...</p>}
            <div className="divider">
              <span>or</span>
            </div>
          </>
        )}
        
        <form onSubmit={handleSubmit}>
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
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        <p>
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}

