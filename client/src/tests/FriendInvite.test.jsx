// TT1: Invite by email from friend search
import { describe, it, expect } from 'vitest';

describe('TT1: email invite detection', () => {
  const isEmail = q => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim());

  it('detects valid email', () => {
    expect(isEmail('friend@example.com')).toBe(true);
    expect(isEmail('test.user+tag@domain.co.uk')).toBe(true);
  });

  it('rejects non-emails', () => {
    expect(isEmail('johndoe')).toBe(false);
    expect(isEmail('@nodomain')).toBe(false);
    expect(isEmail('')).toBe(false);
  });
});
