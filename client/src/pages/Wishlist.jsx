import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import CountryAutocomplete from '../components/CountryAutocomplete';
import api from '../api/client';

export default function Wishlist() {
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCountry, setNewCountry] = useState(null);
  const [newInterestLevel, setNewInterestLevel] = useState(3);
  const [newCities, setNewCities] = useState('');

  useEffect(() => {
    fetchWishlist();
  }, []);

  async function fetchWishlist() {
    try {
      const response = await api.get('/wishlist');
      setWishlist(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddToWishlist(e) {
    e.preventDefault();
    if (!newCountry) return;

    try {
      const cities = newCities.split(',').map(c => c.trim()).filter(c => c);
      await api.post('/wishlist', {
        countryCode: newCountry.countryCode,
        countryName: newCountry.countryName,
        interestLevel: newInterestLevel,
        specificCities: cities
      });
      setShowAddForm(false);
      setNewCountry(null);
      setNewInterestLevel(3);
      setNewCities('');
      fetchWishlist();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateInterest(countryCode, interestLevel) {
    try {
      await api.put(`/wishlist/${countryCode}`, { interestLevel });
      fetchWishlist();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(countryCode) {
    if (!confirm('Remove from wishlist?')) return;
    try {
      await api.delete(`/wishlist/${countryCode}`);
      setWishlist(wishlist.filter(w => w.countryCode !== countryCode));
    } catch (err) {
      setError(err.message);
    }
  }

  function getFlagEmoji(countryCode) {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }

  function renderStars(level, countryCode) {
    return (
      <div className="interest-stars">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`star ${star <= level ? 'filled' : ''}`}
            onClick={() => handleUpdateInterest(countryCode, star)}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>My Wishlist</h1>
        <p className="subtitle">Places you want to visit</p>
      </div>

      {error && <div className="error">{error}</div>}

      {!showAddForm ? (
        <button className="add-btn" onClick={() => setShowAddForm(true)}>
          + Add to Wishlist
        </button>
      ) : (
        <form className="add-wishlist-form" onSubmit={handleAddToWishlist}>
          <h3>Add a destination</h3>
          <CountryAutocomplete onSelect={setNewCountry} />
          {newCountry && (
            <div className="selected-country">
              Selected: {getFlagEmoji(newCountry.countryCode)} {newCountry.countryName}
            </div>
          )}
          <div className="form-group">
            <label>Interest Level (1-5)</label>
            <div className="interest-selector">
              {[1, 2, 3, 4, 5].map(level => (
                <button
                  key={level}
                  type="button"
                  className={`star ${level <= newInterestLevel ? 'filled' : ''}`}
                  onClick={() => setNewInterestLevel(level)}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Specific cities (optional, comma-separated)</label>
            <input
              type="text"
              value={newCities}
              onChange={(e) => setNewCities(e.target.value)}
              placeholder="Rome, Florence, Venice"
            />
          </div>
          <div className="form-actions">
            <button type="submit" disabled={!newCountry}>Add</button>
            <button type="button" onClick={() => setShowAddForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {wishlist.length === 0 ? (
        <div className="empty-state">
          <p>Your wishlist is empty. Add some dream destinations!</p>
        </div>
      ) : (
        <div className="wishlist-grid">
          {wishlist.map(item => (
            <div key={item.countryCode} className="wishlist-card">
              <div className="wishlist-header">
                <span className="country-flag">{getFlagEmoji(item.countryCode)}</span>
                <span className="country-name">{item.countryName}</span>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(item.countryCode)}
                >
                  ×
                </button>
              </div>
              
              {renderStars(item.interestLevel, item.countryCode)}
              
              {item.specificCities?.length > 0 && (
                <div className="specific-cities">
                  {item.specificCities.map((city, i) => (
                    <span key={i} className="city-tag">{city}</span>
                  ))}
                </div>
              )}

              {/* Friends who have been */}
              {item.friendsHaveBeen?.length > 0 && (
                <div className="friend-info has-been">
                  <span className="label">🎒 Been there:</span>
                  {item.friendsHaveBeen.map(friend => (
                    <Link key={friend.id} to={`/profile/${friend.id}`} className="friend-link">
                      {friend.displayName}
                      {friend.cities?.length > 0 && (
                        <span className="friend-cities">({friend.cities.join(', ')})</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* Friends who also want */}
              {item.friendsAlsoWant?.length > 0 && (
                <div className="friend-info also-want">
                  <span className="label">✨ Also want:</span>
                  {item.friendsAlsoWant.map(friend => (
                    <Link key={friend.id} to={`/profile/${friend.id}`} className="friend-link">
                      {friend.displayName}
                      {friend.specificCities?.length > 0 && (
                        <span className="friend-cities">({friend.specificCities.join(', ')})</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

