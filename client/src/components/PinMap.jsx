// PinMap — stats + destination list view for PAST and FUTURE tabs.
// Replaced react-simple-maps (ESM circular dep, prod crash) with a
// dependency-free stats layout.

import { useState, useEffect } from 'react';
import api from '../api/client';

// Derive a flag emoji from a country name using a lookup table.
// Falls back to a globe emoji if not found.
const COUNTRY_FLAGS = {
  'afghanistan': '🇦🇫', 'albania': '🇦🇱', 'algeria': '🇩🇿', 'andorra': '🇦🇩',
  'angola': '🇦🇴', 'argentina': '🇦🇷', 'armenia': '🇦🇲', 'australia': '🇦🇺',
  'austria': '🇦🇹', 'azerbaijan': '🇦🇿', 'bahamas': '🇧🇸', 'bahrain': '🇧🇭',
  'bangladesh': '🇧🇩', 'belarus': '🇧🇾', 'belgium': '🇧🇪', 'belize': '🇧🇿',
  'benin': '🇧🇯', 'bhutan': '🇧🇹', 'bolivia': '🇧🇴', 'bosnia and herzegovina': '🇧🇦',
  'botswana': '🇧🇼', 'brazil': '🇧🇷', 'brunei': '🇧🇳', 'bulgaria': '🇧🇬',
  'burkina faso': '🇧🇫', 'burundi': '🇧🇮', 'cambodia': '🇰🇭', 'cameroon': '🇨🇲',
  'canada': '🇨🇦', 'cape verde': '🇨🇻', 'central african republic': '🇨🇫',
  'chad': '🇹🇩', 'chile': '🇨🇱', 'china': '🇨🇳', 'colombia': '🇨🇴',
  'comoros': '🇰🇲', 'congo': '🇨🇬', 'costa rica': '🇨🇷', 'croatia': '🇭🇷',
  'cuba': '🇨🇺', 'cyprus': '🇨🇾', 'czech republic': '🇨🇿', 'czechia': '🇨🇿',
  'denmark': '🇩🇰', 'djibouti': '🇩🇯', 'dominican republic': '🇩🇴', 'ecuador': '🇪🇨',
  'egypt': '🇪🇬', 'el salvador': '🇸🇻', 'equatorial guinea': '🇬🇶', 'eritrea': '🇪🇷',
  'estonia': '🇪🇪', 'ethiopia': '🇪🇹', 'fiji': '🇫🇯', 'finland': '🇫🇮',
  'france': '🇫🇷', 'gabon': '🇬🇦', 'gambia': '🇬🇲', 'georgia': '🇬🇪',
  'germany': '🇩🇪', 'ghana': '🇬🇭', 'greece': '🇬🇷', 'guatemala': '🇬🇹',
  'guinea': '🇬🇳', 'guinea-bissau': '🇬🇼', 'guyana': '🇬🇾', 'haiti': '🇭🇹',
  'honduras': '🇭🇳', 'hungary': '🇭🇺', 'iceland': '🇮🇸', 'india': '🇮🇳',
  'indonesia': '🇮🇩', 'iran': '🇮🇷', 'iraq': '🇮🇶', 'ireland': '🇮🇪',
  'israel': '🇮🇱', 'italy': '🇮🇹', 'jamaica': '🇯🇲', 'japan': '🇯🇵',
  'jordan': '🇯🇴', 'kazakhstan': '🇰🇿', 'kenya': '🇰🇪', 'kuwait': '🇰🇼',
  'kyrgyzstan': '🇰🇬', 'laos': '🇱🇦', 'latvia': '🇱🇻', 'lebanon': '🇱🇧',
  'lesotho': '🇱🇸', 'liberia': '🇱🇷', 'libya': '🇱🇾', 'liechtenstein': '🇱🇮',
  'lithuania': '🇱🇹', 'luxembourg': '🇱🇺', 'madagascar': '🇲🇬', 'malawi': '🇲🇼',
  'malaysia': '🇲🇾', 'maldives': '🇲🇻', 'mali': '🇲🇱', 'malta': '🇲🇹',
  'mauritania': '🇲🇷', 'mauritius': '🇲🇺', 'mexico': '🇲🇽', 'moldova': '🇲🇩',
  'monaco': '🇲🇨', 'mongolia': '🇲🇳', 'montenegro': '🇲🇪', 'morocco': '🇲🇦',
  'mozambique': '🇲🇿', 'myanmar': '🇲🇲', 'namibia': '🇳🇦', 'nepal': '🇳🇵',
  'netherlands': '🇳🇱', 'new zealand': '🇳🇿', 'nicaragua': '🇳🇮', 'niger': '🇳🇪',
  'nigeria': '🇳🇬', 'north korea': '🇰🇵', 'north macedonia': '🇲🇰', 'norway': '🇳🇴',
  'oman': '🇴🇲', 'pakistan': '🇵🇰', 'panama': '🇵🇦', 'papua new guinea': '🇵🇬',
  'paraguay': '🇵🇾', 'peru': '🇵🇪', 'philippines': '🇵🇭', 'poland': '🇵🇱',
  'portugal': '🇵🇹', 'qatar': '🇶🇦', 'romania': '🇷🇴', 'russia': '🇷🇺',
  'rwanda': '🇷🇼', 'saudi arabia': '🇸🇦', 'senegal': '🇸🇳', 'serbia': '🇷🇸',
  'sierra leone': '🇸🇱', 'singapore': '🇸🇬', 'slovakia': '🇸🇰', 'slovenia': '🇸🇮',
  'somalia': '🇸🇴', 'south africa': '🇿🇦', 'south korea': '🇰🇷', 'south sudan': '🇸🇸',
  'spain': '🇪🇸', 'sri lanka': '🇱🇰', 'sudan': '🇸🇩', 'suriname': '🇸🇷',
  'sweden': '🇸🇪', 'switzerland': '🇨🇭', 'syria': '🇸🇾', 'taiwan': '🇹🇼',
  'tajikistan': '🇹🇯', 'tanzania': '🇹🇿', 'thailand': '🇹🇭', 'timor-leste': '🇹🇱',
  'togo': '🇹🇬', 'trinidad and tobago': '🇹🇹', 'tunisia': '🇹🇳', 'turkey': '🇹🇷',
  'turkmenistan': '🇹🇲', 'uganda': '🇺🇬', 'ukraine': '🇺🇦',
  'united arab emirates': '🇦🇪', 'united kingdom': '🇬🇧', 'united states': '🇺🇸',
  'usa': '🇺🇸', 'uk': '🇬🇧', 'uae': '🇦🇪',
  'uruguay': '🇺🇾', 'uzbekistan': '🇺🇿', 'venezuela': '🇻🇪', 'vietnam': '🇻🇳',
  'yemen': '🇾🇪', 'zambia': '🇿🇲', 'zimbabwe': '🇿🇼',
};

function countryFlag(name) {
  return COUNTRY_FLAGS[name.toLowerCase().trim()] || '🌍';
}

export default function PinMap({ tab }) {
  const [mapData, setMapData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/pins/map-data')
      .then(res => { setMapData(res.data?.data || res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="pin-map-loading">
        <div className="pin-map-spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  // ── MEMORIES: visited countries list ──
  if (tab === 'memory') {
    const countries = mapData?.visitedCountries || [];
    const total = mapData?.totalVisited || countries.length;

    return (
      <div className="pin-stats-view">
        <div className="pin-stats-hero">
          <span className="pin-stats-number">{total}</span>
          <span className="pin-stats-label">{total === 1 ? 'country visited' : 'countries visited'}</span>
        </div>

        {countries.length === 0 ? (
          <div className="pin-stats-empty">
            <p>Add memories to start tracking the countries you've visited.</p>
          </div>
        ) : (
          <div className="pin-stats-grid">
            {countries.map((name, i) => (
              <div key={i} className="pin-stats-country">
                <span className="pin-stats-flag">{countryFlag(name)}</span>
                <span className="pin-stats-country-name">{name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── DREAMS: destination list ──
  const dreams = mapData?.dreamPins || [];
  const total = mapData?.totalDreams || dreams.length;

  return (
    <div className="pin-stats-view">
      <div className="pin-stats-hero">
        <span className="pin-stats-number">{total}</span>
        <span className="pin-stats-label">{total === 1 ? 'dream destination' : 'dream destinations'}</span>
      </div>

      {dreams.length === 0 ? (
        <div className="pin-stats-empty">
          <p>Add dream destinations to see them collected here.</p>
        </div>
      ) : (
        <div className="pin-stats-list">
          {dreams.map((pin) => (
            <div key={pin.id} className="pin-stats-dream-item">
              <span className="pin-stats-dream-dot" />
              <span className="pin-stats-dream-name">{pin.placeName}</span>
              {pin.tags && pin.tags.length > 0 && (
                <span className="pin-stats-dream-tags">
                  {pin.tags.slice(0, 3).map(t => t.emoji || '').join(' ')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
