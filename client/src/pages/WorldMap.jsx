import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/client';

// Group countries by continent using ISO 3166-1 alpha-2 codes
const CONTINENT_GROUPS = {
  'Europe': ['AD','AL','AM','AT','AZ','BA','BE','BG','BY','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GE','GR','HR','HU','IE','IS','IT','KZ','LI','LT','LU','LV','MC','MD','ME','MK','MT','NL','NO','PL','PT','RO','RS','RU','SE','SI','SK','SM','TR','UA','VA','XK'],
  'Asia': ['AF','AE','AM','AZ','BD','BH','BN','BT','CN','GE','HK','ID','IL','IN','IQ','IR','JO','JP','KG','KH','KP','KR','KW','KZ','LA','LB','LK','MM','MN','MO','MV','MY','NP','OM','PH','PK','PS','QA','SA','SG','SY','TJ','TL','TM','TW','UZ','VN','YE'],
  'Africa': ['AO','BF','BI','BJ','BW','CD','CF','CG','CI','CM','CV','DJ','DZ','EG','ER','ET','GA','GH','GM','GN','GQ','GW','KE','KM','LR','LS','LY','MA','MG','ML','MR','MU','MW','MZ','NA','NE','NG','RW','SC','SD','SL','SN','SO','SS','ST','SZ','TD','TG','TN','TZ','UG','ZA','ZM','ZW'],
  'Americas': ['AG','AR','BB','BO','BR','BS','BZ','CA','CL','CO','CR','CU','DM','DO','EC','GD','GT','GY','HN','HT','JM','KN','LC','MX','NI','PA','PE','PY','SR','SV','TT','US','UY','VC','VE'],
  'Oceania': ['AU','FJ','FM','KI','MH','NR','NZ','PG','PW','SB','TO','TV','VU','WS'],
};

export default function WorldMap() {
  const [visited, setVisited] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/countries'), api.get('/wishlist')])
      .then(([v, w]) => {
        setVisited(v.data || []);
        setWishlist(w.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const visitedCodes = new Set(visited.map(c => c.countryCode));
  const wishlistCodes = new Set(wishlist.map(c => c.countryCode));
  const allCodes = new Set([...visitedCodes, ...wishlistCodes]);

  function getFlagEmoji(code) {
    if (!code || code.length !== 2) return '';
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => 127397 + c.charCodeAt()));
  }

  function getStatusClass(code) {
    const v = visitedCodes.has(code);
    const w = wishlistCodes.has(code);
    if (v && w) return 'both';
    if (v) return 'visited';
    if (w) return 'wishlist';
    return '';
  }

  if (loading) return <Layout><div className="loading">Loading your world map...</div></Layout>;

  return (
    <Layout>
      <div className="worldmap-page">
        <div className="page-header">
          <h1>My World Map</h1>
          <p className="subtitle">Your travel footprint at a glance</p>
        </div>

        <div className="map-legend">
          <span className="legend-item visited">✓ Visited ({visitedCodes.size})</span>
          <span className="legend-item wishlist">★ Wishlist ({wishlistCodes.size})</span>
          <span className="legend-item both">✦ Both</span>
        </div>

        {Object.entries(CONTINENT_GROUPS).map(([continent, codes]) => {
          const relevantCodes = codes.filter(c => visitedCodes.has(c) || wishlistCodes.has(c));
          if (relevantCodes.length === 0) return null;
          return (
            <div key={continent} className="continent-section">
              <h3>{continent}</h3>
              <div className="countries-map-grid">
                {relevantCodes.map(code => (
                  <Link
                    key={code}
                    to={`/country/${code}`}
                    className={`map-country-card ${getStatusClass(code)}`}
                    title={code}
                  >
                    <span className="map-flag">{getFlagEmoji(code)}</span>
                    <span className="map-status-icon">
                      {visitedCodes.has(code) && wishlistCodes.has(code) ? '✦' :
                       visitedCodes.has(code) ? '✓' : '★'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {allCodes.size === 0 && (
          <div className="empty-state">
            <p>Add countries to your travels and wishlist to see them here!</p>
            <Link
              to="/travels"
              className="btn-primary"
              style={{
                display: 'inline-block',
                marginTop: '12px',
                padding: '10px 20px',
                background: 'var(--accent)',
                color: 'var(--bg-dark)',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              Add Travels
            </Link>
          </div>
        )}
      </div>
    </Layout>
  );
}
