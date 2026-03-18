import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import CountryPicker from '../components/CountryPicker';
import api from '../api/client';

export default function Wishlist() {
  const [wishlist, setWishlist] = useState([]);
  const [visitedCodes, setVisitedCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pendingCountry, setPendingCountry] = useState(null);
  const [newInterestLevel, setNewInterestLevel] = useState(3);
  const [newCities, setNewCities] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [wishlistRes, countriesRes] = await Promise.all([
        api.get('/wishlist'),
        api.get('/countries')
      ]);
      setWishlist(wishlistRes.data);
      setVisitedCodes(countriesRes.data.map(c => c.countryCode));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCountrySelect({ countryCode, countryName }) {
    // Check if already on wishlist
    if (wishlist.find(w => w.countryCode === countryCode)) {
      return;
    }
    setPendingCountry({ countryCode, countryName });
    setShowPicker(false);
    setNewInterestLevel(3);
    setNewCities('');
  }

  async function handleAddToWishlist(e) {
    e.preventDefault();
    if (!pendingCountry) return;

    try {
      const cities = newCities.split(',').map(c => c.trim()).filter(c => c);
      await api.post('/wishlist', {
        countryCode: pendingCountry.countryCode,
        countryName: pendingCountry.countryName,
        interestLevel: newInterestLevel,
        specificCities: cities
      });
      setPendingCountry(null);
      setNewInterestLevel(3);
      setNewCities('');
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateInterest(countryCode, interestLevel) {
    try {
      await api.put(`/wishlist/${countryCode}`, { interestLevel });
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpdateNotes(countryCode, notes) {
    try {
      await api.put(`/wishlist/${countryCode}`, { notes });
    } catch (err) {
      setError(err.message);
    }
  }

  const wishlistCodes = wishlist.map(w => w.countryCode);

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

      {pendingCountry ? (
        <form className="add-wishlist-form" onSubmit={handleAddToWishlist}>
          <h3>Add {getFlagEmoji(pendingCountry.countryCode)} {pendingCountry.countryName}</h3>
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
            <button type="submit">Add to Wishlist</button>
            <button type="button" onClick={() => setPendingCountry(null)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <button 
            className="add-btn"
            onClick={() => setShowPicker(!showPicker)}
          >
            {showPicker ? '✕ Close' : '+ Add to Wishlist'}
          </button>
          
          {showPicker && (
            <div className="country-picker-container">
              <CountryPicker
                onSelect={handleCountrySelect}
                visitedCountries={visitedCodes}
                wishlistCountries={wishlistCodes}
                mode="single"
                title="Choose a destination"
                placeholder="Filter countries..."
              />
            </div>
          )}
        </>
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
              {item.friendsWhoHaveBeen?.length > 0 && (
                <div className="friend-info has-been">
                  <span className="label">🎒 Been there:</span>
                  {item.friendsWhoHaveBeen.map(friend => (
                    <Link key={friend.id} to={`/profile/${friend.id}`} className="friend-link">
                      {friend.displayName}
                      {friend.citiesVisited?.length > 0 && (
                        <span className="friend-cities">({friend.citiesVisited.join(', ')})</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {/* Friends who also want */}
              {item.friendsWhoAlsoWant?.length > 0 && (
                <div className="friend-info also-want">
                  <span className="label">✨ Also want:</span>
                  {item.friendsWhoAlsoWant.map(friend => (
                    <Link key={friend.id} to={`/profile/${friend.id}`} className="friend-link">
                      {friend.displayName}
                      {friend.specificCities?.length > 0 && (
                        <span className="friend-cities">({friend.specificCities.join(', ')})</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              <div className="notes-section">
                <label className="notes-label">Notes (optional)</label>
                <textarea
                  className="notes-textarea"
                  defaultValue={item.notes || ''}
                  placeholder="Add personal notes about this destination..."
                  rows={2}
                  onBlur={(e) => {
                    const newNotes = e.target.value;
                    if (newNotes !== (item.notes || '')) {
                      handleUpdateNotes(item.countryCode, newNotes);
                    }
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}

