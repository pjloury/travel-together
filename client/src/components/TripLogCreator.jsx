// Trip log creation modal — form-first, with voice as opt-in secondary
import { useState, useRef, useCallback } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload } from '../utils/tags';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 30 }, (_, i) => CURRENT_YEAR - i);
const MONTH_OPTIONS = [
  { value: '', label: 'Unknown month' },
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export default function TripLogCreator({ isOpen, onClose, onSaved }) {
  // form state
  const [placeName, setPlaceName] = useState('');
  const [visitYear, setVisitYear] = useState(CURRENT_YEAR);
  const [visitMonth, setVisitMonth] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // voice state
  const [voiceStep, setVoiceStep] = useState('form'); // 'form' | 'record' | 'processing'
  const [recordingState, setRecordingState] = useState('idle'); // 'idle' | 'recording'
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceError, setVoiceError] = useState('');
  const [transcript, setTranscript] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioBlobRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  function reset() {
    setPlaceName(''); setVisitYear(CURRENT_YEAR); setVisitMonth('');
    setNote(''); setRating(null); setSelectedTags([]);
    setError(null); setSaving(false);
    setVoiceStep('form'); setRecordingState('idle'); setRecordingTime(0);
    setVoiceError(''); setTranscript('');
    audioChunksRef.current = []; audioBlobRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function stopMic() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function handleClose() { stopMic(); reset(); onClose(); }

  // ── Voice recording ──
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/wav';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        audioBlobRef.current = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecordingState('recording');
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch {
      setVoiceError('Microphone access needed. Check browser permissions.');
    }
  }, []);

  function stopAndTranscribe() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecordingState('idle');
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setTimeout(doTranscribe, 300);
    }
  }

  async function doTranscribe() {
    setVoiceStep('processing');
    const blob = audioBlobRef.current;
    if (!blob) { setVoiceError('No audio captured.'); setVoiceStep('record'); return; }
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'log.webm');
      const token = localStorage.getItem('token');
      const txResp = await fetch(`${API_URL}/voice/transcribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const txData = await txResp.json();
      if (!txResp.ok) throw new Error(txData.error || 'Transcription failed');
      const tx = txData.data?.transcript || '';
      setTranscript(tx);

      const strRes = await api.post('/voice/structure', { transcript: tx, context: 'memory' });
      const p = strRes.data?.data || strRes.data || {};
      if (p.place_name) setPlaceName(p.place_name);
      if (p.visit_year) setVisitYear(p.visit_year);
      if (p.visit_month) setVisitMonth(p.visit_month);
      if (p.rating) setRating(p.rating);
      if (Array.isArray(p.tags) && p.tags.length) setSelectedTags(p.tags.slice(0, 3));
      if (p.summary) {
        const bullets = Array.isArray(p.summary)
          ? p.summary.map(s => `- ${s}`).join('\n')
          : `- ${p.summary}`;
        setNote(bullets);
      }
      setVoiceStep('form');
    } catch (err) {
      setVoiceError(err.message || 'Could not process — fill in the fields below.');
      setVoiceStep('form');
    }
  }

  function formatTime(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  // ── Save ──
  async function handleSave() {
    if (!placeName.trim()) { setError('Place name is required'); return; }
    setSaving(true); setError(null);
    try {
      const result = await api.post('/trip-logs', {
        placeName: placeName.trim(),
        visitYear: visitYear || null,
        visitMonth: visitMonth || null,
        note: note.trim() || null,
        rating: rating || null,
        tags: tagNamesToPayload(selectedTags),
      });
      reset();
      onSaved(result.data);
    } catch (err) {
      setError(err.message || 'Failed to save trip log');
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  // ── Voice record screen ──
  if (voiceStep === 'record') {
    return (
      <div className="modal-overlay" onClick={handleClose}>
        <div className="trip-log-creator tl-voice-screen" onClick={e => e.stopPropagation()}>
          <button className="modal-close-btn tl-voice-close" onClick={handleClose} type="button">✕</button>

          {recordingState === 'idle' ? (
            <div className="tl-voice-idle" onClick={startRecording}>
              <div className="tl-voice-circle">
                <span className="tl-voice-icon">✦</span>
              </div>
              <p className="tl-voice-prompt">Talk about this trip</p>
              <p className="tl-voice-hint">Tap to start · say where you went, when, what happened</p>
            </div>
          ) : (
            <div className="tl-voice-idle" onClick={stopAndTranscribe}>
              <div className="tl-voice-circle tl-voice-circle-active">
                <span className="tl-voice-icon">■</span>
              </div>
              <p className="tl-voice-prompt">Listening…</p>
              <p className="tl-voice-hint">{formatTime(recordingTime)} · Tap to finish</p>
            </div>
          )}

          {voiceError && <p className="tl-error" style={{ textAlign: 'center' }}>{voiceError}</p>}

          <button
            className="tl-voice-back"
            onClick={() => { stopMic(); setVoiceStep('form'); setVoiceError(''); }}
            type="button"
          >
            Back to form
          </button>
        </div>
      </div>
    );
  }

  // ── Processing screen ──
  if (voiceStep === 'processing') {
    return (
      <div className="modal-overlay">
        <div className="trip-log-creator tl-voice-screen">
          <div className="tl-voice-idle">
            <div className="tl-voice-circle tl-voice-processing">
              <div className="tl-voice-spinner" />
            </div>
            <p className="tl-voice-prompt">Organizing your trip…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form (default) ──
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="trip-log-creator" onClick={e => e.stopPropagation()}>
        <div className="trip-log-creator-header">
          <h2>Log a Trip</h2>
          {!transcript && (
            <button
              className="tl-voice-pill"
              onClick={() => { setVoiceError(''); setVoiceStep('record'); }}
              type="button"
            >
              ✦ Tell it as a story
            </button>
          )}
          <button className="modal-close-btn" onClick={handleClose} type="button">✕</button>
        </div>

        <div className="trip-log-creator-body">
          {transcript && (
            <details className="tl-transcript-details">
              <summary className="tl-transcript-summary">Your voice note</summary>
              <p className="tl-transcript-text">{transcript}</p>
            </details>
          )}
          {voiceError && <p className="tl-error">{voiceError}</p>}

          <label className="tl-label">
            Where did you go?
            <input
              className="tl-input"
              type="text"
              placeholder="San Diego, CA"
              value={placeName}
              onChange={e => setPlaceName(e.target.value)}
              autoFocus={!transcript}
            />
          </label>

          <div className="tl-row">
            <label className="tl-label tl-label-half">
              Month
              <select
                className="tl-input"
                value={visitMonth}
                onChange={e => setVisitMonth(e.target.value ? parseInt(e.target.value) : '')}
              >
                {MONTH_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="tl-label tl-label-half">
              Year
              <select
                className="tl-input"
                value={visitYear}
                onChange={e => setVisitYear(parseInt(e.target.value))}
              >
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <label className="tl-label">
            What made it memorable?
            <textarea
              className="tl-input tl-textarea"
              placeholder="A quick note about this trip…"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
            />
          </label>

          <div className="tl-label">
            Tags
            <TagPicker selectedTags={selectedTags} onTagsChange={setSelectedTags} maxTags={3} />
          </div>

          <div className="tl-label">
            Rating
            <div className="tl-rating-row">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className={`tl-rating-btn${rating >= n ? ' tl-rating-btn-active' : ''}`}
                  onClick={() => setRating(rating === n ? null : n)}
                >
                  ❤️
                </button>
              ))}
            </div>
          </div>

          {error && <p className="tl-error">{error}</p>}
        </div>

        <div className="trip-log-creator-footer">
          <button className="tl-btn-secondary" onClick={handleClose} type="button">Cancel</button>
          <button
            className="tl-btn-primary"
            onClick={handleSave}
            disabled={saving || !placeName.trim()}
            type="button"
          >
            {saving ? 'Saving…' : 'Save Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
