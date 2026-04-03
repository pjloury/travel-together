// MemoryDetail — right-side panel for viewing and editing a memory.

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';
import { countryFlag } from '../utils/countryFlag';

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

// Track which pins are currently generating AI photos (persists across open/close)
const generatingPins = new Map(); // pinId → { generating: bool, subscribers: Set<fn> }

function useGeneratingPhoto(pinId) {
  const [generating, setGenerating] = useState(() => generatingPins.get(pinId)?.generating || false);

  useEffect(() => {
    if (!pinId) return;
    if (!generatingPins.has(pinId)) {
      generatingPins.set(pinId, { generating: false, subscribers: new Set() });
    }
    const entry = generatingPins.get(pinId);
    const subscriber = (val) => setGenerating(val);
    entry.subscribers.add(subscriber);
    setGenerating(entry.generating);
    return () => { entry.subscribers.delete(subscriber); };
  }, [pinId]);

  const setGen = useCallback((val) => {
    if (!pinId) return;
    const entry = generatingPins.get(pinId) || { generating: false, subscribers: new Set() };
    entry.generating = val;
    generatingPins.set(pinId, entry);
    entry.subscribers.forEach(fn => fn(val));
  }, [pinId]);

  return [generating, setGen];
}

export default function MemoryDetail({ pin, isOpen, onClose, onUpdated: _onUpdated, onPinChanged, rank, noBackdrop, readOnly }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [addition, setAddition] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const textareaRef = useRef(null);

  // Inline title edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState(pin?.placeName || '');
  const [titleSaving, setTitleSaving] = useState(false);
  const titleInputRef = useRef(null);

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

  // Optimistic local state — updated instantly; synced to server in background
  const [localCountries, setLocalCountries] = useState(pin?.countries || []);
  const [localLocations, setLocalLocations] = useState(pin?.locations || []);

  // AI photo regeneration — state tracked per pin ID so switching pins doesn't bleed
  const [generatingPhoto, setGeneratingPhoto] = useGeneratingPhoto(pin?.id);
  const [localImageUrl, setLocalImageUrl] = useState(pin?.photoUrl || pin?.unsplashImageUrl || null);

  // Inline "tag a friend" flow (read-view, saves immediately)
  const [showTagFriend, setShowTagFriend] = useState(false);
  const [tagFriendQuery, setTagFriendQuery] = useState('');
  const [tagFriendResults, setTagFriendResults] = useState([]);
  const [tagFriendSearching, setTagFriendSearching] = useState(false);
  const [tagFriendStep, setTagFriendStep] = useState('search'); // 'search' | 'invite' | 'done'
  const [tagFriendInviteEmail, setTagFriendInviteEmail] = useState('');
  const [tagFriendInviteSending, setTagFriendInviteSending] = useState(false);
  const [_tagFriendInviteName, setTagFriendInviteName] = useState('');
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
      setTitleText(pin.placeName || '');
      setEditingTitle(false);
      setEditYear(pin.visitYear ? String(pin.visitYear) : '');
      setEditCompanions(pin.companions || []);
      setEditTags(pin.tags ? pin.tags.map(t => t.name || t) : []);
      setHighlightsText(pin.aiSummary || '');
      setLocalCountries(pin.countries || []);
      setLocalLocations(pin.locations || []);
      setLocalImageUrl(pin.photoUrl || pin.unsplashImageUrl || null);
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
    // Use raw length so "New " (4 chars) isn't rejected by a trim check
    if (placesInput.length < 2) {
      setPlacesResults([]);
      return;
    }
    clearTimeout(placesDebounceRef.current);
    setPlacesLoading(true);
    placesDebounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/places/autocomplete?q=${encodeURIComponent(placesInput.trim())}`);
        setPlacesResults(Array.isArray(res) ? res : (res.data || res.suggestions || []));
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
    const placeName = suggestion.description || suggestion.mainText || '';
    const tempId = `temp-${Date.now()}`;
    const prevLocations = localLocations;
    // Optimistic: show immediately
    setLocalLocations(prev => [...prev, { id: tempId, placeName, normalizedCountry: null }]);
    setPlacesInput('');
    setPlacesResults([]);
    setPlacesSaving(true);
    try {
      const res = await api.post(`/pins/${pin.id}/locations`, { placeName: suggestion.description });
      const real = res.data || res;
      const updated = [...prevLocations, real];
      setLocalLocations(updated);
      if (onPinChanged) onPinChanged(pin.id, { locations: updated });
    } catch {
      setLocalLocations(prevLocations); // revert
    } finally {
      setPlacesSaving(false);
    }
  }

  async function handleAddPlaceManual() {
    const name = placesInput.trim();
    if (!name || placesSaving) return;
    const tempId = `temp-${Date.now()}`;
    const prevLocations = localLocations;
    // Optimistic: show immediately
    setLocalLocations(prev => [...prev, { id: tempId, placeName: name, normalizedCountry: null }]);
    setPlacesInput('');
    setPlacesResults([]);
    setPlacesSaving(true);
    try {
      const res = await api.post(`/pins/${pin.id}/locations`, { placeName: name });
      const real = res.data || res;
      const updated = [...prevLocations, real];
      setLocalLocations(updated);
      if (onPinChanged) onPinChanged(pin.id, { locations: updated });
    } catch {
      setLocalLocations(prevLocations); // revert
    } finally {
      setPlacesSaving(false);
    }
  }

  async function handleRemovePlace(locId) {
    const prevLocations = localLocations;
    // Optimistic: remove immediately
    setLocalLocations(prev => prev.filter(l => l.id !== locId));
    try {
      await api.delete(`/pins/${pin.id}/locations/${locId}`);
      const updated = prevLocations.filter(l => l.id !== locId);
      if (onPinChanged) onPinChanged(pin.id, { locations: updated });
    } catch {
      setLocalLocations(prevLocations); // revert
    }
  }

  // ---- Countries helpers ----
  // Union all country sources: local optimistic array + normalizedCountry + location countries
  const effectiveCountries = Array.from(new Set([
    ...localCountries,
    ...(pin.normalizedCountry ? [pin.normalizedCountry] : []),
    ...localLocations.map(l => l.normalizedCountry).filter(Boolean),
  ]));

  const countryMatches = countryInput.trim().length > 0
    ? KNOWN_COUNTRIES.filter(c => {
        const q = countryInput.toLowerCase();
        return c.toLowerCase().includes(q) && !effectiveCountries.includes(c);
      }).slice(0, 8)
    : [];

  async function handleAddCountry(country) {
    if (countrySaving) return;
    if (effectiveCountries.includes(country)) { setCountryInput(''); return; }
    const prev = localCountries;
    const updated = [...prev, country];
    // Optimistic: add immediately
    setLocalCountries(updated);
    setCountryInput('');
    setCountrySaving(true);
    try {
      await api.put(`/pins/${pin.id}`, { countries: updated });
      if (onPinChanged) onPinChanged(pin.id, { countries: updated });
    } catch {
      setLocalCountries(prev); // revert
    } finally {
      setCountrySaving(false);
    }
  }

  async function handleRemoveCountry(country) {
    if (countrySaving) return;
    const prev = localCountries;
    const updated = prev.filter(c => c !== country);
    // Optimistic: remove immediately
    setLocalCountries(updated);
    setCountrySaving(true);
    try {
      const payload = { countries: updated };
      if (pin.normalizedCountry === country) payload.normalizedCountry = null;
      await api.put(`/pins/${pin.id}`, payload);
      if (onPinChanged) onPinChanged(pin.id, { countries: updated });
    } catch {
      setLocalCountries(prev); // revert
    } finally {
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
      if (onPinChanged) onPinChanged(pin.id, { companions: updated });
      // Update local edit-details state too so it stays in sync
      setEditCompanions(updated);
    } catch { /* silent */ }
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
    if (guardEdit()) return;
    const next = v === liveRating ? 0 : v;
    setLiveRating(next);
    clearTimeout(ratingDebounceRef.current);
    ratingDebounceRef.current = setTimeout(async () => {
      try {
        await api.put(`/pins/${pin.id}`, { rating: next || null });
        setRatingSaved(true);
        setTimeout(() => setRatingSaved(false), 1500);
        if (onPinChanged) onPinChanged(pin.id, { rating: next || null });
      } catch { /* silent */ }
    }, 400);
  }

  // ---- Read-only guard — blocks all mutations when viewing someone else's pin ----
  function guardEdit() { return !!readOnly; }

  // ---- Archive pin ----
  async function handleArchive() {
    if (guardEdit()) return;
    if (!window.confirm('Archive this memory? It won\'t appear on your board but can be restored later.')) return;
    try {
      await api.put(`/pins/${pin.id}`, { archived: true });
      if (onPinChanged) onPinChanged(pin.id, { archived: true });
      onClose();
    } catch { /* silent */ }
  }

  // ---- Title save ----
  async function handleSaveTitle() {
    if (guardEdit()) return;
    const trimmed = titleText.trim();
    if (!trimmed || trimmed === pin.placeName) {
      setEditingTitle(false);
      setTitleText(pin.placeName || '');
      return;
    }
    setTitleSaving(true);
    try {
      await api.put(`/pins/${pin.id}`, { placeName: trimmed });
      if (onPinChanged) onPinChanged(pin.id, { placeName: trimmed });
      setEditingTitle(false);
    } catch { /* silent */ } finally {
      setTitleSaving(false);
    }
  }

  // ---- Highlights save ----
  async function handleSaveHighlights() {
    if (guardEdit()) return;
    setHighlightsSaving(true);
    setHighlightsError('');
    try {
      await api.put(`/pins/${pin.id}`, { aiSummary: highlightsText });
      setEditingHighlights(false);
      if (onPinChanged) onPinChanged(pin.id, { aiSummary: highlightsText });
    } catch (err) {
      setHighlightsError(err.message || 'Could not save.');
    } finally {
      setHighlightsSaving(false);
    }
  }

  // ---- Details save ----
  async function handleSaveDetails() {
    if (guardEdit()) return;
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
      if (onPinChanged) onPinChanged(pin.id, {
        visitYear: editYear ? parseInt(editYear, 10) : null,
        companions: editCompanions,
      });
    } catch (err) {
      setDetailsError(err.message || 'Could not save changes.');
    } finally {
      setDetailsSaving(false);
    }
  }

  // ---- Add note ----
  async function handleSaveAddition() {
    if (guardEdit()) return;
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
      if (onPinChanged) onPinChanged(pin.id, { note: updated });
    } catch (err) {
      setSaveError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ---- Regenerate cover photo (AI) ----
  async function handleRegeneratePhoto() {
    if (guardEdit()) return;
    if (generatingPhoto) return;

    const currentPinId = pin.id;
    setGeneratingPhoto(true);
    try {
      const res = await api.post(`/pins/${currentPinId}/regenerate-photo`);
      const newUrl = res.photoUrl || res.data?.photoUrl;
      if (newUrl) {
        if (pin?.id === currentPinId) setLocalImageUrl(newUrl);
        if (onPinChanged) onPinChanged(currentPinId, { photoUrl: newUrl, photoSource: 'ai_generated' });
      }
    } catch { /* silent */ } finally {
      const entry = generatingPins.get(currentPinId);
      if (entry) {
        entry.generating = false;
        entry.subscribers.forEach(fn => fn(false));
      }
    }
  }

  // ---- Fetch Unsplash photo ----
  async function handleUnsplashPhoto() {
    if (guardEdit()) return;
    if (generatingPhoto) return;

    const currentPinId = pin.id;
    setGeneratingPhoto(true);
    try {
      const res = await api.post(`/pins/${currentPinId}/unsplash-photo`);
      const data = res.data || res;
      const newUrl = data.unsplashImageUrl;
      if (newUrl) {
        if (pin?.id === currentPinId) setLocalImageUrl(newUrl);
        if (onPinChanged) onPinChanged(currentPinId, {
          unsplashImageUrl: newUrl,
          unsplashAttribution: data.unsplashAttribution,
          photoUrl: null,
          photoSource: 'unsplash',
        });
      }
    } catch { /* silent */ } finally {
      const entry = generatingPins.get(currentPinId);
      if (entry) {
        entry.generating = false;
        entry.subscribers.forEach(fn => fn(false));
      }
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
        /* ---- AI photo regenerate ---- */
        .md-regen-photo-btn {
          position: absolute; bottom: 10px; right: 10px;
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 10px; border-radius: 20px;
          background: rgba(10,10,10,0.65); backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.15);
          color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 500;
          letter-spacing: 0.04em; cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
          z-index: 10;
        }
        .md-regen-photo-btn:hover:not(:disabled) { background: rgba(30,30,30,0.85); }
        .md-regen-photo-btn:disabled { opacity: 0.6; cursor: default; }
        .md-regen-spinner {
          width: 11px; height: 11px; border-radius: 50%;
          border: 1.5px solid rgba(255,255,255,0.3);
          border-top-color: white;
          animation: md-spin 0.7s linear infinite;
        }
        @keyframes md-spin { to { transform: rotate(360deg); } }
        .md-hero-generating { animation: md-pulse 3s ease-in-out infinite; }
        @keyframes md-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        /* ---- Countries & Places pickers ---- */
        .md-picker-section { margin-bottom: 16px; }
        .md-chip-list {
          display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
        }
        .md-picker-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 8px 4px 10px; border-radius: 16px;
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--text-primary); font-size: 13px;
        }
        .md-picker-chip-flag { font-size: 15px; line-height: 1; }
        .md-picker-chip-remove {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); padding: 0 0 0 2px;
          font-size: 14px; line-height: 1; transition: color 0.12s;
        }
        .md-picker-chip-remove:hover { color: var(--text-primary); }
        /* Input + dropdown wrapper */
        .md-picker-input-wrap { position: relative; }
        .md-picker-input {
          width: 100%; background: var(--surface);
          border: 1px solid var(--border-strong); border-radius: 4px;
          color: var(--text-primary); padding: 8px 12px; font-size: 13px;
          outline: none; box-sizing: border-box; transition: border-color 0.18s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .md-picker-input:focus { border-color: var(--gold); }
        .md-picker-input::placeholder { color: var(--text-muted); }
        .md-picker-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; overflow: hidden; z-index: 300;
          box-shadow: 0 8px 24px rgba(10,10,10,0.12);
        }
        .md-picker-option {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 13px; cursor: pointer; font-size: 13px;
          color: var(--text-primary); transition: background 0.12s;
        }
        .md-picker-option:hover { background: var(--surface-2); }
        .md-picker-option-flag { font-size: 16px; line-height: 1; flex-shrink: 0; }
        .md-picker-option-icon { font-size: 14px; flex-shrink: 0; color: var(--text-muted); }
        .md-picker-option-main { font-weight: 500; }
        .md-picker-option-sub { color: var(--text-muted); font-size: 12px; }
        .md-picker-loading { padding: 10px 13px; font-size: 12px; color: var(--text-muted); }

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
          border-radius: 2px;
          border: 1px dashed var(--border-strong);
          background: transparent;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.18s;
        }
        .md-tag-friend-btn:hover {
          border-color: var(--gold);
          color: var(--gold);
          background: rgba(201,168,76,0.04);
        }
        .md-tf-wrap {
          border: 1px solid var(--border);
          border-radius: 4px;
          background: var(--surface-2);
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
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
          font-weight: 600;
        }
        .md-tf-close {
          background: none; border: none; cursor: pointer;
          color: var(--text-muted); font-size: 16px; padding: 0;
          line-height: 1; transition: color 0.15s;
        }
        .md-tf-close:hover { color: var(--text-primary); }
        .md-tf-search-wrap { position: relative; }
        .md-tf-input {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: 4px;
          color: var(--text-primary);
          padding: 9px 12px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .md-tf-input:focus { border-color: var(--gold); }
        .md-tf-input::placeholder { color: var(--text-muted); }
        .md-tf-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; overflow: hidden; z-index: 300;
          box-shadow: 0 8px 24px rgba(10,10,10,0.12);
        }
        .md-tf-result {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; cursor: pointer; transition: background 0.12s;
        }
        .md-tf-result:hover { background: var(--surface-2); }
        .md-tf-avatar {
          width: 34px; height: 34px; border-radius: 50%;
          background: var(--surface-3); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 600;
          overflow: hidden; flex-shrink: 0;
          color: var(--gold-dim);
        }
        .md-tf-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .md-tf-name { font-size: 14px; color: var(--text-primary); font-weight: 500; }
        .md-tf-username { font-size: 12px; color: var(--text-muted); margin-top: 1px; }
        .md-tf-no-results {
          padding: 10px 14px; font-size: 13px; color: var(--text-muted);
        }
        .md-tf-invite-prompt { margin-top: 10px; }
        .md-tf-invite-label {
          font-size: 12px; color: var(--text-secondary); margin-bottom: 8px; line-height: 1.5;
        }
        .md-tf-invite-label strong { color: var(--text-primary); }
        .md-tf-invite-row { display: flex; gap: 8px; }
        .md-tf-email-input {
          flex: 1;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: 4px;
          color: var(--text-primary);
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.18s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .md-tf-email-input:focus { border-color: var(--gold); }
        .md-tf-email-input::placeholder { color: var(--text-muted); }
        .md-tf-send-btn {
          padding: 8px 16px; border-radius: 2px;
          background: var(--black); color: var(--surface);
          border: none; font-size: 11px; font-weight: 600;
          cursor: pointer; white-space: nowrap; letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .md-tf-send-btn:hover { background: #222; }
        .md-tf-send-btn:disabled { opacity: 0.4; cursor: default; }
        .md-tf-done {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 0 2px;
          font-size: 13px; color: var(--gold-dim);
        }
        .md-tf-searching { padding: 10px 14px; font-size: 13px; color: var(--text-muted); }

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
          opacity: 0.3;
          transition: opacity 0.15s, transform 0.12s;
          line-height: 1;
        }
        .md-heart-btn.filled { opacity: 1; }
        .md-heart-btn:hover { opacity: 0.85; transform: scale(1.15); }
        .md-rating-saved {
          font-size: 11px;
          color: var(--gold-dim);
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
          background: var(--surface-2);
          border: 1px solid var(--border-strong);
          cursor: pointer;
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 2px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .md-highlights-edit-btn:hover {
          color: var(--gold-dim);
          border-color: var(--gold);
          background: rgba(201,168,76,0.06);
        }
        .md-highlights-textarea {
          width: 100%;
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: 4px;
          color: var(--text-primary);
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.6;
          font-family: 'Inter', system-ui, sans-serif;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
          min-height: 80px;
        }
        .md-highlights-textarea:focus { border-color: var(--gold); }
        .md-highlights-actions {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 8px;
        }
        .md-hl-save-btn {
          padding: 7px 18px;
          border-radius: 2px;
          background: var(--black);
          color: var(--surface);
          border: none;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .md-hl-save-btn:hover { background: #222; }
        .md-hl-save-btn:disabled { opacity: 0.4; cursor: default; }
        .md-hl-cancel-btn {
          padding: 7px 14px;
          border-radius: 2px;
          background: none;
          color: var(--text-muted);
          border: 1px solid var(--border-strong);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .md-hl-cancel-btn:hover { color: var(--text-primary); border-color: var(--border-strong); }
        .md-hl-error { font-size: 12px; color: #C0392B; }

        /* ---- Edit details expander ---- */
        .md-details-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 6px 0;
          transition: color 0.15s;
          margin-top: 8px;
        }
        .md-details-toggle:hover { color: var(--text-secondary); }
        .md-details-toggle svg { transition: transform 0.2s; }
        .md-details-toggle.open svg { transform: rotate(180deg); }
        .md-details-expand {
          border-top: 1px solid var(--border);
          padding-top: 16px;
          margin-top: 12px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .md-det-label {
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 8px;
          font-weight: 600;
        }
        .md-det-year-input {
          background: var(--surface);
          border: 1px solid var(--border-strong);
          border-radius: 4px;
          color: var(--text-primary);
          padding: 7px 10px;
          font-size: 14px;
          width: 110px;
          outline: none;
          font-family: 'Inter', system-ui, sans-serif;
          transition: border-color 0.18s;
        }
        .md-det-year-input:focus { border-color: var(--gold); }
        .md-det-preset-row { display: flex; gap: 8px; }
        .md-det-preset-btn {
          flex: 1;
          padding: 8px 0;
          border-radius: 2px;
          border: 1px solid var(--border-strong);
          background: var(--surface-2);
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .md-det-preset-btn:hover { border-color: var(--border-strong); background: var(--surface-3); }
        .md-det-preset-btn.active {
          background: var(--black);
          color: var(--surface);
          border-color: var(--black);
          font-weight: 600;
        }
        .md-det-companion-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
        .md-det-companion-chip {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 8px 4px 10px; border-radius: 16px;
          background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.35);
          color: var(--gold-dim); font-size: 13px;
        }
        .md-det-chip-remove {
          background: none; border: none; cursor: pointer;
          color: inherit; opacity: 0.6; padding: 0; font-size: 14px;
        }
        .md-det-chip-remove:hover { opacity: 1; }
        .md-det-search-wrap { position: relative; }
        .md-det-search-input {
          width: 100%; background: var(--surface);
          border: 1px solid var(--border-strong); border-radius: 4px;
          color: var(--text-primary); padding: 8px 12px; font-size: 13px;
          outline: none; box-sizing: border-box;
          transition: border-color 0.18s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .md-det-search-input:focus { border-color: var(--gold); }
        .md-det-search-input::placeholder { color: var(--text-muted); }
        .md-det-search-dropdown {
          position: absolute; top: calc(100% + 4px); left: 0; right: 0;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; overflow: hidden; z-index: 200;
          box-shadow: 0 8px 24px rgba(10,10,10,0.10);
        }
        .md-det-search-result {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; cursor: pointer; transition: background 0.12s;
          color: var(--text-primary);
        }
        .md-det-search-result:hover { background: var(--surface-2); }
        .md-det-result-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--surface-3); border: 1px solid var(--border);
          display: flex; align-items: center;
          justify-content: center; font-size: 12px; overflow: hidden; flex-shrink: 0;
          color: var(--gold-dim);
        }
        .md-det-result-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .md-det-no-results { padding: 10px 12px; font-size: 12px; color: var(--text-muted); }
        .md-det-add-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 12px; border-radius: 2px;
          border: 1px dashed var(--border-strong); background: none;
          color: var(--text-muted); font-size: 11px; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          cursor: pointer; transition: all 0.15s;
        }
        .md-det-add-btn:hover { border-color: var(--gold); color: var(--gold-dim); }
        .md-det-tags-toggle {
          display: inline-flex; align-items: center; gap: 5px;
          background: none; border: 1px dashed var(--border-strong);
          color: var(--text-muted); font-size: 11px; font-weight: 500;
          letter-spacing: 0.06em; text-transform: uppercase;
          padding: 5px 10px; border-radius: 2px; cursor: pointer;
          transition: all 0.15s; margin-top: 6px;
        }
        .md-det-tags-toggle:hover { border-color: var(--gold); color: var(--gold-dim); }
        .md-details-actions {
          display: flex; gap: 8px; align-items: center;
          padding-top: 4px;
        }
        .md-det-save-btn {
          padding: 9px 20px; border-radius: 2px;
          background: var(--black); color: var(--surface);
          border: none; font-size: 11px; font-weight: 600;
          cursor: pointer; letter-spacing: 0.08em; text-transform: uppercase;
          transition: background 0.15s;
        }
        .md-det-save-btn:hover { background: #222; }
        .md-det-save-btn:disabled { opacity: 0.4; cursor: default; }
        .md-det-cancel-btn {
          padding: 9px 14px; border-radius: 2px; background: none;
          color: var(--text-muted); border: 1px solid var(--border-strong);
          font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase;
          cursor: pointer; transition: color 0.15s;
        }
        .md-det-cancel-btn:hover { color: var(--text-primary); }
        .md-det-saved { font-size: 12px; color: var(--gold-dim); letter-spacing: 0.04em; }
        .md-det-error { font-size: 12px; color: #C0392B; }
      `}</style>

      {/* Backdrop — hidden in map mode so the map stays visible */}
      {!noBackdrop && (
        <div
          className={`md-backdrop${isOpen ? ' md-backdrop-visible' : ''}`}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside className={`md-panel${isOpen ? ' md-panel-open' : ''}`}>

        {/* Header */}
        <div className="md-header">
          {!readOnly && (
            <button className="md-archive-btn" onClick={handleArchive} title="Archive this memory">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 4v9a1 1 0 001 1h10a1 1 0 001-1V4M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6.5 7v4M9.5 7v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}
          <button className="md-close" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {localImageUrl ? (
            <div
              className={`md-hero-img${generatingPhoto ? ' md-hero-generating' : ''}`}
              style={{ backgroundImage: `url(${localImageUrl})` }}
            />
          ) : (
            <div
              className={`md-hero-gradient${generatingPhoto ? ' md-hero-generating' : ''}`}
              style={{
                background: pin.gradientStart && pin.gradientEnd
                  ? `linear-gradient(135deg, ${pin.gradientStart}, ${pin.gradientEnd})`
                  : 'linear-gradient(135deg, #4a3728, #8B6914)',
              }}
            >
              <span className="md-hero-emoji">{pin.emoji || '🌍'}</span>
            </div>
          )}
          {/* Photo source buttons */}
          {!readOnly && (
            <div className="md-photo-actions">
              {generatingPhoto ? (
                <div className="md-regen-photo-btn" style={{ cursor: 'default' }}>
                  <span className="md-regen-spinner" /> Generating…
                </div>
              ) : (
                <>
                  <button className="md-regen-photo-btn" onClick={handleUnsplashPhoto} disabled={generatingPhoto} title="Find a real travel photo">
                    📷 Photo
                  </button>
                  <button className="md-regen-photo-btn" onClick={handleRegeneratePhoto} disabled={generatingPhoto} title="Generate an AI illustration">
                    ✦ AI art
                  </button>
                </>
              )}
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
            {!readOnly && editingTitle ? (
              <div className="md-title-edit">
                <input
                  ref={titleInputRef}
                  className="md-title-input"
                  value={titleText}
                  onChange={e => setTitleText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveTitle(); }
                    if (e.key === 'Escape') { setEditingTitle(false); setTitleText(pin.placeName || ''); }
                  }}
                  onBlur={handleSaveTitle}
                  disabled={titleSaving}
                  autoFocus
                />
              </div>
            ) : (
              <h2
                className={`md-place${readOnly ? '' : ' md-place-editable'}`}
                onClick={readOnly ? undefined : () => { setEditingTitle(true); setTimeout(() => titleInputRef.current?.focus(), 0); }}
                title={readOnly ? undefined : 'Click to edit'}
              >
                {pin.placeName}
              </h2>
            )}
            <div className="md-meta-row" style={{ alignItems: 'center', gap: 12 }}>
              {pin.visitYear && <span className="md-meta-item">{pin.visitYear}</span>}

              {/* Hearts — interactive only on own pins */}
              <div className="md-hearts-row">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`md-heart-btn ${v <= liveRating ? 'filled' : ''}`}
                    onClick={readOnly ? undefined : () => handleRatingClick(v)}
                    title={readOnly ? undefined : `Rate ${v}`}
                    style={readOnly ? { cursor: 'default' } : undefined}
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
            {/* Country chips — always shown (union of all sources) */}
            {effectiveCountries.length > 0 && (
              <div className="md-chip-list">
                {effectiveCountries.map(c => {
                  const isLocationOnly = !(pin.countries || []).includes(c) && pin.normalizedCountry !== c;
                  return (
                    <span key={c} className="md-picker-chip">
                      <span className="md-picker-chip-flag">{countryFlag(c) || '🌍'}</span>
                      {c}
                      {!readOnly && !isLocationOnly && (
                        <button
                          type="button"
                          className="md-picker-chip-remove"
                          onClick={() => handleRemoveCountry(c)}
                          title="Remove"
                        >×</button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {!readOnly && effectiveCountries.length === 0 && (
              <p style={{ fontSize: 12, color: 'rgba(250,250,250,0.3)', marginBottom: 8 }}>
                No countries yet — type to add one
              </p>
            )}
            {/* Autocomplete input (own pins only) */}
            {!readOnly && <div className="md-picker-input-wrap">
              <input
                type="text"
                className="md-picker-input"
                placeholder="Add a country…"
                value={countryInput}
                onChange={e => setCountryInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (countryMatches.length > 0) handleAddCountry(countryMatches[0]);
                  }
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
            </div>}
          </div>

          {/* Places */}
          <div className="md-picker-section">
            <p className="md-section-label" style={{ marginBottom: 8 }}>Places</p>
            {/* Existing stop locations */}
            {localLocations.length > 0 && (
              <div className="md-chip-list">
                {localLocations.map(loc => {
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
            {/* Google Places autocomplete input (own pins only) */}
            {!readOnly && <div className="md-picker-input-wrap">
              <input
                type="text"
                inputMode="text"
                className="md-picker-input"
                placeholder="Search for a place…"
                value={placesInput}
                onChange={e => setPlacesInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (placesResults.length === 0 && placesInput.trim()) handleAddPlaceManual();
                  }
                  if (e.key === 'Escape') { setPlacesInput(''); setPlacesResults([]); }
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
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
            </div>}
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

            {/* Tag a friend inline flow (own pins only) */}
            {readOnly ? null : !showTagFriend ? (
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
              {!readOnly && !editingHighlights && (
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

          {/* Add note (own pins only) */}
          {!readOnly && <div className="md-section md-add-section">
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
          </div>}

          {/* Edit details toggle (year, companions, tags) — own pins only */}
          {!readOnly && <button
            className={`md-details-toggle${showDetails ? ' open' : ''}`}
            onClick={() => setShowDetails(v => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Edit details
          </button>}

          {!readOnly && showDetails && (
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
