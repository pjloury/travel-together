import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

export default function LetsTravel() {
  const [letsGo, setLetsGo] = useState([]);
  const [helpMe, setHelpMe] = useState([]);
  const [iCanHelp, setICanHelp] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('lets-go');

  useEffect(() => {
    fetchAlignmentData();
  }, []);

  async function fetchAlignmentData() {
    try {
      const [letsGoRes, helpMeRes, iCanHelpRes] = await Promise.all([
        api.get('/alignment/lets-go'),
        api.get('/alignment/help-me'),
        api.get('/alignment/i-can-help')
      ]);
      setLetsGo(letsGoRes.data);
      setHelpMe(helpMeRes.data);
      setICanHelp(iCanHelpRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getFlagEmoji(countryCode) {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }

  if (loading) {
    return <Layout><div className="loading">Loading...</div></Layout>;
  }

  return (
    <Layout>
      <div className="page-header">
        <h1>Let's Travel</h1>
        <p className="subtitle">See where your travel interests align with friends</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="alignment-tabs">
        <button 
          className={`tab ${activeTab === 'lets-go' ? 'active' : ''}`}
          onClick={() => setActiveTab('lets-go')}
        >
          ✈️ Let's Go Together
          {letsGo.length > 0 && <span className="badge">{letsGo.length}</span>}
        </button>
        <button 
          className={`tab ${activeTab === 'help-me' ? 'active' : ''}`}
          onClick={() => setActiveTab('help-me')}
        >
          🎒 Get Advice
          {helpMe.length > 0 && <span className="badge">{helpMe.length}</span>}
        </button>
        <button 
          className={`tab ${activeTab === 'i-can-help' ? 'active' : ''}`}
          onClick={() => setActiveTab('i-can-help')}
        >
          💡 Share Experience
          {iCanHelp.length > 0 && <span className="badge">{iCanHelp.length}</span>}
        </button>
      </div>

      <div className="alignment-content">
        {activeTab === 'lets-go' && (
          <div className="alignment-section">
            <div className="section-intro">
              <h2>Let's Go Together!</h2>
              <p>Countries you both want to visit — plan a trip together!</p>
            </div>
            {letsGo.length === 0 ? (
              <div className="empty-state">
                <p>No matching destinations yet. Add more to your wishlist!</p>
              </div>
            ) : (
              <div className="alignment-grid">
                {letsGo.map(item => (
                  <div key={item.countryCode} className="alignment-card lets-go">
                    <div className="card-header">
                      <span className="flag">{getFlagEmoji(item.countryCode)}</span>
                      <span className="country">{item.countryName}</span>
                      <span className="interest">{'★'.repeat(item.myInterestLevel)}</span>
                    </div>
                    
                    {item.mySpecificCities?.length > 0 && (
                      <div className="my-cities">
                        <span className="label">You want:</span>
                        {item.mySpecificCities.map((city, i) => (
                          <span key={i} className="city-tag mine">{city}</span>
                        ))}
                      </div>
                    )}

                    <div className="friends-list">
                      {item.friendsWhoAlsoWant?.map(friend => (
                        <div key={friend.id} className="friend-row">
                          <Link to={`/profile/${friend.id}`} className="friend-name">
                            {friend.displayName}
                          </Link>
                          <span className="also-wants">also wants to go</span>
                          {friend.specificCities?.length > 0 && (
                            <div className="friend-cities">
                              {friend.specificCities.map((city, i) => (
                                <span 
                                  key={i} 
                                  className={`city-tag ${item.mySpecificCities?.includes(city) ? 'match' : ''}`}
                                >
                                  {city}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button className="action-btn">Plan a trip!</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'help-me' && (
          <div className="alignment-section">
            <div className="section-intro">
              <h2>Get Advice</h2>
              <p>Friends who've been to places on your wishlist — ask them about it!</p>
            </div>
            {helpMe.length === 0 ? (
              <div className="empty-state">
                <p>No friends have been to your wishlist destinations yet.</p>
              </div>
            ) : (
              <div className="alignment-grid">
                {helpMe.map(item => (
                  <div key={item.countryCode} className="alignment-card help-me">
                    <div className="card-header">
                      <span className="flag">{getFlagEmoji(item.countryCode)}</span>
                      <span className="country">{item.countryName}</span>
                      <span className="interest">{'★'.repeat(item.myInterestLevel)}</span>
                    </div>

                    {item.mySpecificCities?.length > 0 && (
                      <div className="my-cities">
                        <span className="label">You want:</span>
                        {item.mySpecificCities.map((city, i) => (
                          <span key={i} className="city-tag mine">{city}</span>
                        ))}
                      </div>
                    )}

                    <div className="friends-list">
                      {item.friendsWhoHaveBeen?.map(friend => (
                        <div key={friend.id} className="friend-row">
                          <Link to={`/profile/${friend.id}`} className="friend-name">
                            {friend.displayName}
                          </Link>
                          <span className="has-been">has been</span>
                          {friend.citiesVisited?.length > 0 && (
                            <div className="friend-cities">
                              {friend.citiesVisited.map((city, i) => (
                                <span 
                                  key={i} 
                                  className={`city-tag ${item.mySpecificCities?.includes(city) ? 'match' : ''}`}
                                >
                                  {city}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button className="action-btn">Ask for tips!</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'i-can-help' && (
          <div className="alignment-section">
            <div className="section-intro">
              <h2>Share Your Experience</h2>
              <p>Friends want to visit places you've been — share your tips!</p>
            </div>
            {iCanHelp.length === 0 ? (
              <div className="empty-state">
                <p>None of your friends want to visit your destinations yet.</p>
              </div>
            ) : (
              <div className="alignment-grid">
                {iCanHelp.map(item => (
                  <div key={item.countryCode} className="alignment-card i-can-help">
                    <div className="card-header">
                      <span className="flag">{getFlagEmoji(item.countryCode)}</span>
                      <span className="country">{item.countryName}</span>
                    </div>

                    {item.myCitiesVisited?.length > 0 && (
                      <div className="my-cities">
                        <span className="label">You visited:</span>
                        {item.myCitiesVisited.map((city, i) => (
                          <span key={i} className="city-tag mine">{city}</span>
                        ))}
                      </div>
                    )}

                    <div className="friends-list">
                      {item.friendsWhoWant?.map(friend => (
                        <div key={friend.id} className="friend-row">
                          <Link to={`/profile/${friend.id}`} className="friend-name">
                            {friend.displayName}
                          </Link>
                          <span className="wants-to-go">
                            wants to go (★{friend.interestLevel})
                          </span>
                          {friend.specificCities?.length > 0 && (
                            <div className="friend-cities">
                              {friend.specificCities.map((city, i) => (
                                <span 
                                  key={i} 
                                  className={`city-tag ${item.myCitiesVisited?.includes(city) ? 'match' : ''}`}
                                >
                                  {city}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button className="action-btn">Share tips!</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

