// useLoadingPhrases — cycles through fun status messages during loading
// Inspired by "Reticulating Splines" from The Sims

import { useState, useEffect } from 'react';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {string[]} phrases - Array of loading messages to cycle through
 * @param {boolean} active - Whether to cycle (starts/stops the timer)
 * @param {number} [interval=2200] - Milliseconds between phrase changes
 * @returns {string} Current phrase
 */
export default function useLoadingPhrases(phrases, active, interval = 2200) {
  const [shuffled, setShuffled] = useState(() => shuffle(phrases));
  const [index, setIndex] = useState(0);

  // Reshuffle on activation
  useEffect(() => {
    if (active) {
      setShuffled(shuffle(phrases));
      setIndex(0);
    }
  }, [active, phrases]);

  // Cycle through phrases
  useEffect(() => {
    if (!active || shuffled.length === 0) return;
    const timer = setInterval(() => {
      setIndex(i => (i + 1) % shuffled.length);
    }, interval);
    return () => clearInterval(timer);
  }, [active, interval, shuffled.length]);

  if (!active || shuffled.length === 0) return phrases[0] || '';
  return shuffled[index] || phrases[0];
}
