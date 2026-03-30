// DreamPinCreator component — voice-first dream pin creation with AI destination insights.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-DREAM-001, REQ-DREAM-002, REQ-SOLO-001

import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload, EXPERIENCE_TAGS, DEFAULT_GRADIENT_START, DEFAULT_GRADIENT_END, DEFAULT_EMOJI } from '../utils/tags';

/**
 * DreamPinCreator — voice-first modal for adding a dream pin.
 *
 * Flow: record → transcribing → review (with AI insights) → saving
 *
 * @implements REQ-DREAM-001 (user creates dream pin with destination/experience)
 * @implements REQ-DREAM-002 (dream pins with Unsplash auto-fetch + gradient/emoji fallback)
 * @implements REQ-SOLO-001 (voice-first, works day-1 with no friends)
 */
export default function DreamPinCreator({ isOpen, onClose, onSaved }) {
  // ── Step machine ──
  // 'record' | 'transcribing' | 'review' | 'saving'
  const [step, setStep] = useState('record');

  // Recording
  const [recordingState, setRecordingState] = useState('idle'); // idle | recording
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Review fields
  const [placeName, setPlaceName] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [dreamNote, setDreamNote] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcribeError, setTranscribeError] = useState('');

  // Unsplash
  const [unsplashImage, setUnsplashImage] = useState(null);
  const [fetchingImage, setFetchingImage] = useState(false);
  const unsplashDebounceRef = useRef(null);

  // AI insights
  const [insights, setInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const insightsTokenRef = useRef(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Reset ──
  function reset() {
    setStep('record');
    setRecordingState('idle');
    setRecordingTime(0);
    setPlaceName('');
    setSelectedTags([]);
    setDreamNote('');
    setTranscript('');
    setTranscribeError('');
    setUnsplashImage(null);
    setFetchingImage(false);
    setInsights(null);
    setLoadingInsights(false);
    setSaving(false);
    setError('');
    audioChunksRef.current = [];
    audioBlobRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function handleClose() {
    stopMic();
    reset();
    onClose();
  }

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

  // ── Recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      setRecordingState('recording');
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch {
      setTranscribeError('Microphone access needed. Check browser permissions.');
    }
  }, []);

  // Spacebar start/stop recording
  useEffect(() => {
    function handleKey(e) {
      if (!isOpen || step !== 'record') return;
      if (e.key === ' ') {
        e.preventDefault();
        if (recordingState === 'idle') startRecording();
        else if (recordingState === 'recording') stopRecordingAndTranscribe();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, step, recordingState, startRecording]);

  function stopRecordingAndTranscribe() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordingState('idle');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setTimeout(() => transcribeAndStructure(), 300);
    }
  }

  async function transcribeAndStructure() {
    setStep('transcribing');
    const blob = audioBlobRef.current;
    if (!blob) { setTranscribeError('No audio captured. Try again.'); setStep('record'); return; }
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'dream.webm');
      const txRes = await api.post('/voice/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const tx = txRes.data?.data?.transcript || txRes.data?.transcript || '';
      setTranscript(tx);

      const strRes = await api.post('/voice/structure', { transcript: tx, context: 'dream' });
      const proposal = strRes.data?.data || strRes.data || {};
      setPlaceName(proposal.place_name || proposal.placeName || '');
      setSelectedTags(Array.isArray(proposal.tags) ? proposal.tags.slice(0, 3) : []);
      if (proposal.summary) setDreamNote(proposal.summary);
      setStep('review');
    } catch {
      setTranscribeError('Transcription failed — type your dream below.');
      setStep('review');
    }
  }

  // ── Unsplash on place name change ──
  function handlePlaceNameChange(val) {
    setPlaceName(val);
    setUnsplashImage(null);
    clearTimeout(unsplashDebounceRef.current);
    if (val.trim().length < 3) return;
    unsplashDebounceRef.current = setTimeout(async () => {
      setFetchingImage(true);
      try {
        const res = await api.post('/location/unsplash', { placeName: val.trim(), tags: selectedTags });
        if (res.data && !res.data.fallback) setUnsplashImage(res.data);
      } catch { /* silent */ }
      finally { setFetchingImage(false); }
    }, 800);
  }

  // ── AI insights when place + tags change ──
  const tagsKey = selectedTags.join(',');
  useEffect(() => {
    if (step !== 'review') return;
    if (!placeName.trim() || selectedTags.length === 0) {
      setInsights(null);
      setLoadingInsights(false);
      return;
    }
    const token = Symbol();
    insightsTokenRef.current = token;
    setLoadingInsights(true);
    setInsights(null);

    api.post('/voice/dream-insights', { placeName: placeName.trim(), tags: selectedTags })
      .then(res => {
        if (insightsTokenRef.current !== token) return;
        setInsights(res.data?.data || null);
      })
      .catch(() => {})
      .finally(() => {
        if (insightsTokenRef.current === token) setLoadingInsights(false);
      });
  }, [placeName, tagsKey, step]);

  // ── Save ──
  async function handleSave() {
    if (!placeName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const tagPayload = tagNamesToPayload(selectedTags);
      await api.post('/pins', {
        pinType: 'dream',
        placeName: placeName.trim(),
        dreamNote: dreamNote || null,
        aiSummary: dreamNote || null,
        transcript: transcript || null,
        tags: tagPayload,
        unsplashImageUrl: unsplashImage ? unsplashImage.imageUrl : null,
        unsplashAttribution: unsplashImage?.attribution
          ? `Photo by ${unsplashImage.attribution.photographerName} on Unsplash`
          : null,
      });
      if (onSaved) onSaved();
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  function getPreviewGradient() {
    if (selectedTags.length > 0) {
      const tag = EXPERIENCE_TAGS.find(t => t.name === selectedTags[0]);
      if (tag) return { gradient: `linear-gradient(135deg, ${tag.gradientStart}, ${tag.gradientEnd})`, emoji: tag.emoji };
    }
    return { gradient: `linear-gradient(135deg, ${DEFAULT_GRADIENT_START}, ${DEFAULT_GRADIENT_END})`, emoji: DEFAULT_EMOJI };
  }

  function formatTime(s) {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  if (!isOpen) return null;

  // ══════════════════════════════════════
  //  RECORD step
  // ══════════════════════════════════════
  if (step === 'record') {
    return (
      <div
        className="dream-voice-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && recordingState === 'idle') startRecording();
        }}
      >
        <div className="dream-voice-content">
          <button className="dream-voice-close" onClick={handleClose}>&times;</button>

          <p className="dream-voice-eyebrow">New Dream</p>

          {recordingState === 'idle' ? (
            <div className="dream-voice-idle" onClick={startRecording}>
              <div className="dream-voice-circle">
                <div className="dream-voice-breathe-ring" />
                <span className="dream-voice-icon">✦</span>
              </div>
              <p className="dream-voice-prompt">Talk about where you dream of going</p>
              <p className="dream-voice-hint">Tap anywhere · Spacebar</p>
            </div>
          ) : (
            <div className="dream-voice-idle" onClick={stopRecordingAndTranscribe}>
              <div className="dream-voice-circle dream-voice-circle-active">
                <div className="dream-voice-pulse-ring" />
                <span className="dream-voice-icon">■</span>
              </div>
              <p className="dream-voice-listening">Listening…</p>
              <p className="dream-voice-timer">{formatTime(recordingTime)}</p>
              <p className="dream-voice-hint">Tap to finish</p>
            </div>
          )}

          {transcribeError && <p className="dream-voice-error-text">{transcribeError}</p>}

          <button className="dream-voice-skip" onClick={() => setStep('review')}>
            Type instead
          </button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  //  TRANSCRIBING step
  // ══════════════════════════════════════
  if (step === 'transcribing') {
    return (
      <div className="dream-voice-overlay">
        <div className="dream-voice-content">
          <div className="dream-voice-processing">
            <div className="dream-voice-spinner" />
            <p className="dream-voice-processing-text">Understanding your dream…</p>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════
  //  REVIEW step
  // ══════════════════════════════════════
  const preview = getPreviewGradient();

  return (
    <div className="dream-creator-modal">
      <div className="dream-creator-content">
        <button className="dream-creator-close" onClick={handleClose}>&times;</button>

        {/* Hero image / gradient */}
        <div
          className="dream-creator-preview"
          style={unsplashImage
            ? { backgroundImage: `url(${unsplashImage.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: preview.gradient }}
        >
          {!unsplashImage && <span className="dream-creator-preview-emoji">{preview.emoji}</span>}
          {fetchingImage && (
            <span style={{ position: 'absolute', top: 12, right: 12, fontSize: 11, color: 'rgba(250,250,250,0.6)', letterSpacing: '0.08em' }}>
              Loading…
            </span>
          )}
          {placeName.trim() && (
            <span className="dream-creator-preview-place">{placeName}</span>
          )}
          {unsplashImage?.attribution && (
            <span className="dream-creator-preview-attribution">
              Photo by {unsplashImage.attribution.photographerName} on Unsplash
            </span>
          )}
        </div>

        {/* Place name */}
        <input
          type="text"
          className="dream-creator-place-input"
          value={placeName}
          onChange={(e) => handlePlaceNameChange(e.target.value)}
          placeholder="Where do you dream of going?"
          autoFocus={!placeName}
        />

        {/* Tag picker */}
        <div>
          <p className="dream-creator-section-label">What draws you there</p>
          <TagPicker
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            maxTags={3}
          />
        </div>

        {/* AI destination insights */}
        {(loadingInsights || (insights && insights.highlights && insights.highlights.length > 0)) && (
          <div className="dream-insights-card">
            <p className="dream-insights-eyebrow">✦ What awaits</p>

            {loadingInsights && !insights && (
              <div className="dream-insights-loading">
                <div className="dream-insights-spinner" />
                <span>Exploring {placeName}…</span>
              </div>
            )}

            {insights?.highlights?.map((h, i) => (
              <div key={i} className={`dream-insights-item${i > 0 ? ' dream-insights-item-border' : ''}`}>
                <p className="dream-insights-tag-label">{h.tag}</p>
                <p className="dream-insights-headline">{h.headline}</p>
                <p className="dream-insights-desc">{h.description}</p>
              </div>
            ))}
          </div>
        )}

        {/* Optional note */}
        <textarea
          className="dream-creator-note"
          value={dreamNote}
          onChange={(e) => setDreamNote(e.target.value)}
          placeholder="Why do you want to go? (optional)"
          rows={2}
        />

        {/* Voice transcript — collapsible */}
        {transcript && (
          <details className="dream-transcript-details">
            <summary className="dream-transcript-summary">Your voice note</summary>
            <p className="dream-transcript-text">{transcript}</p>
          </details>
        )}

        {error && <p className="dream-creator-error">{error}</p>}

        <button
          className="dream-creator-save-btn"
          onClick={handleSave}
          disabled={!placeName.trim() || saving}
        >
          {saving ? 'Saving…' : 'Add to Dreams'}
        </button>

        <button
          className="dream-creator-rerecord"
          onClick={() => { setStep('record'); setTranscript(''); setTranscribeError(''); }}
        >
          {transcript ? 'Re-record voice note' : 'Add voice note'}
        </button>
      </div>
    </div>
  );
}
