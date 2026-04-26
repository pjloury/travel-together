import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUser() {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', response.data.token);
    await fetchUser();
    return response;
  }

  async function register(email, username, password, displayName, ref) {
    const response = await api.post('/auth/register', {
      email, username, password, displayName, ref: ref || undefined,
    });
    return response;
  }

  async function loginWithGoogle(credential, ref) {
    const response = await api.post('/auth/google', { credential, ref: ref || undefined });
    localStorage.setItem('token', response.token);
    // Remember that this user has previously signed in with Google so the
    // login page can auto-trigger One Tap on subsequent visits and skip
    // the manual "Continue as <email>" button click.
    localStorage.setItem('lastGoogleSignIn', '1');
    setUser(response.user);
    return response;
  }

  function logout() {
    localStorage.removeItem('token');
    // Clear the auto-sign-in hint so we don't silently log the user back in
    // immediately after they explicitly logged out.
    localStorage.removeItem('lastGoogleSignIn');
    // Also disable Google's auto-select so One Tap won't fire on next load.
    if (window.google?.accounts?.id) {
      try { window.google.accounts.id.disableAutoSelect(); } catch { /* noop */ }
    }
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

