// MemoryDetail — right-side panel for viewing and editing a memory.

import { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';
import { countryFlag, countryFlagFromPlace } from '../utils/countryFlag';

// All recognized country names for the datalist dropdown
const KNOWN_COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Brazil',
  'Bulgaria','Cambodia','Canada','Chile','China','Colombia','Costa Rica',
  'Croatia','Cuba','Cyprus','Czechia','Denmark','Ecuador','Egypt','Estonia',
  'Ethiopia','Finland','France','Georgia','Germany','Ghana','Greece','Hungary',
  'Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kosovo','Kuwait','Latvia',
  'Lebanon','Lithuania','Luxembourg','Malaysia','Malta','Mexico','Moldova',
  'Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Nepal','Netherlands',
  'New Zealand','Nicaragua','Nigeria','Norway','Oman','Pakistan','Panama',
  'Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Singapore','Slovakia',
  'Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sweden',
  'Switzerland','Syria','Taiwan','Tanzania','Thailand','Tunisia','Turkey',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States',
  'Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
  'Maldives','Laos','Palestine','Cambodia',
];

/**
 * Parse an aiSummary string into bullet items, or return null for plain text.
 */
function parseSummary(aiSummary) {
  if (!aiSummary) return null;
  const lines = aiSummary.split('\n').map(l => l.trim()).filter(Boolean);
  const bulletLines = lines.filter(l => l.startsWith('\u2022') || l.startsWith('-') || l.startsWith('*'));
  if (bulletLines.length >= 2) {
    return bulletLines.map(l => l.replace(/^[\u2022\-*]\s*/, ''));
  }
  return null;
}

export default function MemoryDetail({ pin, isOpen, onClose, onUpdated, rank }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [addition, setAddition] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef(null);

  // Inline rating — always interactive
  const [liveRating, setLiveRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);
  const ratingDebounceRef = useRef(null);

  // Highlights inline edit
  const [editingHighlights, setEditingHighlights] = useState(false);
  const [highlightsText, setHighlightsText] = useState('');
  const [highlightsSaving, setHighlightsSaving] = useState(false);
  const [highlightsError, setHighlightsError] = useState('');

  // Details expander (year, companions, tags)
  const [showDetails, setShowDetails] = useState(false);
  const [editYear, setEditYear] = useState('');
  const [editCompanions, setEditCompanions] = useState([]);
  const [editTags, setEditTags] = useState([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSaved, setDetailsSaved] = useState(false);

  // Places editor
  const [placesInput, setPlacesInput] = useState('');
  const [placesResults, setPlacesResults] = useState([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesSaving, setPlacesSaving] = useState(false);
  const placesDebounceRef = useRef(null);

  // Countries picker
  const [countryInput, setCountryInput] = useState('');
  const [countrySaving, setCountrySaving] = useState(false);

  // Inline "tag a friend" flow (read-view, saves immediately)
  const [showTagFriend, setShowTagFriend] = useState(false);
  const [tagFriendQuery, setTagFriendQuery] = useState('');
  const [tagFriendResults, setTagFriendResults] = useState([]);
  const [tagFriendSearching, setTagFriendSearching] = useState(false);
  const [tagFriendStep, setTagFriendStep] = useState('search'); // 'search' | 'invite' | 'done'
  const [tagFriendInviteEmail, setTagFriendInviteEmail] = useState('');
  const [tagFriendInviteSending, setTagFriendInviteSending] = useState(false);
  const [tagFriendInviteName, setTagFriendInviteName] = useState('');
  const tagFriendDebounceRef = useRef(null);
  const tagFriendInputRef = useRef(null);

  // Companion search (used inside Edit details expander)
  const [companionSearch, setCompanionSearch] = useState('');
  const [companionResults, setCompanionResults] = useState([]);
  const [companionSearching, setCompanionSearching] = useState(false);
  const [showCompanionSearch, setShowCompanionSearch] = useState(false);
  const searchDebounceRef = useRef(null);

  // Seed state from pin
  useEffect(() => {
    if (pin) {
      setLiveRating(pin.rating || 0);
      setEditYear(pin.visitYear ? String(pin.visitYear) : '');
      setEditCompanions(pin.companions || []);
      setEditTags(pin.tags ? pin.tags.map(t => t.name || t) : []);
      setHighlightsText(pin.aiSummary || '');
    }
  }, [pin?.id]);

  // Reset panel on open/close
  useEffect(() => {
    if (isOpen) {
      setShowTranscript(false);
      setAddition('');
      setSaving(false);
      setSaveError('');
      setSaved(false);
      setEditingHighlights(false);
      setHighlightsError('');
      setShowDetails(false);
      setDetailsError('');
      setDetailsSaved(false);
      setShowTagPicker(false);
      setShowCompanionSearch(false);
      setCompanionSearch('');
      setShowTagFriend(false);
      setTagFriendQuery('');
      setTagFriendResults([]);
      setTagFriendStep('search');
      setTagFriendInviteEmail('');
      setTagFriendInviteName('');
      setPlacesInput('');
      setPlacesResults([]);
      setCountryInput('');
    }
  }, [isOpen, pin?.id]);

  // Debounced user search for companions
  useEffect(() => {
    if (!companionSearch.trim()) {
      setCompanionResults([]);
      return;
    }
    clearTimeout(searchDebounceRef.current);
    setCompanionSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(companionSearch.trim())}`);
        setCompanionResults(res.data || []);
      } catch {
        setCompanionResults([]);
      } finally {
        setCompanionSearching(false);
      }
    }, 350);
  }, [companionSearch]);

  // Debounced search for "tag a friend" flow
  useEffect(() => {
    if (!tagFriendQuery.trim()) {
      setTagFriendResults([]);
      return;
    }
    clearTimeout(tagFriendDebounceRef.current);
    setTagFriendSearching(true);
    tagFriendDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(tagFriendQuery.trim())}`);
        setTagFriendResults(res.data || []);
      } catch {
        setTagFriendResults([]);
      } finally {
        setTagFriendSearching(false);
      }
    }, 350);
  }, [tagFriendQuery]);

  // Debounced Google Places autocomplete
  useEffect(() => {
    if (!placesInput.trim() || placesInput.trim().length < 2) {
      setPlacesResults([]);
      return;
    }
    clearTimeout(placesDebounceRef.current);
    setPlacesLoading(true);
    placesDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/places/autocomplete?q=${encodeURIComponent(placesInput.trim())}`);
        setPlacesResults(res.data || []);
      } catch {
        setPlacesResults([]);
      } finally {
        setPlacesLoading(false);
      }
    }, 350);
  }, [placesInput]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) {
      if (e.key === 'Escape') {
        if (showTagFriend) { closeTagFriend(); return; }
        if (editingHighlights) { setEditingHighlights(false); return; }
        if (showDetails) { setShowDetails(false); return; }
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, showTagFriend, editingHighlights, showDetails]);

  if (!pin) return null;

  const summaryBullets = parseSummary(pin.aiSummary);

  // ---- Places helpers ----
  async function handleSelectPlace(suggestion) {
    if (placesSaving) return;
    setPlacesSaving(true);
    try {
      await api.post(`/pins/${pin.id}/locations`, { placeName: suggestion.description });
      setPlacesInput('');
      setPlacesResults([]);
      if (onUpdated) onUpdated();
    } catch { /* silent */ } finally {
      setPlacesSaving(false);
    }
  }

  async function handleAddPlaceManual() {
    const name = placesInput.trim();
    if (!name || placesSaving) return;
    setPlacesSaving(true);
    try {
      await api.post(`/pins/${pin.id}/locations`, { placeName: name });
      setPlacesInput('');
      setPlacesResults([]);
      if (onUpdated) onUpdated();
    } catch { /* silent */ } finally {
      setPlacesSaving(false);
    }
  }

  async function handleRemovePlace(locId) {
    try {
      await api.delete(`/pins/${pin.id}/locations/${locId}`);
      if (onUpdated) onUpdated();
    } catch { /* silent */ }
  }

  // ---- Countries helpers ----
  const countryMatches = countryInput.trim().length > 0
    ? KNOWN_COUNTRIES.filter(c =>
        c.toLowerCase().startsWith(countryInput.toLowerCase()) &&
        !(pin.countries || []).includes(c)
      ).slice(0, 7)
    : [];

  async function handleAddCountry(country) {
    if (countrySaving) return;
    const current = pin.countries || [];
    if (current.includes(country)) { setCountryInput(''); return; }
    setCountrySaving(true);
    try {
      await api.put(`/pins/${pin.id}`, { countries: [...current, country] });
      setCountryInput('');
      if (onUpdated) onUpdated();
    } catch { /* silent */ } finally {
      setCountrySaving(false);
    }
  }

  async function handleRemoveCountry(country) {
    if (countrySaving) return;
    const updated = (pin.countries || []).filter(c => c !== country);
    setCountrySaving(true);
    try {
      await api.put(`/pins/${pin.id}`, { countries: updated });
      if (onUpdated) onUpdated();
    } catch { /* silent */ } finally {
      setCountrySaving(false);
    }
  }

  // ---- Tag a friend helpers ----
  function closeTagFriend() {
    setShowTagFriend(false);
    setTagFriendQuery('');
    setTagFriendResults([]);
    setTagFriendStep('search');
    setTagFriendInviteEmail('');
    setTagFriendInviteName('');
  }

  async function handleTagFriendSelect(user) {
    const label = user.display_name || user.username;
    const current = pin.companions || [];
    if (current.includes(label)) { closeTagFriend(); return; }
    const updated = [...current, label];
    try {
      await api.put(`/pins/${pin.id}`, { companions: updated });
      if (onUpdated) onUpdated();
      // Update local edit-details state too so it stays in sync
      setEditCompanions(updated);
    } catch { /* silent — onUpdated refresh will correct */ }
    closeTagFriend();
  }

  async function handleTagFriendInvite() {
    const email = tagFriendInviteEmail.trim();
    if (!email) return;
    setTagFriendInviteSending(true);
    try {
      await api.post('/invites/send', { email });
      setTagFriendStep('done');
    } catch { /* still show done so UX doesn't break if SMTP not wired */
      setTagFriendStep('done');
    } finally {
      setTagFriendInviteSending(false);
    }
  }

  const tagFriendNoResults =
    tagFriendQuery.trim().length > 1 && !tagFriendSearching && tagFriendResults.length === 0;
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tagFriendQuery.trim());

  // ---- Rating (always interactive, auto-save) ----
  async function handleRatingClick(v) {
    const next = v === liveRating ? 0 : v;
    setLiveRating(next);
    clearTimeout(ratingDebounceRef.current);
    ratingDebounceRef.current = setTimeout(async () => {
      try {
        await api.put(`/pins/${pin.id}`, { rating: next || null });
        setRatingSaved(true);
        setTimeout(() => setRatingSaved(false), 1500);
        if (onUpdated) onUpdated();
      } catch { /* silent */ }
    }, 400);
  }

  // ---- Highlights save ----
  async function handleSaveHighlights() {
    setHighlightsSaving(true);
    setHighlightsError('');
    try {
      await api.put(`/pins/${pin.id}`, { aiSummary: highlightsText });
      setEditingHighlights(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setHighlightsError(err.message || 'Could not save.');
    } finally {
      setHighlightsSaving(false);
    }
  }

  // ---- Details save ----
  async function handleSaveDetails() {
    setDetailsSaving(true);
    setDetailsError('');
    try {
      const tagPayload = tagNamesToPayload(editTags);
      await api.put(`/pins/${pin.id}`, {
        visitYear: editYear ? parseInt(editYear, 10) : null,
        companions: editCompanions,
        tags: tagPayload,
      });
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 1500);
      setShowDetails(false);
      setShowTagPicker(false);
      setShowCompanionSearch(false);
      setCompanionSearch('');
      if (onUpdated) onUpdated();
    } catch (err) {
      setDetailsError(err.message || 'Could not save changes.');
    } finally {
      setDetailsSaving(false);
    }
  }

  // ---- Add note ----
  async function handleSaveAddition() {
    if (!addition.trim()) return;
    setSaving(true);
    setSaveError('');
    try {
      const existing = pin.note || '';
      const updated = existing ? existing + '\n\n' + addition.trim() : addition.trim();
      await api.put(`/pins/${pin.id}`, { note: updated });
      setSaved(true);
      setAddition('');
      setTimeout(() => setSaved(false), 2000);
      if (onUpdated) onUpdated();
    } catch (err) {
      setSaveError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ---- Companion helpers ----
  function isPresetActive(label) { return editCompanions.includes(label); }
  function togglePreset(label) {
    setEditCompanions(prev =>
      prev.includes(label) ? prev.filter(x => x !== label) : [...prev, label]
    );
  }
  function removeCompanion(name) {
    setEditCompanions(prev => prev.filter(x => x !== name));
  }
  function addUserCompanion(user) {
    const label = user.display_name || user.username;
    if (!editCompanions.includes(label)) {
      setEditCompanions(prev => [...prev, label]);
    }
    setCompanionSearch('');
    setCompanionResults([]);
    setShowCompanionSearch(false);
  }

  const noCompanionResults = companionSearch.trim().length > 1 && !companionSearching && companionResults.length === 0;

  return (
    <>
      <style>{`
        /* ---- Countries & Places pickers ---- */
        .md-picker-section { margin-bottom: 16px; }
        .md-chip-list {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
        }
        .md-picker-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 8px 4px 10px; border-radius: 16px;
          background: rgba(250,250,250,0.07); border: 1px solid rgba(250,250,250,0.15);
          color: rgba(250,250,250,0.8); font-size: 13px;
        }
        .md-picker-chip-flag { font-size: 15px; line-height: 1; }
        .md-picker-chip-remove {
          background: none; border: none; cursor: pointer;
          color: rgba(250,250,250,0.4); padding: 0 0 0 2px;
          font-size: 14px; line-height: 1; transition: color 0.12s;
        }
        .md-picker-chip-remove:hover { color: rgba(250,250,250,0.9); }
        /* Input + dropdown wrapper */
        .md-picker-input-wrap { position: relative; }
        .md-picker-input {
          width: 100%; background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18); border-radius: 8px;
          color: rgba(250,250,250,0.9); padding: 8px 12px; font-size: 13px;
          outline: none; box-sizing: border-box; transition: border-color 0.18s;
        }
        .md-picker-input:focus { border-color: rgba(201,168,76,0.45); }
        .md-picker-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-picker-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #1e1e1e; border: 1px solid rgba(250,250,250,0.12);
          border-radius: 10px; overflow: hidden; z-index: 300;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .md-picker-option {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 13px; cursor: pointer; font-size: 13px;
          color: rgba(250,250,250,0.85); transition: background 0.12s;
        }
        .md-picker-option:hover { background: rgba(201,168,76,0.1); }
        .md-picker-option-flag { font-size: 16px; line-height: 1; flex-shrink: 0; }
        .md-picker-option-icon { font-size: 14px; flex-shrink: 0; opacity: 0.6; }
        .md-picker-option-main { font-weight: 500; }
        .md-picker-option-sub { color: rgba(250,250,250,0.45); font-size: 12px; }
        .md-picker-loading { padding: 10px 13px; font-size: 12px; color: rgba(250,250,250,0.4); }

        /* ---- Tag a friend (inline, read-view) ---- */
        .md-tag-friend-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
        }
        .md-tag-friend-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 20px;
          border: 1px dashed rgba(201,168,76,0.35);
          background: transparent;
          color: rgba(201,168,76,0.6);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.18s;
          letter-spacing: 0.02em;
        }
        .md-tag-friend-btn:hover {
          border-color: var(--gold);
          color: var(--gold);
          background: rgba(201,168,76,0.06);
        }
        .md-tf-wrap {
          border: 1px solid rgba(201,168,76,0.2);
          border-radius: 12px;
          background: rgba(201,168,76,0.04);
          padding: 12px 14px;
          margin-top: 8px;
        }
        .md-tf-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .md-tf-title {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(250,250,250,0.4);
          font-weight: 600;
        }
        .md-tf-close {
          background: none; border: none; cursor: pointer;
          color: rgba(250,250,250,0.3); font-size: 16px; padding: 0;
          line-height: 1; transition: color 0.15s;
        }
        .md-tf-close:hover { color: rgba(250,250,250,0.7); }
        .md-tf-search-wrap { position: relative; }
        .md-tf-input {
          width: 100%;
          background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18);
          border-radius: 8px;
          color: rgba(250,250,250,0.9);
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s;
        }
        .md-tf-input:focus { border-color: rgba(201,168,76,0.5); }
        .md-tf-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-tf-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #1c1c1c; border: 1px solid rgba(250,250,250,0.12);
          border-radius: 10px; overflow: hidden; z-index: 300;
          box-shadow: 0 10px 30px rgba(0,0,0,0.6);
        }
        .md-tf-result {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; cursor: pointer; transition: background 0.12s;
        }
        .md-tf-result:hover { background: rgba(201,168,76,0.08); }
        .md-tf-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: rgba(201,168,76,0.2); display: flex;
          align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600;
          overflow: hidden; flex-shrink: 0;
          color: var(--gold);
        }
        .md-tf-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .md-tf-name { font-size: 14px; color: rgba(250,250,250,0.9); font-weight: 500; }
        .md-tf-username { font-size: 12px; color: rgba(250,250,250,0.4); margin-top: 1px; }
        .md-tf-no-results {
          padding: 10px 14px; font-size: 13px; color: rgba(250,250,250,0.4);
        }
        .md-tf-invite-prompt {
          margin-top: 10px;
        }
        .md-tf-invite-label {
          font-size: 12px; color: rgba(250,250,250,0.5); margin-bottom: 8px; line-height: 1.5;
        }
        .md-tf-invite-label strong { color: rgba(250,250,250,0.8); }
        .md-tf-invite-row { display: flex; gap: 8px; }
        .md-tf-email-input {
          flex: 1;
          background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18);
          border-radius: 8px;
          color: rgba(250,250,250,0.9);
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.18s;
        }
        .md-tf-email-input:focus { border-color: rgba(201,168,76,0.45); }
        .md-tf-email-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-tf-send-btn {
          padding: 8px 16px; border-radius: 8px;
          background: var(--gold); color: var(--black);
          border: none; font-size: 12px; font-weight: 700;
          cursor: pointer; white-space: nowrap; letter-spacing: 0.04em;
        }
        .md-tf-send-btn:disabled { opacity: 0.5; cursor: default; }
        .md-tf-done {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 0 2px;
          font-size: 13px; color: var(--gold);
        }
        .md-tf-searching { padding: 10px 14px; font-size: 13px; color: rgba(250,250,250,0.4); }

        /* ---- Inline hearts ---- */
        .md-hearts-row {
          display: flex;
          align-items: center;
          gap: 2px;
        }
        .md-heart-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 18px;
          padding: 2px 3px;
          opacity: 0.35;
          transition: opacity 0.15s, transform 0.12s;
          line-height: 1;
        }
        .md-heart-btn.filled { opacity: 1; }
        .md-heart-btn:hover { opacity: 0.9; transform: scale(1.15); }
        .md-rating-saved {
          font-size: 11px;
          color: var(--gold);
          margin-left: 6px;
          letter-spacing: 0.04em;
          animation: mdFadeIn 0.2s ease;
        }
        @keyframes mdFadeIn { from { opacity: 0; } to { opacity: 1; } }

        /* ---- Highlights inline edit ---- */
        .md-highlights-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .md-highlights-edit-btn {
          background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18);
          cursor: pointer;
          color: rgba(250,250,250,0.65);
          font-size: 12px;
          padding: 3px 10px;
          border-radius: 6px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .md-highlights-edit-btn:hover {
          color: var(--gold);
          border-color: rgba(201,168,76,0.45);
          background: rgba(201,168,76,0.08);
        }
        .md-highlights-textarea {
          width: 100%;
          background: rgba(201,168,76,0.05);
          border: 1px solid rgba(201,168,76,0.3);
          border-radius: 8px;
          color: rgba(250,250,250,0.9);
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.6;
          font-family: inherit;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
          min-height: 80px;
        }
        .md-highlights-textarea:focus { border-color: rgba(201,168,76,0.55); }
        .md-highlights-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 8px;
        }
        .md-hl-save-btn {
          padding: 7px 18px;
          border-radius: 7px;
          background: var(--gold);
          color: var(--black);
          border: none;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.04em;
        }
        .md-hl-save-btn:disabled { opacity: 0.5; cursor: default; }
        .md-hl-cancel-btn {
          padding: 7px 14px;
          border-radius: 7px;
          background: none;
          color: rgba(250,250,250,0.45);
          border: 1px solid rgba(250,250,250,0.15);
          font-size: 12px;
          cursor: pointer;
        }
        .md-hl-error { font-size: 12px; color: #ff6b6b; }

        /* ---- Edit details expander ---- */
        .md-details-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(250,250,250,0.3);
          font-size: 12px;
          letter-spacing: 0.05em;
          padding: 6px 0;
          transition: color 0.15s;
          margin-top: 8px;
        }
        .md-details-toggle:hover { color: rgba(250,250,250,0.65); }
        .md-details-toggle svg {
          transition: transform 0.2s;
        }
        .md-details-toggle.open svg { transform: rotate(180deg); }
        .md-details-expand {
          border-top: 1px solid rgba(250,250,250,0.07);
          padding-top: 16px;
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .md-det-label {
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(250,250,250,0.35);
          margin-bottom: 8px;
          font-weight: 500;
        }
        .md-det-year-input {
          background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18);
          border-radius: 6px;
          color: rgba(250,250,250,0.9);
          padding: 7px 10px;
          font-size: 14px;
          width: 110px;
          outline: none;
        }
        .md-det-year-input:focus { border-color: rgba(201,168,76,0.45); }
        .md-det-preset-row { display: flex; gap: 8px; }
        .md-det-preset-btn {
          flex: 1;
          padding: 8px 0;
          border-radius: 8px;
          border: 1.5px solid rgba(250,250,250,0.18);
          background: rgba(250,250,250,0.05);
          color: rgba(250,250,250,0.6);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.18s;
        }
        .md-det-preset-btn.active {
          background: var(--gold);
          color: var(--black);
          border-color: var(--gold);
          font-weight: 700;
        }
        .md-det-companion-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
        .md-det-companion-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 8px 4px 10px; border-radius: 16px;
          background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3);
          color: var(--gold); font-size: 13px;
        }
        .md-det-chip-remove {
          background: none; border: none; cursor: pointer;
          color: inherit; opacity: 0.55; padding: 0; font-size: 14px;
        }
        .md-det-chip-remove:hover { opacity: 1; }
        .md-det-search-wrap { position: relative; }
        .md-det-search-input {
          width: 100%; background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18); border-radius: 8px;
          color: rgba(250,250,250,0.9); padding: 8px 12px; font-size: 13px;
          outline: none; box-sizing: border-box;
        }
        .md-det-search-input:focus { border-color: rgba(201,168,76,0.4); }
        .md-det-search-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-det-search-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: #1c1c1c; border: 1px solid rgba(250,250,250,0.12);
          border-radius: 8px; overflow: hidden; z-index: 200;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .md-det-search-result {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; cursor: pointer; transition: background 0.12s;
        }
        .md-det-search-result:hover { background: rgba(250,250,250,0.07); }
        .md-det-result-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(201,168,76,0.2); display: flex; align-items: center;
          justify-content: center; font-size: 12px; overflow: hidden; flex-shrink: 0;
        }
        .md-det-result-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .md-det-no-results { padding: 10px 12px; font-size: 12px; color: rgba(250,250,250,0.4); }
        .md-det-add-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 7px;
          border: 1px dashed rgba(250,250,250,0.22); background: none;
          color: rgba(250,250,250,0.45); font-size: 12px; cursor: pointer;
          transition: all 0.15s;
        }
        .md-det-add-btn:hover { border-color: rgba(250,250,250,0.42); color: rgba(250,250,250,0.75); }
        .md-det-tags-toggle {
          display: inline-flex; align-items: center; gap: 5px;
          background: none; border: 1px dashed rgba(250,250,250,0.22);
          color: rgba(250,250,250,0.45); font-size: 12px;
          padding: 5px 10px; border-radius: 7px; cursor: pointer;
          transition: all 0.15s; margin-top: 6px;
        }
        .md-det-tags-toggle:hover { border-color: var(--gold); color: var(--gold); }
        .md-details-actions {
          display: flex; gap: 8px; align-items: center;
          padding-top: 4px;
        }
        .md-det-save-btn {
          padding: 9px 20px; border-radius: 7px;
          background: var(--gold); color: var(--black);
          border: none; font-size: 12px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.04em;
        }
        .md-det-save-btn:disabled { opacity: 0.5; cursor: default; }
        .md-det-cancel-btn {
          padding: 9px 14px; border-radius: 7px; background: none;
          color: rgba(250,250,250,0.45); border: 1px solid rgba(250,250,250,0.15);
          font-size: 12px; cursor: pointer;
        }
        .md-det-saved { font-size: 12px; color: var(--gold); }
        .md-det-error { font-size: 12px; color: #ff6b6b; }
      `}</style>

      {/* Backdrop */}
      <div
        className={`md-backdrop${isOpen ? ' md-backdrop-visible' : ''}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside className={`md-panel${isOpen ? ' md-panel-open' : ''}`}>

        {/* Header */}
        <div className="md-header">
          <button className="md-close" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {pin.imageUrl ? (
            <div className="md-hero-img" style={{ backgroundImage: `url(${pin.imageUrl})` }} />
          ) : (
            <div
              className="md-hero-gradient"
              style={{
                background: pin.gradientStart && pin.gradientEnd
                  ? `linear-gradient(135deg, ${pin.gradientStart}, ${pin.gradientEnd})`
                  : 'linear-gradient(135deg, #4a3728, #8B6914)',
              }}
            >
              <span className="md-hero-emoji">{pin.emoji || '🌍'}</span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="md-body">

          {/* Place + meta */}
          <div className="md-title-block">
            {rank != null && (
              <div className="md-rank-badge">#{rank}</div>
            )}
            <h2 className="md-place">{pin.placeName}</h2>
            <div className="md-meta-row" style={{ alignItems: 'center', gap: 12 }}>
              {pin.visitYear && <span className="md-meta-item">{pin.visitYear}</span>}

              {/* Hearts — always interactive */}
              <div className="md-hearts-row">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`md-heart-btn ${v <= liveRating ? 'filled' : ''}`}
                    onClick={() => handleRatingClick(v)}
                    title={`Rate ${v}`}
                  >
                    {v <= liveRating ? '❤️' : '🫶'}
                  </button>
                ))}
                {ratingSaved && <span className="md-rating-saved">saved</span>}
              </div>
            </div>
          </div>

          {/* Countries */}
          <div className="md-picker-section">
            <p className="md-section-label" style={{ marginBottom: 8 }}>Countries</p>
            {/* Existing country chips */}
            {(pin.countries || []).length > 0 && (
              <div className="md-chip-list">
                {(pin.countries || []).map(c => (
                  <span key={c} className="md-picker-chip">
                    <span className="md-picker-chip-flag">{countryFlag(c) || '🌍'}</span>
                    {c}
                    <button
                      type="button"
                      className="md-picker-chip-remove"
                      onClick={() => handleRemoveCountry(c)}
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            {/* Autocomplete input */}
            <div className="md-picker-input-wrap">
              <input
                type="text"
                className="md-picker-input"
                placeholder="Add a country…"
                value={countryInput}
                onChange={e => setCountryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && countryMatches.length > 0) handleAddCountry(countryMatches[0]);
                  if (e.key === 'Escape') setCountryInput('');
                }}
                autoComplete="off"
              />
              {countryMatches.length > 0 && (
                <div className="md-picker-dropdown">
                  {countryMatches.map(c => (
                    <div
                      key={c}
                      className="md-picker-option"
                      onMouseDown={e => { e.preventDefault(); handleAddCountry(c); }}
                    >
                      <span className="md-picker-option-flag">{countryFlag(c) || '🌍'}</span>
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Places */}
          <div className="md-picker-section">
            <p className="md-section-label" style={{ marginBottom: 8 }}>Places</p>
            {/* Existing stop locations */}
            {(pin.locations || []).length > 0 && (
              <div className="md-chip-list">
                {(pin.locations || []).map(loc => {
                  const locFlag = loc.normalizedCountry
                    ? countryFlag(loc.normalizedCountry)
                    : null;
                  return (
                    <span key={loc.id} className="md-picker-chip">
                      {locFlag && <span className="md-picker-chip-flag">{locFlag}</span>}
                      {loc.placeName}
                      <button
                        type="button"
                        className="md-picker-chip-remove"
                        onClick={() => handleRemovePlace(loc.id)}
                      >×</button>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Google Places autocomplete input */}
            <div className="md-picker-input-wrap">
              <input
                type="text"
                className="md-picker-input"
                placeholder="Search for a place…"
                value={placesInput}
                onChange={e => setPlacesInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && placesResults.length === 0 && placesInput.trim()) handleAddPlaceManual();
                  if (e.key === 'Escape') { setPlacesInput(''); setPlacesResults([]); }
                }}
                autoComplete="off"
              />
              {(placesLoading || placesResults.length > 0) && (
                <div className="md-picker-dropdown">
                  {placesLoading && (
                    <div className="md-picker-loading">Searching…</div>
                  )}
                  {!placesLoading && placesResults.map(r => (
                    <div
                      key={r.placeId}
                      className="md-picker-option"
                      onMouseDown={e => { e.preventDefault(); handleSelectPlace(r); }}
                    >
                      <span className="md-picker-option-icon">📍</span>
                      <span>
                        <span className="md-picker-option-main">{r.mainText}</span>
                        {r.secondaryText && (
                          <span className="md-picker-option-sub"> {r.secondaryText}</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {!placesLoading && placesResults.length === 0 && placesInput.trim().length > 1 && (
                    <div
                      className="md-picker-option"
                      onMouseDown={e => { e.preventDefault(); handleAddPlaceManual(); }}
                    >
                      <span className="md-picker-option-icon">＋</span>
                      Add &ldquo;{placesInput.trim()}&rdquo;
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Companions + tag-a-friend */}
          <div>
            {pin.companions && pin.companions.length > 0 && (
              <div className="md-chips-row" style={{ marginBottom: 6 }}>
                {pin.companions.map(c => (
                  <span key={c} className="md-chip">{c}</span>
                ))}
              </div>
            )}

            {/* Tag a friend inline flow */}
            {!showTagFriend ? (
              <div className="md-tag-friend-row">
                <button
                  type="button"
                  className="md-tag-friend-btn"
                  onClick={() => { setShowTagFriend(true); setTimeout(() => tagFriendInputRef.current?.focus(), 50); }}
                >
                  👤 Tag a friend
                </button>
              </div>
            ) : (
              <div className="md-tf-wrap">
                <div className="md-tf-header">
                  <span className="md-tf-title">Tag a friend</span>
                  <button type="button" className="md-tf-close" onClick={closeTagFriend}>×</button>
                </div>

                {tagFriendStep === 'search' && (
                  <div className="md-tf-search-wrap">
                    <input
                      ref={tagFriendInputRef}
                      type="text"
                      className="md-tf-input"
                      placeholder="Search by name or username…"
                      value={tagFriendQuery}
                      onChange={e => setTagFriendQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') closeTagFriend(); }}
                    />

                    {tagFriendQuery.trim().length > 0 && (
                      <div className="md-tf-dropdown">
                        {tagFriendSearching && (
                          <div className="md-tf-searching">Searching…</div>
                        )}
                        {!tagFriendSearching && tagFriendResults.map(user => (
                          <div
                            key={user.id}
                            className="md-tf-result"
                            onClick={() => handleTagFriendSelect(user)}
                          >
                            <div className="md-tf-avatar">
                              {user.avatar_url
                                ? <img src={user.avatar_url} alt={user.display_name} />
                                : (user.display_name || user.username || '?')[0].toUpperCase()
                              }
                            </div>
                            <div>
                              <div className="md-tf-name">{user.display_name || user.username}</div>
                              {user.username && <div className="md-tf-username">@{user.username}</div>}
                            </div>
                          </div>
                        ))}
                        {tagFriendNoResults && (
                          <div className="md-tf-no-results">
                            No users found for &ldquo;{tagFriendQuery}&rdquo;
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prompt to invite when no results */}
                    {tagFriendNoResults && (
                      <div className="md-tf-invite-prompt">
                        <p className="md-tf-invite-label">
                          <strong>{tagFriendQuery}</strong> isn&rsquo;t on Travel Together yet.
                          Send them an invite to view your profile and join.
                        </p>
                        <div className="md-tf-invite-row">
                          <input
                            type="email"
                            className="md-tf-email-input"
                            placeholder="their@email.com"
                            value={tagFriendInviteEmail || (looksLikeEmail ? tagFriendQuery : '')}
                            onChange={e => setTagFriendInviteEmail(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleTagFriendInvite(); }}
                          />
                          <button
                            type="button"
                            className="md-tf-send-btn"
                            onClick={handleTagFriendInvite}
                            disabled={tagFriendInviteSending || !tagFriendInviteEmail.trim()}
                          >
                            {tagFriendInviteSending ? 'Sending…' : 'Invite'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tagFriendStep === 'done' && (
                  <div className="md-tf-done">
                    <span style={{ fontSize: 18 }}>✓</span>
                    Invite sent! They&rsquo;ll get a link to your profile.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          {pin.tags && pin.tags.length > 0 && (
            <div className="md-chips-row">
              {pin.tags.map(t => (
                <span key={t.id || t.name} className="md-tag-chip">
                  {t.emoji ? `${t.emoji} ` : ''}{t.name}
                </span>
              ))}
            </div>
          )}

          {/* Highlights — always visible, inline edit via pencil */}
          <div className="md-section">
            <div className="md-highlights-header">
              <p className="md-section-label" style={{ marginBottom: 0 }}>Highlights</p>
              {!editingHighlights && (
                <button
                  className="md-highlights-edit-btn"
                  onClick={() => {
                    setHighlightsText(pin.aiSummary || '');
                    setEditingHighlights(true);
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M8.5 1.5l2 2L3 11H1v-2L8.5 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Edit
                </button>
              )}
            </div>

            {editingHighlights ? (
              <>
                <textarea
                  autoFocus
                  className="md-highlights-textarea"
                  value={highlightsText}
                  onChange={e => setHighlightsText(e.target.value)}
                  rows={5}
                  placeholder="- What made it special&#10;- Key moments"
                />
                <div className="md-highlights-actions">
                  <button
                    className="md-hl-cancel-btn"
                    onClick={() => setEditingHighlights(false)}
                    disabled={highlightsSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="md-hl-save-btn"
                    onClick={handleSaveHighlights}
                    disabled={highlightsSaving}
                  >
                    {highlightsSaving ? 'Saving…' : 'Done'}
                  </button>
                  {highlightsError && <span className="md-hl-error">{highlightsError}</span>}
                </div>
              </>
            ) : pin.aiSummary ? (
              summaryBullets ? (
                <ul className="md-bullet-list">
                  {summaryBullets.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              ) : (
                <p className="md-body-text">{pin.aiSummary}</p>
              )
            ) : (
              <button
                className="md-highlights-edit-btn"
                style={{ color: 'rgba(250,250,250,0.25)', fontSize: 13, padding: '2px 0' }}
                onClick={() => { setHighlightsText(''); setEditingHighlights(true); }}
              >
                + Add highlights…
              </button>
            )}
          </div>

          {/* Note */}
          {pin.note && (
            <div className="md-section">
              <p className="md-section-label">Notes</p>
              <p className="md-body-text md-note-text">{pin.note}</p>
            </div>
          )}

          {/* Add note */}
          <div className="md-section md-add-section">
            <p className="md-section-label">Add to this memory</p>
            <textarea
              ref={textareaRef}
              className="md-textarea"
              value={addition}
              onChange={e => setAddition(e.target.value)}
              placeholder="More details, a follow-up thought, something you forgot to mention…"
              rows={3}
            />
            <div className="md-add-actions">
              {saveError && <span className="md-save-error">{saveError}</span>}
              {saved && <span className="md-save-ok">Saved</span>}
              <button
                className="md-save-btn"
                onClick={handleSaveAddition}
                disabled={!addition.trim() || saving}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          {/* Edit details toggle (year, companions, tags) */}
          <button
            className={`md-details-toggle${showDetails ? ' open' : ''}`}
            onClick={() => setShowDetails(v => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit details
          </button>

          {showDetails && (
            <div className="md-details-expand">

              {/* Year */}
              <div>
                <p className="md-det-label">Year visited</p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="md-det-year-input"
                  value={editYear}
                  onChange={e => setEditYear(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 2024"
                />
              </div>

              {/* Companions */}
              <div>
                <p className="md-det-label">With whom</p>
                <div className="md-det-preset-row" style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className={`md-det-preset-btn ${isPresetActive('Solo') ? 'active' : ''}`}
                    onClick={() => togglePreset('Solo')}
                  >🧍 Solo</button>
                  <button
                    type="button"
                    className={`md-det-preset-btn ${isPresetActive('Family') ? 'active' : ''}`}
                    onClick={() => togglePreset('Family')}
                  >👨‍👩‍👧 Family</button>
                </div>

                {editCompanions.filter(c => c !== 'Solo' && c !== 'Family').length > 0 && (
                  <div className="md-det-companion-chips">
                    {editCompanions.filter(c => c !== 'Solo' && c !== 'Family').map(c => (
                      <span key={c} className="md-det-companion-chip">
                        {c}
                        <button type="button" className="md-det-chip-remove" onClick={() => removeCompanion(c)}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {showCompanionSearch ? (
                  <div className="md-det-search-wrap">
                    <input
                      autoFocus
                      type="text"
                      className="md-det-search-input"
                      placeholder="Search by name or username…"
                      value={companionSearch}
                      onChange={e => setCompanionSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') { setShowCompanionSearch(false); setCompanionSearch(''); }
                      }}
                    />
                    {companionSearch.trim().length > 0 && (
                      <div className="md-det-search-dropdown">
                        {companionSearching && <div className="md-det-no-results">Searching…</div>}
                        {!companionSearching && companionResults.map(user => (
                          <div key={user.id} className="md-det-search-result" onClick={() => addUserCompanion(user)}>
                            <div className="md-det-result-avatar">
                              {user.avatar_url
                                ? <img src={user.avatar_url} alt={user.display_name} />
                                : (user.display_name || user.username || '?')[0].toUpperCase()
                              }
                            </div>
                            <div>
                              <div style={{ fontSize: 13, color: 'rgba(250,250,250,0.9)', fontWeight: 500 }}>
                                {user.display_name || user.username}
                              </div>
                              {user.username && (
                                <div style={{ fontSize: 11, color: 'rgba(250,250,250,0.4)' }}>@{user.username}</div>
                              )}
                            </div>
                          </div>
                        ))}
                        {noCompanionResults && <div className="md-det-no-results">No users found</div>}
                      </div>
                    )}
                  </div>
                ) : (
                  <button type="button" className="md-det-add-btn" onClick={() => setShowCompanionSearch(true)}>
                    + Add a friend
                  </button>
                )}
              </div>

              {/* Tags */}
              <div>
                <p className="md-det-label">Tags</p>
                {editTags.length > 0 && !showTagPicker && (
                  <div className="md-chips-row" style={{ marginBottom: 6 }}>
                    {editTags.map(t => (
                      <span key={t} className="md-tag-chip">{t}</span>
                    ))}
                  </div>
                )}
                {showTagPicker ? (
                  <>
                    <TagPicker selectedTags={editTags} onTagsChange={setEditTags} />
                    <button
                      type="button"
                      className="md-det-tags-toggle"
                      style={{ marginTop: 8 }}
                      onClick={() => setShowTagPicker(false)}
                    >
                      Done
                    </button>
                  </>
                ) : (
                  <button type="button" className="md-det-tags-toggle" onClick={() => setShowTagPicker(true)}>
                    ✏️ Edit tags
                  </button>
                )}
              </div>

              {/* Save/cancel */}
              <div className="md-details-actions">
                <button
                  type="button"
                  className="md-det-cancel-btn"
                  onClick={() => {
                    setShowDetails(false);
                    setEditYear(pin.visitYear ? String(pin.visitYear) : '');
                    setEditCompanions(pin.companions || []);
                    setEditTags(pin.tags ? pin.tags.map(t => t.name || t) : []);
                    setShowTagPicker(false);
                    setShowCompanionSearch(false);
                    setCompanionSearch('');
                    setDetailsError('');
                  }}
                  disabled={detailsSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="md-det-save-btn"
                  onClick={handleSaveDetails}
                  disabled={detailsSaving}
                >
                  {detailsSaving ? 'Saving…' : 'Save changes'}
                </button>
                {detailsSaved && <span className="md-det-saved">Saved ✓</span>}
                {detailsError && <span className="md-det-error">{detailsError}</span>}
              </div>
            </div>
          )}

          {/* Transcript (collapsible) */}
          {pin.transcript && (
            <div className="md-section" style={{ marginTop: 16 }}>
              <button
                className="md-transcript-toggle"
                onClick={() => setShowTranscript(v => !v)}
              >
                {showTranscript ? 'Hide transcript' : 'Show original transcript'}
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  style={{ transform: showTranscript ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {showTranscript && (
                <p className="md-transcript-text">{pin.transcript}</p>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
