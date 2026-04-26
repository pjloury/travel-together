// MultiFriendCompare — layered friend comparison panel.
//
// Shown on a friend's BoardView (when isFriend && !isOwnBoard). Starts
// with [you + the friend you're viewing]; user can layer additional
// friends one at a time to surface intersections + advisor opportunities.
//
// Three panels computed client-side from the multi-overlap response:
//   1. EVERYONE wants to go     — countries in EVERY member's dreams
//   2. EVERYONE has been        — countries in EVERY member's memories
//   3. Advisor opportunities    — countries where ≥1 has been + ≥1 dreams
//                                 (and the two sets don't fully overlap).
//
// Pure presentation logic; no mutation. Server enforces "must be a
// friend of the auth user" for every requested userId.

import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { countryFlag } from '../utils/countryFlag';

// initialFriendName isn't used in the body but the prop is documented
// in BoardView's call-site so future iterations can show it as the
// pinned chip's label before /multi-overlap responds.
export default function MultiFriendCompare({ initialFriendId, initialFriendName: _initialFriendName }) {
  // List of additional friend userIds layered on top of [me, initialFriend].
  // The base pair is always present.
  const [extraIds, setExtraIds] = useState([]);
  const [data, setData] = useState(null); // { members, byCountry } | null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Friend picker state
  const [showPicker, setShowPicker] = useState(false);
  const [allFriends, setAllFriends] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Refetch the overlap whenever the layered set changes.
  useEffect(() => {
    if (!initialFriendId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    const userIds = [initialFriendId, ...extraIds].join(',');
    api.get(`/social/multi-overlap?userIds=${encodeURIComponent(userIds)}`)
      .then(res => { if (!cancelled) setData(res.data || res); })
      .catch(err => { if (!cancelled) setError(err.message || 'Could not load comparison'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [initialFriendId, extraIds]);

  // Lazy-load the friends list the first time the picker is opened.
  async function openPicker() {
    setShowPicker(true);
    if (allFriends.length > 0) return;
    setPickerLoading(true);
    try {
      const res = await api.get('/friends');
      setAllFriends(res.data || []);
    } catch { /* silent */ }
    finally { setPickerLoading(false); }
  }

  function addFriend(userId) {
    if (userId === initialFriendId) return;
    setExtraIds(prev => prev.includes(userId) ? prev : [...prev, userId]);
    setShowPicker(false);
  }
  function removeExtra(userId) {
    setExtraIds(prev => prev.filter(id => id !== userId));
  }

  const members = data?.members || [];
  const byCountry = data?.byCountry || [];

  // Friends not yet layered (excluding the initial friend who's always pinned).
  const availableFriends = useMemo(() => {
    const layered = new Set([initialFriendId, ...extraIds]);
    return allFriends.filter(f => !layered.has(f.id));
  }, [allFriends, initialFriendId, extraIds]);

  // Three-way categorization. Only meaningful with 2+ members.
  const groups = useMemo(() => {
    if (members.length < 2) return { everyoneDreams: [], everyoneVisited: [], advisor: [] };
    const N = members.length;
    const everyoneDreams = [];
    const everyoneVisited = [];
    const advisor = [];
    for (const c of byCountry) {
      const visitedAll = c.visitedBy.length === N;
      const dreamingAll = c.dreamingBy.length === N;
      if (dreamingAll) everyoneDreams.push(c);
      if (visitedAll) everyoneVisited.push(c);
      // Advisor: at least one member has been, at least one dreams of it
      // (and they're different sets — i.e. the dreamers haven't all been
      // there themselves yet).
      if (
        c.visitedBy.length > 0 &&
        c.dreamingBy.length > 0 &&
        // Exclude the case where everyone has BOTH been AND dreams
        // (already covered by everyoneVisited).
        !visitedAll
      ) {
        // Skip rows that are pure "everyone dreams" — those are already
        // surfaced above. Advisor rows always have ≥1 person who hasn't
        // been but wants to go.
        const dreamersWhoHaventBeen = c.dreamingBy.filter(d => !c.visitedBy.includes(d));
        if (dreamersWhoHaventBeen.length > 0) {
          advisor.push({ ...c, dreamersWhoHaventBeen });
        }
      }
    }
    return { everyoneDreams, everyoneVisited, advisor };
  }, [members, byCountry]);

  function nameFor(userId) {
    const m = members.find(x => x.userId === userId);
    return m?.displayName || 'Friend';
  }

  return (
    <div className="mfc-wrap">
      <div className="mfc-header">
        <h3 className="mfc-title">Compare friends</h3>
        <p className="mfc-sub">
          Layer friends to find places you all want to go — or who could give recs.
        </p>
      </div>

      {/* Member chips: you + initial friend pinned, others removable */}
      <div className="mfc-members">
        {members.map(m => {
          const removable = m.userId !== initialFriendId && m.userId !== members[0]?.userId;
          return (
            <span key={m.userId} className="mfc-chip">
              <span className="mfc-chip-avatar">
                {m.avatarUrl
                  ? <img src={m.avatarUrl} alt="" />
                  : <span>{(m.displayName || '?').charAt(0).toUpperCase()}</span>
                }
              </span>
              {m.displayName || 'Friend'}
              {removable && (
                <button
                  type="button"
                  className="mfc-chip-x"
                  onClick={() => removeExtra(m.userId)}
                  aria-label={`Remove ${m.displayName}`}
                >×</button>
              )}
            </span>
          );
        })}
        <button type="button" className="mfc-add-btn" onClick={openPicker}>
          + Add friend
        </button>
      </div>

      {/* Friend picker dropdown */}
      {showPicker && (
        <div className="mfc-picker">
          {pickerLoading && <div className="mfc-picker-msg">Loading friends…</div>}
          {!pickerLoading && availableFriends.length === 0 && (
            <div className="mfc-picker-msg">All your friends are already in the comparison.</div>
          )}
          {!pickerLoading && availableFriends.map(f => (
            <button
              key={f.id}
              type="button"
              className="mfc-picker-row"
              onClick={() => addFriend(f.id)}
            >
              <span className="mfc-chip-avatar">
                {f.avatarUrl
                  ? <img src={f.avatarUrl} alt="" />
                  : <span>{(f.displayName || '?').charAt(0).toUpperCase()}</span>
                }
              </span>
              <span className="mfc-picker-name">{f.displayName}</span>
              {f.username && <span className="mfc-picker-handle">@{f.username}</span>}
            </button>
          ))}
          <button type="button" className="mfc-picker-cancel" onClick={() => setShowPicker(false)}>
            Cancel
          </button>
        </div>
      )}

      {loading && !data && <div className="mfc-loading"><div className="loading-spinner-sm" /></div>}
      {error && <div className="mfc-empty">{error}</div>}

      {data && members.length >= 2 && (
        <>
          <Section
            title={`Everyone wants to go (${groups.everyoneDreams.length})`}
            subtitle={`${members.length} ${members.length === 1 ? 'person' : 'people'} all dream of these`}
            countries={groups.everyoneDreams}
            empty="No common dream destinations yet."
          />
          <Section
            title={`Everyone has been (${groups.everyoneVisited.length})`}
            subtitle="Great trip-comparison fodder"
            countries={groups.everyoneVisited}
            empty="No countries everyone has been to yet."
          />
          <AdvisorSection
            title={`Recommendation potential (${groups.advisor.length})`}
            subtitle="Some have been; others want to go"
            rows={groups.advisor}
            nameFor={nameFor}
          />
        </>
      )}
    </div>
  );
}

function Section({ title, subtitle, countries, empty }) {
  return (
    <div className="mfc-section">
      <p className="mfc-section-label">{title}</p>
      {subtitle && <p className="mfc-section-sub">{subtitle}</p>}
      {countries.length === 0 ? (
        <p className="mfc-section-empty">{empty}</p>
      ) : (
        <div className="mfc-country-row">
          {countries.map(c => {
            const flag = countryFlag(c.country);
            return (
              <span key={c.country} className="mfc-country-chip">
                {flag && <span className="mfc-chip-flag">{flag}</span>}
                {c.country}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdvisorSection({ title, subtitle, rows, nameFor }) {
  return (
    <div className="mfc-section">
      <p className="mfc-section-label">{title}</p>
      {subtitle && <p className="mfc-section-sub">{subtitle}</p>}
      {rows.length === 0 ? (
        <p className="mfc-section-empty">No advisor opportunities yet.</p>
      ) : (
        <div className="mfc-advisor-list">
          {rows.map(r => {
            const flag = countryFlag(r.country);
            return (
              <div key={r.country} className="mfc-advisor-row">
                <span className="mfc-advisor-country">
                  {flag && <span className="mfc-chip-flag">{flag}</span>}
                  {r.country}
                </span>
                <span className="mfc-advisor-detail">
                  <strong>{r.visitedBy.map(nameFor).join(', ')}</strong>
                  {' could advise '}
                  <strong>{r.dreamersWhoHaventBeen.map(nameFor).join(', ')}</strong>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
