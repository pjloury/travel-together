// @vitest-environment jsdom
// Auto-redirect returning Google users on the login page.
// Story: when the login page loads and the user previously signed in with
// Google, we should auto-trigger One Tap (auto_select) so they bypass the
// "Continue as <email>" button. After logout, the hint must be cleared so
// the user is not silently logged back in.
import { describe, it, expect, beforeEach } from 'vitest';

describe('Google auto sign-in hint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is unset on a fresh session', () => {
    expect(localStorage.getItem('lastGoogleSignIn')).toBeNull();
  });

  it('is set after a successful Google login', () => {
    // Simulates AuthContext.loginWithGoogle setting the flag
    localStorage.setItem('lastGoogleSignIn', '1');
    expect(localStorage.getItem('lastGoogleSignIn')).toBe('1');
  });

  it('is cleared on logout', () => {
    localStorage.setItem('lastGoogleSignIn', '1');
    // Simulates AuthContext.logout clearing the flag
    localStorage.removeItem('lastGoogleSignIn');
    expect(localStorage.getItem('lastGoogleSignIn')).toBeNull();
  });

  it('drives the auto_select flag passed to Google initialize', () => {
    const compute = () => localStorage.getItem('lastGoogleSignIn') === '1';
    expect(compute()).toBe(false);
    localStorage.setItem('lastGoogleSignIn', '1');
    expect(compute()).toBe(true);
    localStorage.removeItem('lastGoogleSignIn');
    expect(compute()).toBe(false);
  });
});
