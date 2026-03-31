import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Destinations that float across the hero
const FLOATING_CARDS = [
  { emoji: '🗼', name: 'Paris',      delay: 0,    x: '12%',  y: '18%' },
  { emoji: '🌸', name: 'Kyoto',      delay: 0.6,  x: '72%',  y: '12%' },
  { emoji: '🏝', name: 'Maldives',   delay: 1.1,  x: '82%',  y: '42%' },
  { emoji: '🦁', name: 'Serengeti',  delay: 1.8,  x: '8%',   y: '62%' },
  { emoji: '🏔', name: 'Patagonia',  delay: 0.4,  x: '55%',  y: '78%' },
  { emoji: '🌊', name: 'Amalfi',     delay: 2.1,  x: '28%',  y: '88%' },
  { emoji: '🏜', name: 'Sahara',     delay: 1.4,  x: '62%',  y: '55%' },
  { emoji: '🎭', name: 'New York',   delay: 0.9,  x: '38%',  y: '8%'  },
];

// Value prop story beats
const STORY_BEATS = [
  { icon: '🎙', line: 'Speak your memories. AI captures the details.' },
  { icon: '✨', line: 'Pin every dream destination on your radar.' },
  { icon: '🌍', line: 'Your personal atlas, always growing.' },
];

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
    return () => { document.body.removeChild(script); };
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
    <div className="landing-root">

      {/* ── Left: Hero storytelling ── */}
      <div className="landing-hero">

        {/* Floating destination cards */}
        <div className="landing-float-layer" aria-hidden="true">
          {FLOATING_CARDS.map((card) => (
            <div
              key={card.name}
              className="landing-float-card"
              style={{
                left: card.x,
                top: card.y,
                '--delay': `${card.delay}s`,
                animationDelay: `${card.delay}s, ${card.delay + 0.7}s`,
              }}
            >
              <span className="landing-float-emoji">{card.emoji}</span>
              <span className="landing-float-name">{card.name}</span>
            </div>
          ))}
        </div>

        {/* Animated globe ring */}
        <div className="landing-globe-wrap" aria-hidden="true">
          <svg className="landing-globe-svg" viewBox="0 0 400 400" fill="none">
            <circle cx="200" cy="200" r="160" stroke="rgba(201,168,76,0.15)" strokeWidth="1" />
            <circle cx="200" cy="200" r="120" stroke="rgba(201,168,76,0.10)" strokeWidth="1" />
            <circle cx="200" cy="200" r="80"  stroke="rgba(201,168,76,0.07)" strokeWidth="1" />
            {/* Latitude lines */}
            <ellipse cx="200" cy="200" rx="160" ry="55" stroke="rgba(201,168,76,0.08)" strokeWidth="1" />
            <ellipse cx="200" cy="200" rx="160" ry="105" stroke="rgba(201,168,76,0.06)" strokeWidth="1" />
            {/* Meridian */}
            <ellipse cx="200" cy="200" rx="55" ry="160" stroke="rgba(201,168,76,0.08)" strokeWidth="1" />
            {/* Dots on globe */}
            <circle cx="200" cy="40"  r="3" fill="rgba(201,168,76,0.5)" />
            <circle cx="360" cy="200" r="3" fill="rgba(201,168,76,0.5)" />
            <circle cx="200" cy="360" r="3" fill="rgba(201,168,76,0.5)" />
            <circle cx="40"  cy="200" r="3" fill="rgba(201,168,76,0.5)" />
            <circle cx="310" cy="110" r="2" fill="rgba(201,168,76,0.3)" />
            <circle cx="140" cy="300" r="2" fill="rgba(201,168,76,0.3)" />
            <circle cx="290" cy="310" r="2" fill="rgba(201,168,76,0.3)" />
            <circle cx="100" cy="130" r="2" fill="rgba(201,168,76,0.3)" />
          </svg>
        </div>

        {/* Text content */}
        <div className="landing-hero-content">
          <div className="landing-wordmark landing-anim-1">
            Travel Together
          </div>

          <h1 className="landing-headline">
            <span className="landing-anim-2">Your world,</span>
            <br />
            <span className="landing-anim-3 landing-headline-gold">remembered.</span>
          </h1>

          <p className="landing-sub landing-anim-4">
            Capture where you&rsquo;ve been.<br />Dream of where you&rsquo;re going.
          </p>

          <div className="landing-beats">
            {STORY_BEATS.map((beat, i) => (
              <div
                key={i}
                className="landing-beat"
                style={{ animationDelay: `${1.4 + i * 0.25}s` }}
              >
                <span className="landing-beat-icon">{beat.icon}</span>
                <span className="landing-beat-line">{beat.line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Auth form ── */}
      <div className="landing-auth">
        <div className="landing-auth-inner">
          <h2 className="landing-auth-title">Sign in</h2>

          {error && <div className="error landing-error">{error}</div>}

          {GOOGLE_CLIENT_ID && (
            <>
              <div id="google-signin-btn" className="google-btn-container" />
              {googleLoading && <p className="loading-text">Signing in with Google…</p>}
              <div className="divider"><span>or</span></div>
            </>
          )}

          <form onSubmit={handleSubmit} className="landing-form">
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
            <button type="submit" disabled={loading} className="landing-submit-btn">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="landing-auth-links">
            No account? <Link to="/register">Create one</Link>
            &ensp;·&ensp;
            <Link to="/forgot-password">Forgot password</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
