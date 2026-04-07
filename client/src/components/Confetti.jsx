// Confetti celebration — lightweight CSS-only confetti burst
// Usage: <Confetti active={showConfetti} />

import { useEffect, useState } from 'react';

const COLORS = ['#C9A84C', '#E8D48B', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DFE6E9'];
const PARTICLE_COUNT = 40;

export default function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }
    const p = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20, // center-ish
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      angle: Math.random() * 360,
      speed: 0.5 + Math.random() * 1.5,
      size: 4 + Math.random() * 6,
    }));
    setParticles(p);
    const timer = setTimeout(() => setParticles([]), 2500);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div className="confetti-container">
      {particles.map(p => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.x}%`,
            backgroundColor: p.color,
            width: p.size,
            height: p.size * 0.6,
            animationDelay: `${p.delay}s`,
            '--angle': `${p.angle}deg`,
            '--speed': p.speed,
          }}
        />
      ))}
    </div>
  );
}
