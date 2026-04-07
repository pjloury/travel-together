// Join page — invite landing page with tutorial + signup
// Reached via /join/:code from a shared invite link

import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const STEPS = [
  {
    emoji: '🌍',
    title: 'Pin your memories',
    desc: 'Record every place you\'ve been — voice-capture your stories, rate experiences, and watch your travel map fill in.',
  },
  {
    emoji: '✨',
    title: 'Dream out loud',
    desc: 'Pin the places you want to go. Get AI-curated itineraries from travel influencers and bloggers.',
  },
  {
    emoji: '🤝',
    title: 'Travel together',
    desc: 'See where your friends have been and where they dream of going. Find overlap and plan trips together.',
  },
];

export default function Join() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [inviter, setInviter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);

  // If already logged in, redirect to home
  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!code) { setLoading(false); return; }
    async function load() {
      try {
        const res = await api.get(`/invites/info/${code}`);
        setInviter(res.inviter || res.data?.inviter || null);
      } catch {
        // Invalid code — still show the tutorial
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [code]);

  if (loading) {
    return (
      <div className="join-page">
        <div className="join-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div className="join-page">
      <div className="join-card">
        {/* Logo */}
        <div className="join-logo">Travel Together</div>

        {/* Inviter badge */}
        {inviter && (
          <div className="join-inviter">
            <div className="join-inviter-avatar">
              {inviter.avatarUrl
                ? <img src={inviter.avatarUrl} alt={inviter.displayName} />
                : <span>{(inviter.displayName || '?').charAt(0).toUpperCase()}</span>
              }
            </div>
            <p className="join-inviter-text">
              <strong>{inviter.displayName}</strong> invited you to join
            </p>
            <p className="join-inviter-stats">
              {inviter.memoryCount} memories · {inviter.dreamCount} dreams
            </p>
          </div>
        )}

        {/* Tutorial carousel */}
        <div className="join-tutorial">
          <div className="join-step">
            <span className="join-step-emoji">{STEPS[step].emoji}</span>
            <h2 className="join-step-title">{STEPS[step].title}</h2>
            <p className="join-step-desc">{STEPS[step].desc}</p>
          </div>

          {/* Dots */}
          <div className="join-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`join-dot${i === step ? ' active' : ''}`}
                onClick={() => setStep(i)}
              />
            ))}
          </div>

          {/* Next / Get started */}
          {step < STEPS.length - 1 ? (
            <button className="join-next-btn" onClick={() => setStep(s => s + 1)}>
              Next
            </button>
          ) : (
            <Link
              to={`/register${code ? `?ref=${code}${inviter?.id ? `&inviter=${inviter.id}` : ''}` : ''}`}
              className="join-cta-btn"
            >
              Get started
            </Link>
          )}
        </div>

        <p className="join-signin-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
