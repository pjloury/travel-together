// VoiceCapture component - full-screen modal for adding a memory.
//
// Default flow is text-first: opens straight into the editable form
// (state = 'review') with blank fields. Power users can tap "✦ Tell it
// as a story" to switch into the voice-record flow which transcribes a
// free-form ramble and uses Claude to extract:
//   - place_name (single trip name or "Europe Summer 2024" style)
//   - locations[] — every named city/country (each gets a flag chip
//     after server-side Google Places resolution)
//   - tags[], visit_year, rating, summary bullets
// Voice mode lands back in the same review form with fields pre-filled.
//
// Spec: docs/app/spec.md Section 4, Section 5 (Voice Input Pipeline)
// @implements REQ-VOICE-001, REQ-VOICE-002, REQ-VOICE-005, REQ-VOICE-007

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';
import useLoadingPhrases from '../hooks/useLoadingPhrases';

const VOICE_PROCESSING_PHRASES = [
  'Listening to your story...',
  'Decoding travel memories...',
  'Parsing place names and vibes...',
  'Consulting the atlas...',
  'Extracting the highlights...',
  'Figuring out where you went...',
  'Reading between the lines...',
  'Detecting wanderlust levels...',
  'Pinpointing coordinates...',
  'Cross-referencing with Google Maps...',
  'Translating excited hand gestures...',
  'Cataloguing sensory details...',
  'Identifying the must-revisit spots...',
  'Assembling your travel story...',
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * Convert an AI summary (array or string) to editable bullet text.
 */
function summaryToEditableText(s) {
  if (!s) return '';
  if (Array.isArray(s)) return s.map(line => `- ${line}`).join('\n');
  return s;
}

/**
 * VoiceCapture is a full-screen modal for recording a memory via voice.
 *
 * @implements REQ-VOICE-001 (user records free-form voice memo)
 * @implements REQ-VOICE-002 (voice transcribed to text; verbatim transcript displayed)
 * @implements REQ-VOICE-005 (explicit save commits memory card with AI summary + transcript)
 * @implements REQ-VOICE-007 (each pipeline stage shows specific errors with Retry + Type Instead fallback)
 *
 * States: ready, recording, processing, review, error
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Close the modal
 * @param {function} props.onSaved - Callback after pin is saved
 * @param {string} [props.convertedFromDreamId] - When this capture is
 *   completing a dream→memory conversion (voice path), the source
 *   dream's id. Threaded into the POST /pins body so the server fans
 *   out 'friend_converted' notifications instead of 'friend_memory'.
 */
export default function VoiceCapture({ isOpen, onClose, onSaved, convertedFromDreamId }) {
  // Default state is now 'review' (blank text form) — voice is opt-in via
  // the "✦ Tell it as a story" toggle inside the form. Used to default to
  // 'ready' (voice-first), but most users prefer to type a few fields and
  // be done; voice mode is for power users dictating a long multi-place
  // ramble that the AI extracts into stops, tags, year, and highlights.
  const [state, setState] = useState('review'); // ready | recording | processing | review | error
  const [errorMessage, setErrorMessage] = useState('');
  const [errorStage, setErrorStage] = useState(''); // recording | upload | transcription | structuring | save
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [correctionTranscript, setCorrectionTranscript] = useState('');
  const [_aiProposal, setAiProposal] = useState(null);
  const [isStructuring, setIsStructuring] = useState(false); // AI filling fields
  const [structuringError, setStructuringError] = useState(false);
  const [isReRecording, setIsReRecording] = useState(false);
  const [saving, setSaving] = useState(false);

  // Loading phrases for processing state
  const voicePhrases = useMemo(() => VOICE_PROCESSING_PHRASES, []);
  const processingPhrase = useLoadingPhrases(voicePhrases, state === 'processing' || isStructuring);

  // Editable fields (pre-filled by AI proposal in review state)
  const [placeName, setPlaceName] = useState('');
  const [locations, setLocations] = useState([]); // array of place name strings (additional stops)
  const [locationInput, setLocationInput] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [summaryText, setSummaryText] = useState(''); // always a string for editing
  const [visitYear, setVisitYear] = useState('');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');

  // Companion state
  const [companions, setCompanions] = useState([]); // array of { type: 'preset'|'user'|'name', label, userId? }
  const [companionSearch, setCompanionSearch] = useState('');
  const [companionResults, setCompanionResults] = useState([]);
  const [companionSearching, setCompanionSearching] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [showInviteInput, setShowInviteInput] = useState(false);
  const companionSearchRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetAll();
    }
  }, [isOpen]);

  // Debounced user search
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
        // Normalize: search returns userId, standardize to id
        const users = (res.data || []).map(u => ({ ...u, id: u.userId || u.id }));
        setCompanionResults(users);
      } catch {
        setCompanionResults([]);
      } finally {
        setCompanionSearching(false);
      }
    }, 350);
  }, [companionSearch]);

  // Stop mic and clean up media resources
  function stopMic() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  function handleClose() {
    stopMic();
    resetAll();
    onClose();
  }

  function resetAll() {
    setState('review');
    setErrorMessage('');
    setErrorStage('');
    setRecordingTime(0);
    setTranscript('');
    setCorrectionTranscript('');
    setAiProposal(null);
    setIsStructuring(false);
    setStructuringError(false);
    setIsReRecording(false);
    setSaving(false);
    setPlaceName('');
    setSelectedTags([]);
    setSummaryText('');
    setVisitYear('');
    setRating(0);
    setNote('');
    setLocations([]);
    setLocationInput('');
    setCompanions([]);
    setCompanionSearch('');
    setCompanionResults([]);
    setCompanionSearching(false);
    setInviteEmail('');
    setInviteSent(false);
    setInviteSending(false);
    setShowInviteInput(false);
    audioChunksRef.current = [];
    audioBlobRef.current = null;
  }

  // Step 1: Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer webm/opus, fallback to wav
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/wav';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioBlobRef.current = blob;
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setState('recording');
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      setState('error');
      setErrorStage('recording');
      setErrorMessage('Microphone access needed to record. Check browser permissions.');
    }
  }, []);

  // Step 1b: Stop recording
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setTimeout(() => uploadAndTranscribe(), 300);
    }
  }, []);

  // Spacebar to start OR stop recording (only when not typing in an input)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === ' ') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        if (state === 'ready') { e.preventDefault(); startRecording(); }
        else if (state === 'recording') { e.preventDefault(); stopRecording(); }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, startRecording, stopRecording]);

  // Step 2 & 3: Upload + Transcribe
  async function uploadAndTranscribe() {
    setState('processing');
    const blob = audioBlobRef.current;
    if (!blob) {
      setState('error');
      setErrorStage('upload');
      setErrorMessage('No audio recorded. Please try again.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/voice/transcribe`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        const stage = data.stage || 'transcription';
        throw { message: data.error || 'Transcription failed', stage };
      }

      const transcriptText = data.data.transcript;

      if (isReRecording) {
        setCorrectionTranscript(transcriptText);
        setIsReRecording(false);
        setState('review');
        await structureTranscript(transcript, transcriptText);
      } else {
        setTranscript(transcriptText);
        setState('review');
        await structureTranscript(transcriptText, null);
      }
    } catch (err) {
      if (err.stage === 'transcription') {
        setState('error');
        setErrorStage('transcription');
        setErrorMessage('Transcription failed. Your recording is safe.');
      } else {
        setState('error');
        setErrorStage('upload');
        setErrorMessage('Could not send audio to server. Check your connection.');
      }
    }
  }

  // Step 4: Structure transcript via Claude
  async function structureTranscript(mainTranscript, correction) {
    setStructuringError(false);
    setIsStructuring(true);
    try {
      const response = await api.post('/voice/structure', {
        transcript: mainTranscript,
        correctionTranscript: correction,
        context: 'memory',
      });

      const proposal = response.data;
      setAiProposal(proposal);
      setPlaceName(proposal.place_name || proposal.placeName || '');

      // Convert summary to editable text
      const rawSummary = proposal.summary || '';
      setSummaryText(summaryToEditableText(rawSummary));

      if (proposal.tags && proposal.tags.length > 0) {
        setSelectedTags(proposal.tags);
      }
      if (proposal.visit_year) {
        setVisitYear(String(proposal.visit_year));
      }
      if (proposal.rating) {
        setRating(proposal.rating);
      }
      // Companion auto-fill from the AI proposal is intentionally dropped
      // here. Companions are now strictly Travel Together account links so
      // the user has to search and pick a real friend (or send an email
      // invite) — we can't reliably resolve a free-text name to an account.
      // Pre-fill location stops from AI (all named places from transcript)
      if (proposal.locations && Array.isArray(proposal.locations) && proposal.locations.length > 0) {
        setLocations(proposal.locations);
      }
      setState('review');
    } catch {
      setStructuringError(true);
      setNote(mainTranscript);
      setState('review');
    } finally {
      setIsStructuring(false);
    }
  }

  // Companion helpers — companions are now ONLY Travel Together accounts.
  // Solo / Family presets and free-text labels were removed: when the user
  // tags someone they should always be linked to a real account so memories
  // can show up on the friend's profile too. Email invites are still
  // supported for friends who don't have an account yet.
  function addUserCompanion(user) {
    const uid = user.userId || user.id;
    const name = user.displayName || user.display_name || user.username;
    const avatar = user.avatarUrl || user.avatar_url;
    const already = companions.some(c => c.userId === uid || c.label === name);
    if (!already) {
      setCompanions(prev => [...prev, {
        type: 'user',
        label: name,
        userId: uid,
        avatar,
      }]);
    }
    setCompanionSearch('');
    setCompanionResults([]);
  }

  function removeCompanion(idx) {
    setCompanions(prev => prev.filter((_, i) => i !== idx));
  }

  async function sendInvite() {
    if (!inviteEmail.trim() || inviteSent) return;
    setInviteSending(true);
    try {
      await api.post('/invites/send', { email: inviteEmail.trim() });
      setInviteSent(true);
      setInviteEmail('');
    } catch {
      // silently fail — email config may not be set up
    } finally {
      setInviteSending(false);
    }
  }

  // Retry based on error stage
  function handleRetry() {
    if (errorStage === 'upload' || errorStage === 'transcription') {
      uploadAndTranscribe();
    } else if (errorStage === 'structuring') {
      structureTranscript(transcript, correctionTranscript || null);
    } else if (errorStage === 'save') {
      handleSave();
    }
  }

  function handleTypeInstead() {
    setState('review');
    setStructuringError(false);
  }

  function handleReRecord() {
    setIsReRecording(true);
    startRecording();
  }

  // Step 6: Save memory pin
  async function handleSave() {
    setSaving(true);
    setErrorStage('');
    try {
      const tagPayload = tagNamesToPayload(selectedTags);
      const companionLabels = companions.map(c => c.label);

      const res = await api.post('/pins', {
        pinType: 'memory',
        placeName: placeName,
        aiSummary: summaryText,
        transcript: transcript,
        correctionTranscript: correctionTranscript || null,
        note: note || null,
        visitYear: visitYear ? parseInt(visitYear, 10) : null,
        rating: rating || null,
        tags: tagPayload,
        companions: companionLabels,
        photoSourcePref: localStorage.getItem('tt_photo_source') || 'unsplash',
        // Set when this capture is completing a dream→memory voice
        // conversion (BoardView passes the dream id via the prop).
        convertedFromDreamId: convertedFromDreamId || undefined,
      });

      // Fire-and-forget: save additional location stops
      const pinId = res.data?.id || res.id || res.data?.data?.id;
      if (pinId && locations.length > 0) {
        locations.forEach(loc => {
          api.post(`/pins/${pinId}/locations`, { placeName: loc }).catch(() => {});
        });
      }

      const newPin = res.data?.data || res.data || null;
      if (onSaved) onSaved(newPin);
      onClose();
    } catch (err) {
      setErrorStage('save');
      setErrorMessage(err.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Detect if search query looks like an email for invite prompt
  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companionSearch.trim());
  const noResults = companionSearch.trim().length > 1 && !companionSearching && companionResults.length === 0;

  return (
    <div className="voice-capture-modal">
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.12); opacity: 1; }
        }
        .voice-breathe {
          animation: breathe 2.8s ease-in-out infinite;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05));
          border: 1px solid rgba(201,168,76,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .voice-sub-instruction {
          color: var(--text-muted);
          font-size: 13px;
        }

        /* Companion section */
        .vc-companion-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }
        /* AI skeleton shimmer */
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .vc-skeleton {
          border-radius: 6px;
          background: linear-gradient(90deg,
            rgba(250,250,250,0.06) 25%,
            rgba(250,250,250,0.12) 50%,
            rgba(250,250,250,0.06) 75%);
          background-size: 800px 100%;
          animation: shimmer 1.4s infinite;
        }
        .vc-skeleton-line {
          height: 14px;
          margin-bottom: 8px;
        }
        .vc-skeleton-short { width: 55%; }
        .vc-skeleton-medium { width: 80%; }
        .vc-skeleton-tag {
          display: inline-block;
          height: 26px; width: 80px; border-radius: 20px;
          margin: 0 4px 4px 0;
        }
        .vc-structuring-label {
          font-size: 11px;
          color: var(--gold);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 8px;
          opacity: 0.75;
        }
        .vc-friend-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .vc-friend-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px 5px 8px;
          border-radius: 20px;
          background: rgba(201,168,76,0.15);
          border: 1px solid rgba(201,168,76,0.4);
          color: var(--gold);
          font-size: 13px;
          font-weight: 500;
        }
        .vc-friend-chip-avatar {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: rgba(201,168,76,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .vc-friend-chip-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .vc-friend-chip-remove {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
          line-height: 1;
          opacity: 0.6;
        }
        .vc-friend-chip-remove:hover { opacity: 1; }
        .vc-search-wrap {
          position: relative;
        }
        .vc-search-input {
          width: 100%;
          /* Renders on the LIGHT .voice-review surface — use dark text + a
             subtle warm tint so the field is obvious against white. */
          background: var(--surface-2, #F5F3EF);
          border: 1px solid var(--border, #E0DAD0);
          border-radius: 10px;
          color: var(--text-primary, #0A0A0A);
          -webkit-text-fill-color: var(--text-primary, #0A0A0A);
          caret-color: var(--gold, #C9A84C);
          padding: 9px 14px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .vc-search-input:focus {
          border-color: var(--gold, #C9A84C);
          box-shadow: 0 4px 16px -10px var(--gold, #C9A84C);
        }
        .vc-search-input::placeholder {
          color: var(--text-muted, #ABA49B);
          -webkit-text-fill-color: var(--text-muted, #ABA49B);
        }
        /* Static hint under the with-whom search input */
        .vc-search-hint {
          font-size: 12px;
          color: var(--text-muted, #ABA49B);
          margin: 6px 2px 0;
          line-height: 1.4;
        }
        .vc-search-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: var(--surface, #FFFFFF);
          border: 1px solid var(--border, #E0DAD0);
          border-radius: 10px;
          overflow: hidden;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(10,10,10,0.18);
        }
        .vc-search-result {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .vc-search-result:hover { background: var(--surface-2, #F5F3EF); }
        .vc-result-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(201,168,76,0.18);
          color: var(--text-primary, #0A0A0A);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          overflow: hidden;
          flex-shrink: 0;
        }
        .vc-result-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .vc-result-name {
          font-size: 14px;
          color: var(--text-primary, #0A0A0A);
          font-weight: 500;
        }
        .vc-result-username {
          font-size: 12px;
          color: var(--text-muted, #ABA49B);
        }
        .vc-result-add-badge {
          font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
          color: var(--gold, #C9A84C); white-space: nowrap;
          font-weight: 600;
        }
        .vc-no-results {
          padding: 12px 14px;
          font-size: 13px;
          color: var(--text-secondary, #6B6560);
        }
        .vc-invite-row {
          display: flex;
          gap: 6px;
          align-items: center;
          padding: 8px 0 0;
        }
        .vc-invite-input {
          flex: 1;
          background: var(--surface-2, #F5F3EF);
          border: 1px solid var(--border, #E0DAD0);
          border-radius: 8px;
          color: var(--text-primary, #0A0A0A);
          -webkit-text-fill-color: var(--text-primary, #0A0A0A);
          caret-color: var(--gold, #C9A84C);
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
        }
        .vc-invite-input:focus { border-color: var(--gold, #C9A84C); }
        .vc-invite-input::placeholder {
          color: var(--text-muted, #ABA49B);
          -webkit-text-fill-color: var(--text-muted, #ABA49B);
        }
        .vc-invite-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid var(--gold);
          background: var(--gold);
          color: var(--black);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .vc-invite-btn:disabled { opacity: 0.5; cursor: default; }
        .vc-invite-sent {
          font-size: 13px;
          color: var(--gold);
          padding: 4px 0;
        }
        .vc-add-friend-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 14px;
          border-radius: 8px;
          border: 1px dashed rgba(250,250,250,0.3);
          background: transparent;
          color: rgba(250,250,250,0.55);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.18s;
        }
        .vc-add-friend-btn:hover {
          border-color: rgba(250,250,250,0.55);
          color: rgba(250,250,250,0.8);
        }

        /* Summary editable */
        .vc-summary-textarea {
          width: 100%;
          /* Renders on the LIGHT .voice-review surface — dark text, faint
             gold-tinted bg + visible gold border so it reads as an
             editable field at a glance. */
          background: rgba(201,168,76,0.06);
          border: 1px solid var(--gold-dim, #9A7B2E);
          border-radius: 8px;
          color: var(--text-primary, #0A0A0A);
          -webkit-text-fill-color: var(--text-primary, #0A0A0A);
          caret-color: var(--gold, #C9A84C);
          padding: 10px 12px;
          font-size: 14px;
          line-height: 1.6;
          font-family: inherit;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .vc-summary-textarea:focus {
          border-color: var(--gold, #C9A84C);
          box-shadow: 0 4px 16px -10px var(--gold, #C9A84C);
        }
        .vc-summary-textarea::placeholder {
          color: var(--text-muted, #ABA49B);
          -webkit-text-fill-color: var(--text-muted, #ABA49B);
        }

        /* Review-state header (text-first form title + voice toggle) */
        .vc-review-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
          padding-bottom: 14px;
          border-bottom: 1px solid var(--border, #E0DAD0);
        }
        .vc-review-title {
          margin: 0;
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 26px;
          font-weight: 500;
          color: var(--text-primary, #0A0A0A);
          letter-spacing: -0.01em;
        }
        .vc-voice-mode-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid var(--gold, #C9A84C);
          background: rgba(201,168,76,0.08);
          color: var(--gold, #C9A84C);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.01em;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.18s, transform 0.1s;
        }
        .vc-voice-mode-btn:hover {
          background: rgba(201,168,76,0.16);
        }
        .vc-voice-mode-btn:active { transform: scale(0.97); }

        /* Voice prompts */
        .voice-prompts {
          display: flex; flex-direction: column; gap: 6px;
          margin-bottom: 16px;
        }
        .voice-prompt-line {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 18px;
          color: rgba(250,250,250,0.85);
          font-style: italic;
          letter-spacing: 0.01em;
          line-height: 1.4;
          text-align: center;
        }
      `}</style>
      <div className="voice-capture-content">
        <button className="voice-capture-close" onClick={handleClose}>&times;</button>

        {/* Ready state */}
        {state === 'ready' && (
          <div className="voice-state voice-ready" onClick={startRecording} style={{ cursor: 'pointer' }}>
            <div className="voice-breathe">
              <span style={{ fontSize: 48 }}>🎙️</span>
            </div>
            <div className="voice-prompts">
              <p className="voice-prompt-line">&ldquo;Walk me through the trip &mdash; cities, food, people, moments.&rdquo;</p>
              <p className="voice-prompt-line">&ldquo;Don&rsquo;t worry about order &mdash; I&rsquo;ll pull out the places, dates, and tags.&rdquo;</p>
            </div>
            <p className="voice-instruction">
              Ramble freely. Mention every city or country &mdash; each becomes a tagged stop with the right flag.
            </p>
            <p className="voice-sub-instruction">Tap anywhere to start &middot; Spacebar on desktop</p>
            <button className="voice-type-instead" onClick={(e) => { e.stopPropagation(); handleTypeInstead(); }}>
              ← Back to typing
            </button>
          </div>
        )}

        {/* Recording state */}
        {state === 'recording' && !isReRecording && (
          <div className="voice-state voice-recording" onClick={stopRecording} style={{ cursor: 'pointer' }}>
            <div className="voice-pulse-container">
              <div className="voice-pulse"></div>
              <div className="voice-stop-btn">
                <span className="stop-icon">⏹</span>
              </div>
            </div>
            <p className="voice-listening">Listening…</p>
            <p className="voice-timer">{formatTime(recordingTime)}</p>
            <p className="voice-sub-instruction">Tap anywhere to finish · Spacebar</p>
          </div>
        )}

        {/* Recording state (re-record) */}
        {state === 'recording' && isReRecording && (
          <div className="voice-state voice-recording" onClick={stopRecording} style={{ cursor: 'pointer' }}>
            <div className="voice-pulse-container">
              <div className="voice-pulse"></div>
              <div className="voice-stop-btn">
                <span className="stop-icon">⏹</span>
              </div>
            </div>
            <p className="voice-listening">Recording correction…</p>
            <p className="voice-timer">{formatTime(recordingTime)}</p>
            <p className="voice-sub-instruction">Tap anywhere to finish · Spacebar</p>
          </div>
        )}

        {/* Processing state */}
        {state === 'processing' && (
          <div className="voice-state voice-processing">
            <div className="voice-spinner"></div>
            <p className="loading-phrase">{processingPhrase}</p>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="voice-state voice-error">
            <p className="voice-error-message">{errorMessage}</p>
            <div className="voice-error-actions">
              <button className="voice-retry-btn" onClick={handleRetry}>Retry</button>
              <button className="voice-type-instead" onClick={handleTypeInstead}>Type instead</button>
            </div>
          </div>
        )}

        {/* Review state */}
        {state === 'review' && (
          <div className="voice-state voice-review">
            {/* Header: title + opt-in voice mode toggle.
                The form is text-first by default; tapping the gold pill
                drops the user into the existing voice-record flow which
                fills these same fields after transcription + AI parse. */}
            <div className="vc-review-header">
              <h2 className="vc-review-title">
                {locations.length > 1 ? 'New trip' : 'New memory'}
              </h2>
              {!transcript && (
                <button
                  type="button"
                  className="vc-voice-mode-btn"
                  onClick={() => { resetAll(); setState('ready'); }}
                  title="Dictate a multi-place ramble; AI extracts stops, tags, year, and highlights"
                >
                  ✦ Tell it as a story
                </button>
              )}
            </div>

            {/* Verbatim transcript */}
            {transcript && (
              <div className="voice-transcript-card">
                <h4>Your words</h4>
                <p className="voice-transcript-text">{transcript}</p>
                {correctionTranscript && (
                  <>
                    <h4>Correction</h4>
                    <p className="voice-transcript-text">{correctionTranscript}</p>
                  </>
                )}
              </div>
            )}

            {/* AI structuring error */}
            {structuringError && (
              <div className="voice-structuring-error">
                <p>Could not organize automatically.</p>
                <button className="voice-retry-btn" onClick={() => {
                  setErrorStage('structuring');
                  structureTranscript(transcript, correctionTranscript || null);
                }}>Retry</button>
              </div>
            )}

            {/* Editable fields */}
            <div className="voice-review-fields">
              <label className="voice-field-label">
                {locations.length > 1 ? 'Trip name' : 'Place name'}
                {isStructuring && !placeName ? (
                  <div className="vc-skeleton vc-skeleton-line vc-skeleton-medium" style={{ marginTop: 6 }} />
                ) : (
                  <input
                    type="text"
                    className="voice-field-input"
                    value={placeName}
                    onChange={(e) => setPlaceName(e.target.value)}
                    placeholder={locations.length > 1 ? 'e.g. Europe Summer 2024' : 'Where was this?'}
                  />
                )}
              </label>

              {/* Stops (multi-location) */}
              <div className="voice-field-label">
                Stops
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 6 }}>
                  {locations.map((loc, i) => (
                    <span key={i} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px 4px 12px', borderRadius: 20,
                      background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.35)',
                      color: 'var(--gold)', fontSize: 13,
                    }}>
                      📍 {loc}
                      <button
                        type="button"
                        onClick={() => setLocations(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: 0, fontSize: 14 }}
                      >×</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="voice-field-input"
                    value={locationInput}
                    onChange={e => setLocationInput(e.target.value)}
                    onKeyDown={e => {
                      if ((e.key === 'Enter' || e.key === ',') && locationInput.trim()) {
                        e.preventDefault();
                        setLocations(prev => [...prev, locationInput.trim()]);
                        setLocationInput('');
                      }
                    }}
                    placeholder="Add a stop… (Enter to add)"
                    style={{ flex: 1 }}
                  />
                  {locationInput.trim() && (
                    <button
                      type="button"
                      onClick={() => { setLocations(prev => [...prev, locationInput.trim()]); setLocationInput(''); }}
                      style={{
                        padding: '0 14px', borderRadius: 8, border: '1px solid var(--gold)',
                        background: 'transparent', color: 'var(--gold)', fontSize: 13,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >+ Add</button>
                  )}
                </div>
              </div>

              {/* With whom — Travel Together account links only.
                  Solo / Family / free-text presets removed: companions must
                  resolve to real accounts so the memory shows up on the
                  friend's profile too. Friends without an account get an
                  inline email invite. */}
              <div className="voice-field-label">
                With whom
                <div className="vc-companion-wrap">
                  {/* Tagged friends (chips) */}
                  {companions.length > 0 && (
                    <div className="vc-friend-chips">
                      {companions.map((c, i) => (
                        <span key={i} className="vc-friend-chip">
                          <span className="vc-friend-chip-avatar">
                            {c.avatar
                              ? <img src={c.avatar} alt={c.label} />
                              : c.label[0].toUpperCase()
                            }
                          </span>
                          {c.label}
                          <button
                            type="button"
                            className="vc-friend-chip-remove"
                            onClick={() => removeCompanion(i)}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Always-visible search input.
                      Accepts a name/username/email — if no Travel Together
                      account matches, the inline invite-by-email path
                      surfaces below the dropdown. */}
                  <div className="vc-search-wrap" onClick={e => e.stopPropagation()}>
                    <input
                      ref={companionSearchRef}
                      type="text"
                      className="vc-search-input"
                      placeholder="Search Travel Together by name, @username, or email…"
                      value={companionSearch}
                      onChange={e => {
                        setCompanionSearch(e.target.value);
                        setInviteSent(false);
                        setShowInviteInput(false);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          setCompanionSearch('');
                        }
                      }}
                    />
                    {/* Static hint that explains the dual flow so users
                        know the email-invite path exists before they even
                        start typing. */}
                    {companionSearch.trim().length === 0 && (
                      <p className="vc-search-hint">
                        Tag friends already on Travel Together — or paste their
                        email to send an invite.
                      </p>
                    )}

                    {/* Results dropdown */}
                    {companionSearch.trim().length > 0 && (
                      <div className="vc-search-dropdown">
                        {companionSearching && (
                          <div className="vc-no-results">Searching…</div>
                        )}
                        {!companionSearching && companionResults.map(user => (
                          <div
                            key={user.id}
                            className="vc-search-result"
                            onClick={() => {
                              addUserCompanion(user);
                              // Auto-send friend request if not already friends
                              if (!user.isFriend) {
                                api.post('/friends/request', { userId: user.id }).catch(() => {});
                              }
                            }}
                          >
                            <div className="vc-result-avatar">
                              {user.avatarUrl || user.avatar_url
                                ? <img src={user.avatarUrl || user.avatar_url} alt={user.displayName || user.display_name} />
                                : (user.displayName || user.display_name || user.username || '?')[0].toUpperCase()
                              }
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="vc-result-name">{user.displayName || user.display_name || user.username}</div>
                              {user.username && <div className="vc-result-username">@{user.username}</div>}
                            </div>
                            {!user.isFriend && (
                              <span className="vc-result-add-badge">+ Add friend</span>
                            )}
                          </div>
                        ))}
                        {noResults && (
                          <div className="vc-no-results">
                            No Travel Together account for &ldquo;{companionSearch}&rdquo;.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Invite path when no matching account */}
                    {noResults && !showInviteInput && (
                      <button
                        type="button"
                        className="vc-add-friend-btn"
                        style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                        onClick={() => {
                          setShowInviteInput(true);
                          if (looksLikeEmail) setInviteEmail(companionSearch.trim());
                        }}
                      >
                        ✉️ Invite them to Travel Together by email
                      </button>
                    )}

                    {showInviteInput && (
                      inviteSent ? (
                        <p className="vc-invite-sent">✓ Invite sent!</p>
                      ) : (
                        <div className="vc-invite-row">
                          <input
                            type="email"
                            className="vc-invite-input"
                            placeholder="friend@email.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') sendInvite(); }}
                          />
                          <button
                            type="button"
                            className="vc-invite-btn"
                            onClick={sendInvite}
                            disabled={inviteSending || !inviteEmail.trim()}
                          >
                            {inviteSending ? 'Sending…' : 'Send invite'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              <label className="voice-field-label">
                Tags
                {isStructuring && selectedTags.length === 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <div className="vc-skeleton vc-skeleton-tag" />
                    <div className="vc-skeleton vc-skeleton-tag" style={{ width: 96 }} />
                    <div className="vc-skeleton vc-skeleton-tag" style={{ width: 70 }} />
                  </div>
                ) : (
                  <TagPicker
                    selectedTags={selectedTags}
                    onTagsChange={setSelectedTags}
                  />
                )}
              </label>

              <label className="voice-field-label">
                Highlights
                {isStructuring && !summaryText ? (
                  <div style={{ marginTop: 6 }}>
                    <p className="vc-structuring-label">✦ {processingPhrase}</p>
                    <div className="vc-skeleton vc-skeleton-line vc-skeleton-medium" />
                    <div className="vc-skeleton vc-skeleton-line vc-skeleton-short" />
                    <div className="vc-skeleton vc-skeleton-line" style={{ width: '70%' }} />
                  </div>
                ) : (
                  <textarea
                    className="vc-summary-textarea"
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    placeholder="Key moments from this trip…&#10;- What made it special"
                    rows={4}
                  />
                )}
              </label>

              <label className="voice-field-label">
                Note (optional)
                <textarea
                  className="voice-field-textarea"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </label>

              <div className="voice-field-row">
                <label className="voice-field-label voice-field-half">
                  Year visited
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="voice-field-input"
                    value={visitYear}
                    onChange={(e) => setVisitYear(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 2024"
                  />
                </label>

                <div className="voice-field-label voice-field-half">
                  Rating
                  <div className="voice-rating-picker">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        className={`voice-rating-heart ${v <= rating ? 'active' : ''}`}
                        onClick={() => setRating(v === rating ? 0 : v)}
                        type="button"
                      >
                        {v <= rating ? '❤️' : '🫶'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save error */}
            {errorStage === 'save' && (
              <p className="voice-save-error">{errorMessage}</p>
            )}

            {/* Actions */}
            <div className="voice-review-actions">
              {transcript && (
                <button className="voice-rerecord-btn" onClick={handleReRecord}>
                  Re-record a correction
                </button>
              )}
              <button
                className="voice-save-btn"
                onClick={handleSave}
                disabled={!placeName.trim() || saving}
              >
                {saving ? 'Saving...' : 'Save Memory'}
              </button>
              <button className="voice-startover-btn" onClick={resetAll}>
                Start over
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
