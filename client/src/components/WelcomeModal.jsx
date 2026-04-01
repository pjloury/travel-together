// WelcomeModal — first-time user onboarding tutorial
// Shows once after signup, dismissed permanently via localStorage

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const STEPS = [
  {
    emoji: '🌍',
    title: 'Pin your memories',
    desc: 'Record every place you\'ve been — voice-capture your stories, rate experiences, and watch your travel map fill in.',
  },
  {
    emoji: '✨',
    title: 'Dream out loud',
    desc: 'Pin the places you want to go. Get AI-curated itineraries from travel influencers and bloggers on the Discover page.',
  },
  {
    emoji: '🗺️',
    title: 'Build your board',
    desc: 'Your past trips and future dreams live side-by-side. Add a few memories to get started — even just one is enough.',
  },
  {
    emoji: '🤝',
    title: 'Better with friends',
    desc: 'Travel Together is more fun when your friends are on it. Once you\'ve built your board, invite them from the Friends page — see where they\'ve been and dream up trips together.',
  },
];

export default function WelcomeModal({ onDismiss }) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  function handleDismiss() {
    localStorage.setItem('tt_welcome_seen', '1');
    if (onDismiss) onDismiss();
  }

  function handleGetStarted() {
    handleDismiss();
  }

  function handleInviteFriends() {
    handleDismiss();
    navigate('/friends');
  }

  const isLast = step === STEPS.length - 1;

  return (
    <>
      <div className="welcome-backdrop" onClick={handleDismiss} />
      <div className="welcome-modal">
        <button className="welcome-skip" onClick={handleDismiss}>Skip</button>

        <div className="welcome-logo">Travel Together</div>

        <div className="welcome-step">
          <span className="welcome-step-emoji">{STEPS[step].emoji}</span>
          <h2 className="welcome-step-title">{STEPS[step].title}</h2>
          <p className="welcome-step-desc">{STEPS[step].desc}</p>
        </div>

        <div className="welcome-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`welcome-dot${i === step ? ' active' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {isLast ? (
          <div className="welcome-actions">
            <button className="welcome-cta" onClick={handleGetStarted}>
              Start adding memories
            </button>
            <button className="welcome-cta-secondary" onClick={handleInviteFriends}>
              Invite friends first
            </button>
          </div>
        ) : (
          <button className="welcome-next" onClick={() => setStep(s => s + 1)}>
            Next
          </button>
        )}
      </div>
    </>
  );
}
