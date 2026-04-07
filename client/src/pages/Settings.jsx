import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

export default function Settings() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [usernameError, setUsernameError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    setUsernameError('');

    try {
      await api.put('/auth/me', { displayName, username });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      window.location.reload();
    } catch (err) {
      // Surface username-specific errors inline; show others as the general message
      const errText = err.message || '';
      if (errText.toLowerCase().includes('username')) {
        setUsernameError(errText);
      } else {
        setMessage({ type: 'error', text: errText });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Settings</h1>
        <p className="subtitle">Manage your profile</p>
      </div>

      <div className="settings-card">
        <h3>Profile Information</h3>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={user?.email || ''} disabled />
            <span className="hint">Email cannot be changed</span>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setUsernameError(''); }}
              placeholder="your_username"
              maxLength={30}
            />
            {usernameError && <span className="hint error-hint">{usernameError}</span>}
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              maxLength={100}
            />
          </div>

          <button type="submit" disabled={loading || !displayName.trim()}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <div className="settings-card" style={{ marginTop: 24 }}>
        <h3>Cover Photos</h3>
        <p className="settings-desc">
          Cover photos are sourced from Unsplash — real travel photography.
          You can change any pin's photo by clicking "📷 Change photo" in its detail view.
        </p>
      </div>
    </Layout>
  );
}
