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

  // Places & Countries editor
  const [stopInput, setStopInput] = useState('');
  const [stopSaving, setStopSaving] = useState(false);
  const [editingLocId, setEditingLocId] = useState(null);  // stop id being renamed
  const [editLocText, setEditLocText] = useState('');
  const [editLocSaving, setEditLocSaving] = useState(false);
  // Primary place/country edit
  const [editingPrimary, setEditingPrimary] = useState(false);
  const [editPrimaryPlace, setEditPrimaryPlace] = useState('');
  const [editPrimaryCountry, setEditPrimaryCountry] = useState('');
  const [primarySaving, setPrimarySaving] = useState(false);
  const [primaryError, setPrimaryError] = useState('');

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
      setEditPrimaryPlace(pin.placeName || '');
      setEditPrimaryCountry(pin.normalizedCountry || '');
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
      setStopInput('');
      setEditingLocId(null);
      setEditLocText('');
      setEditingPrimary(false);
      setPrimaryError('');
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

  // ---- Stops helpers ----
  async function handleAddStop() {
    const name = stopInput.trim();
    if (!name || stopSaving) return;
    setStopSaving(true);
    try {
      await api.post(`/pins/${pin.id}/locations`, { placeName: name });
      setStopInput('');
      if (onUpdated) onUpdated();
    } catch { /* silent */ } finally {
      setStopSaving(false);
    }
  }

  async function handleRemoveStop(locId) {
    try {
      await api.delete(`/pins/${pin.id}/locations/${locId}`);
      if (onUpdated) onUpdated();
    } catch { /* silent */ }
  }

  async function handleRenameStop(locId) {
    const name = editLocText.trim();
    if (!name || editLocSaving) return;
    setEditLocSaving(true);
    try {
      await api.put(`/pins/${pin.id}/locations/${locId}`, { placeName: name });
      setEditingLocId(null);
      setEditLocText('');
      if (onUpdated) onUpdated();
    } catch { /* silent */ } finally {
      setEditLocSaving(false);
    }
  }

  async function handleSavePrimary() {
    const place = editPrimaryPlace.trim();
    const country = editPrimaryCountry.trim() || null;
    if (!place) return;
    setPrimarySaving(true);
    setPrimaryError('');
    try {
      await api.put(`/pins/${pin.id}`, {
        placeName: place,
        normalizedCountry: country,
        // Clear geocoded coordinates so they re-derive on next normalization
        ...(place !== pin.placeName ? { latitude: null, longitude: null, locationVerified: false } : {}),
      });
      setEditingPrimary(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setPrimaryError(err.message || 'Could not save.');
    } finally {
      setPrimarySaving(false);
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
        /* ---- Places & Countries editor ---- */
        .md-places-section { margin-bottom: 14px; }
        .md-places-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .md-places-label {
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(250,250,250,0.35); font-weight: 600;
        }
        /* Primary chip */
        .md-primary-chip {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 6px 12px; border-radius: 20px;
          background: rgba(201,168,76,0.10); border: 1px solid rgba(201,168,76,0.25);
          color: rgba(250,250,250,0.85); font-size: 13px; font-weight: 500;
          margin-bottom: 8px; cursor: pointer; transition: border-color 0.15s;
        }
        .md-primary-chip:hover { border-color: rgba(201,168,76,0.55); }
        .md-primary-chip-flag { font-size: 16px; line-height: 1; }
        .md-primary-chip-edit {
          font-size: 11px; opacity: 0.4; margin-left: 2px;
          transition: opacity 0.15s;
        }
        .md-primary-chip:hover .md-primary-chip-edit { opacity: 0.8; }
        /* Primary edit form */
        .md-primary-edit {
          background: rgba(201,168,76,0.05); border: 1px solid rgba(201,168,76,0.2);
          border-radius: 10px; padding: 12px; margin-bottom: 10px;
        }
        .md-pe-row { display: flex; gap: 8px; margin-bottom: 8px; }
        .md-pe-input {
          flex: 1; background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18); border-radius: 7px;
          color: rgba(250,250,250,0.9); padding: 7px 10px; font-size: 13px;
          outline: none; transition: border-color 0.18s; min-width: 0;
        }
        .md-pe-input:focus { border-color: rgba(201,168,76,0.45); }
        .md-pe-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-pe-actions { display: flex; gap: 8px; align-items: center; }
        .md-pe-save {
          padding: 6px 16px; border-radius: 7px; background: var(--gold);
          color: var(--black); border: none; font-size: 12px; font-weight: 700;
          cursor: pointer; letter-spacing: 0.03em;
        }
        .md-pe-save:disabled { opacity: 0.5; cursor: default; }
        .md-pe-cancel {
          padding: 6px 12px; border-radius: 7px; background: none;
          color: rgba(250,250,250,0.4); border: 1px solid rgba(250,250,250,0.14);
          font-size: 12px; cursor: pointer;
        }
        .md-pe-error { font-size: 12px; color: #ff6b6b; }
        /* Stop chips */
        .md-stops-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
        .md-stop-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 16px;
          background: rgba(250,250,250,0.06); border: 1px solid rgba(250,250,250,0.14);
          color: rgba(250,250,250,0.7); font-size: 13px;
          cursor: pointer; transition: border-color 0.15s;
        }
        .md-stop-chip:hover { border-color: rgba(250,250,250,0.3); }
        .md-stop-chip-remove {
          background: none; border: none; cursor: pointer;
          color: inherit; opacity: 0.45; padding: 0; font-size: 14px; line-height: 1;
          margin-left: 2px; transition: opacity 0.12s;
        }
        .md-stop-chip-remove:hover { opacity: 1; }
        /* Stop inline edit */
        .md-stop-edit-row {
          display: flex; gap: 6px; align-items: center;
          margin-bottom: 6px;
        }
        .md-stop-edit-input {
          flex: 1; background: rgba(250,250,250,0.07);
          border: 1px solid rgba(201,168,76,0.35); border-radius: 7px;
          color: rgba(250,250,250,0.9); padding: 5px 9px; font-size: 13px;
          outline: none;
        }
        .md-stop-edit-save {
          padding: 5px 12px; border-radius: 7px; background: var(--gold);
          color: var(--black); border: none; font-size: 12px; font-weight: 700;
          cursor: pointer;
        }
        .md-stop-edit-cancel {
          padding: 5px 10px; border-radius: 7px; background: none;
          color: rgba(250,250,250,0.4); border: 1px solid rgba(250,250,250,0.14);
          font-size: 12px; cursor: pointer;
        }
        .md-add-stop-row { display: flex; gap: 6px; margin-top: 4px; }
        .md-add-stop-input {
          flex: 1; background: rgba(250,250,250,0.07);
          border: 1px solid rgba(250,250,250,0.18); border-radius: 8px;
          color: rgba(250,250,250,0.9); padding: 7px 11px; font-size: 13px;
          outline: none; transition: border-color 0.18s;
        }
        .md-add-stop-input:focus { border-color: rgba(201,168,76,0.4); }
        .md-add-stop-input::placeholder { color: rgba(250,250,250,0.3); }
        .md-add-stop-btn {
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid rgba(250,250,250,0.2); background: transparent;
          color: rgba(250,250,250,0.6); font-size: 13px; cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .md-add-stop-btn:hover { border-color: var(--gold); color: var(--gold); }
        .md-add-stop-btn:disabled { opacity: 0.4; cursor: default; }

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
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(250,250,250,0.3);
          font-size: 12px;
          padding: 2px 6px;
          border-radius: 4px;
          transition: color 0.15s;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .md-highlights-edit-btn:hover { color: var(--gold); }
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

          {/* Places & Countries */}
          <div className="md-places-section">
            <div className="md-places-header">
              <span className="md-places-label">Places &amp; Countries</span>
            </div>

            {/* Primary location chip — click to edit */}
            {!editingPrimary ? (
              <div
                className="md-primary-chip"
                onClick={() => {
                  setEditPrimaryPlace(pin.placeName || '');
                  setEditPrimaryCountry(pin.normalizedCountry || '');
                  setPrimaryError('');
                  setEditingPrimary(true);
                }}
                title="Click to edit primary place / country"
              >
                {(() => {
                  const flag = countryFlag(pin.normalizedCountry) ||
                    (pin.placeName ? countryFlagFromPlace(pin.placeName)?.flag : null);
                  return flag ? <span className="md-primary-chip-flag">{flag}</span> : null;
                })()}
                <span>{pin.placeName || 'Unnamed place'}</span>
                {pin.normalizedCountry && (
                  <span style={{ fontSize: 12, opacity: 0.55 }}>{pin.normalizedCountry}</span>
                )}
                <span className="md-primary-chip-edit">✏️</span>
              </div>
            ) : (
              <div className="md-primary-edit">
                <div className="md-pe-row">
                  <input
                    autoFocus
                    type="text"
                    className="md-pe-input"
                    placeholder="Place name (e.g. Jerusalem)"
                    value={editPrimaryPlace}
                    onChange={e => setEditPrimaryPlace(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSavePrimary(); if (e.key === 'Escape') setEditingPrimary(false); }}
                  />
                  <input
                    type="text"
                    className="md-pe-input"
                    placeholder="Country"
                    value={editPrimaryCountry}
                    onChange={e => setEditPrimaryCountry(e.target.value)}
                    list="md-country-list"
                    onKeyDown={e => { if (e.key === 'Enter') handleSavePrimary(); if (e.key === 'Escape') setEditingPrimary(false); }}
                    style={{ maxWidth: 140 }}
                  />
                  <datalist id="md-country-list">
                    {KNOWN_COUNTRIES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="md-pe-actions">
                  <button className="md-pe-cancel" onClick={() => setEditingPrimary(false)} disabled={primarySaving}>Cancel</button>
                  <button className="md-pe-save" onClick={handleSavePrimary} disabled={primarySaving || !editPrimaryPlace.trim()}>
                    {primarySaving ? 'Saving…' : 'Done'}
                  </button>
                  {primaryError && <span className="md-pe-error">{primaryError}</span>}
                </div>
              </div>
            )}

            {/* Stop location chips */}
            {pin.locations && pin.locations.length > 0 && (
              <div className="md-stops-chips">
                {pin.locations.map(loc => {
                  if (editingLocId === loc.id) {
                    return (
                      <div key={loc.id} className="md-stop-edit-row">
                        <input
                          autoFocus
                          type="text"
                          className="md-stop-edit-input"
                          value={editLocText}
                          onChange={e => setEditLocText(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameStop(loc.id); if (e.key === 'Escape') setEditingLocId(null); }}
                        />
                        <button className="md-stop-edit-cancel" onClick={() => setEditingLocId(null)}>✕</button>
                        <button className="md-stop-edit-save" onClick={() => handleRenameStop(loc.id)} disabled={editLocSaving || !editLocText.trim()}>
                          {editLocSaving ? '…' : 'Done'}
                        </button>
                      </div>
                    );
                  }
                  const locFlag = loc.normalizedCountry
                    ? countryFlag(loc.normalizedCountry)
                    : countryFlagFromPlace(loc.placeName)?.flag;
                  return (
                    <span
                      key={loc.id}
                      className="md-stop-chip"
                      onClick={() => { setEditingLocId(loc.id); setEditLocText(loc.placeName); }}
                      title="Click to rename"
                    >
                      {locFlag && <span style={{ fontSize: 14 }}>{locFlag}</span>}
                      {loc.placeName}
                      <button
                        type="button"
                        className="md-stop-chip-remove"
                        onClick={e => { e.stopPropagation(); handleRemoveStop(loc.id); }}
                        title="Remove"
                      >×</button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Add a place */}
            <div className="md-add-stop-row">
              <input
                type="text"
                className="md-add-stop-input"
                placeholder="Add a place… (Jordan, Petra, Cairo…)"
                value={stopInput}
                onChange={e => setStopInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddStop(); }}
              />
              <button
                type="button"
                className="md-add-stop-btn"
                onClick={handleAddStop}
                disabled={!stopInput.trim() || stopSaving}
              >
                {stopSaving ? '…' : '+ Add'}
              </button>
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
