// VoiceCapture component - full-screen modal for recording a memory via voice.
//
// Spec: docs/app/spec.md Section 4, Section 5 (Voice Input Pipeline)
// @implements REQ-VOICE-001, REQ-VOICE-002, REQ-VOICE-005, REQ-VOICE-007

import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';

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
 */
export default function VoiceCapture({ isOpen, onClose, onSaved }) {
  const [state, setState] = useState('ready'); // ready | recording | processing | review | error
  const [errorMessage, setErrorMessage] = useState('');
  const [errorStage, setErrorStage] = useState(''); // recording | upload | transcription | structuring | save
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [correctionTranscript, setCorrectionTranscript] = useState('');
  const [aiProposal, setAiProposal] = useState(null);
  const [structuringError, setStructuringError] = useState(false);
  const [isReRecording, setIsReRecording] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [showCompanionSearch, setShowCompanionSearch] = useState(false);
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
        setCompanionResults(res.data || []);
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
    setState('ready');
    setErrorMessage('');
    setErrorStage('');
    setRecordingTime(0);
    setTranscript('');
    setCorrectionTranscript('');
    setAiProposal(null);
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
    setShowCompanionSearch(false);
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

  // Spacebar to start OR stop recording
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === ' ') {
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
      // Pre-fill companions from AI (convert string array to objects)
      if (proposal.companions && Array.isArray(proposal.companions)) {
        const mapped = proposal.companions.map(c => {
          if (c === 'Solo' || c === 'Family') return { type: 'preset', label: c };
          return { type: 'name', label: c };
        });
        setCompanions(mapped);
      }
      // Pre-fill multi-location stops from AI
      if (proposal.locations && Array.isArray(proposal.locations) && proposal.locations.length > 1) {
        setLocations(proposal.locations);
      }
      setState('review');
    } catch {
      setStructuringError(true);
      setNote(mainTranscript);
      setState('review');
    }
  }

  // Companion helpers
  function isPresetActive(label) {
    return companions.some(c => c.type === 'preset' && c.label === label);
  }

  function togglePreset(label) {
    if (isPresetActive(label)) {
      setCompanions(prev => prev.filter(c => !(c.type === 'preset' && c.label === label)));
    } else {
      setCompanions(prev => [...prev, { type: 'preset', label }]);
    }
  }

  function addUserCompanion(user) {
    const already = companions.some(c => c.userId === user.id || c.label === user.username);
    if (!already) {
      setCompanions(prev => [...prev, {
        type: 'user',
        label: user.display_name || user.username,
        userId: user.id,
        avatar: user.avatar_url,
      }]);
    }
    setCompanionSearch('');
    setCompanionResults([]);
    setShowCompanionSearch(false);
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
      });

      // Fire-and-forget: save additional location stops
      const pinId = res.data?.data?.id;
      if (pinId && locations.length > 0) {
        locations.forEach(loc => {
          api.post(`/pins/${pinId}/locations`, { placeName: loc }).catch(() => {});
        });
      }

      if (onSaved) onSaved();
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
        .vc-preset-row {
          display: flex;
          gap: 8px;
        }
        .vc-preset-btn {
          flex: 1;
          padding: 10px 0;
          border-radius: 10px;
          border: 1.5px solid rgba(250,250,250,0.25);
          background: rgba(250,250,250,0.07);
          color: rgba(250,250,250,0.75);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .vc-preset-btn.active {
          background: var(--gold);
          color: var(--black);
          border-color: var(--gold);
          font-weight: 700;
        }
        .vc-preset-btn:hover:not(.active) {
          border-color: rgba(250,250,250,0.5);
          background: rgba(250,250,250,0.12);
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
          background: rgba(250,250,250,0.08);
          border: 1px solid rgba(250,250,250,0.2);
          border-radius: 10px;
          color: rgba(250,250,250,0.9);
          padding: 9px 14px;
          font-size: 14px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.18s;
        }
        .vc-search-input:focus {
          border-color: rgba(201,168,76,0.5);
        }
        .vc-search-input::placeholder { color: rgba(250,250,250,0.35); }
        .vc-search-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          background: #1a1a1a;
          border: 1px solid rgba(250,250,250,0.15);
          border-radius: 10px;
          overflow: hidden;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }
        .vc-search-result {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .vc-search-result:hover { background: rgba(250,250,250,0.07); }
        .vc-result-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(201,168,76,0.25);
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
          color: rgba(250,250,250,0.9);
          font-weight: 500;
        }
        .vc-result-username {
          font-size: 12px;
          color: rgba(250,250,250,0.4);
        }
        .vc-no-results {
          padding: 12px 14px;
          font-size: 13px;
          color: rgba(250,250,250,0.45);
        }
        .vc-invite-row {
          display: flex;
          gap: 6px;
          align-items: center;
          padding: 8px 0 0;
        }
        .vc-invite-input {
          flex: 1;
          background: rgba(250,250,250,0.08);
          border: 1px solid rgba(250,250,250,0.2);
          border-radius: 8px;
          color: rgba(250,250,250,0.9);
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
        }
        .vc-invite-input::placeholder { color: rgba(250,250,250,0.35); }
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
          background: rgba(201,168,76,0.06);
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
          transition: border-color 0.18s;
        }
        .vc-summary-textarea:focus {
          border-color: rgba(201,168,76,0.6);
        }
        .vc-summary-textarea::placeholder { color: rgba(250,250,250,0.3); }

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
              <p className="voice-prompt-line">&ldquo;What made this trip special?&rdquo;</p>
              <p className="voice-prompt-line">&ldquo;What were your favorite places or experiences?&rdquo;</p>
            </div>
            <p className="voice-instruction">
              Just talk &mdash; the moments, the food, the people, the feelings. Don&rsquo;t edit yourself.
            </p>
            <p className="voice-sub-instruction">Tap anywhere to start &middot; Spacebar on desktop</p>
            <button className="voice-type-instead" onClick={(e) => { e.stopPropagation(); handleTypeInstead(); }}>
              Type instead
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
            <p>Transcribing your memory...</p>
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
                <input
                  type="text"
                  className="voice-field-input"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  placeholder={locations.length > 1 ? 'e.g. Europe Summer 2024' : 'Where was this?'}
                />
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

              {/* With whom — redesigned */}
              <div className="voice-field-label">
                With whom
                <div className="vc-companion-wrap">
                  {/* Solo / Family large toggles */}
                  <div className="vc-preset-row">
                    <button
                      type="button"
                      className={`vc-preset-btn ${isPresetActive('Solo') ? 'active' : ''}`}
                      onClick={() => togglePreset('Solo')}
                    >
                      🧍 Solo
                    </button>
                    <button
                      type="button"
                      className={`vc-preset-btn ${isPresetActive('Family') ? 'active' : ''}`}
                      onClick={() => togglePreset('Family')}
                    >
                      👨‍👩‍👧 Family
                    </button>
                  </div>

                  {/* Selected friends chips */}
                  {companions.filter(c => c.type !== 'preset').length > 0 && (
                    <div className="vc-friend-chips">
                      {companions.filter(c => c.type !== 'preset').map((c, i) => (
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
                            onClick={() => removeCompanion(companions.indexOf(c))}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Add friend search */}
                  {showCompanionSearch ? (
                    <div className="vc-search-wrap" onClick={e => e.stopPropagation()}>
                      <input
                        ref={companionSearchRef}
                        autoFocus
                        type="text"
                        className="vc-search-input"
                        placeholder="Search by name or username…"
                        value={companionSearch}
                        onChange={e => {
                          setCompanionSearch(e.target.value);
                          setInviteSent(false);
                          setShowInviteInput(false);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Escape') {
                            setShowCompanionSearch(false);
                            setCompanionSearch('');
                          }
                        }}
                      />

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
                              onClick={() => addUserCompanion(user)}
                            >
                              <div className="vc-result-avatar">
                                {user.avatar_url
                                  ? <img src={user.avatar_url} alt={user.display_name} />
                                  : (user.display_name || user.username || '?')[0].toUpperCase()
                                }
                              </div>
                              <div>
                                <div className="vc-result-name">{user.display_name || user.username}</div>
                                {user.username && <div className="vc-result-username">@{user.username}</div>}
                              </div>
                            </div>
                          ))}
                          {noResults && (
                            <div className="vc-no-results">
                              No users found for &ldquo;{companionSearch}&rdquo;
                            </div>
                          )}
                        </div>
                      )}

                      {/* Invite if no results */}
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
                          ✉️ Invite a friend to Travel Together
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
                  ) : (
                    <button
                      type="button"
                      className="vc-add-friend-btn"
                      onClick={() => setShowCompanionSearch(true)}
                    >
                      + Add a friend
                    </button>
                  )}
                </div>
              </div>

              <label className="voice-field-label">
                Tags
                <TagPicker
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                />
              </label>

              <label className="voice-field-label">
                Summary
                <textarea
                  className="vc-summary-textarea"
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  placeholder="A brief summary of this memory…&#10;- What made it special&#10;- Key moments"
                  rows={4}
                />
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
                    type="number"
                    className="voice-field-input"
                    value={visitYear}
                    onChange={(e) => setVisitYear(e.target.value)}
                    placeholder="e.g. 2024"
                    min="1900"
                    max="2100"
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
