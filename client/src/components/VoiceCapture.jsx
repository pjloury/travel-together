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
  const [selectedTags, setSelectedTags] = useState([]);
  const [summary, setSummary] = useState('');
  const [visitYear, setVisitYear] = useState('');
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');

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
    setSummary('');
    setVisitYear('');
    setRating(0);
    setNote('');
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
      // Wait briefly for onstop to fire, then upload
      setTimeout(() => uploadAndTranscribe(), 300);
    }
  }, []);

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
        // Re-structure with both transcripts
        await structureTranscript(transcript, transcriptText);
      } else {
        setTranscript(transcriptText);
        // Move to review and start structuring
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
      // Server returns snake_case (place_name); map to local state
      setPlaceName(proposal.place_name || proposal.placeName || '');
      setSummary(proposal.summary || '');
      // Pre-select AI-suggested tags
      if (proposal.tags && proposal.tags.length > 0) {
        setSelectedTags(proposal.tags);
      }
      setState('review');
    } catch {
      // Per spec: transcript is still visible, AI proposal section shows error
      setStructuringError(true);
      setNote(mainTranscript);
      setState('review');
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

  // Type instead: skip voice, go directly to review with empty fields
  function handleTypeInstead() {
    setState('review');
    setStructuringError(false);
  }

  // Re-record correction
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

      await api.post('/pins', {
        pinType: 'memory',
        placeName: placeName,
        aiSummary: summary,
        transcript: transcript,
        correctionTranscript: correctionTranscript || null,
        note: note || null,
        visitYear: visitYear ? parseInt(visitYear, 10) : null,
        rating: rating || null,
        tags: tagPayload,
      });

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

  return (
    <div className="voice-capture-modal">
      <div className="voice-capture-content">
        <button className="voice-capture-close" onClick={onClose}>&times;</button>

        {/* Ready state */}
        {state === 'ready' && (
          <div className="voice-state voice-ready">
            <button className="voice-record-btn" onClick={startRecording}>
              <span className="record-icon">{'\uD83C\uDF99\uFE0F'}</span>
            </button>
            <p className="voice-instruction">Tap to start speaking about your memory</p>
            <button className="voice-type-instead" onClick={handleTypeInstead}>
              Type instead
            </button>
          </div>
        )}

        {/* Recording state */}
        {state === 'recording' && !isReRecording && (
          <div className="voice-state voice-recording">
            <div className="voice-pulse-container">
              <div className="voice-pulse"></div>
              <button className="voice-stop-btn" onClick={stopRecording}>
                <span className="stop-icon">{'\u23F9'}</span>
              </button>
            </div>
            <p className="voice-listening">Listening...</p>
            <p className="voice-timer">{formatTime(recordingTime)}</p>
          </div>
        )}

        {/* Recording state (re-record) */}
        {state === 'recording' && isReRecording && (
          <div className="voice-state voice-recording">
            <div className="voice-pulse-container">
              <div className="voice-pulse"></div>
              <button className="voice-stop-btn" onClick={stopRecording}>
                <span className="stop-icon">{'\u23F9'}</span>
              </button>
            </div>
            <p className="voice-listening">Recording correction...</p>
            <p className="voice-timer">{formatTime(recordingTime)}</p>
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
                Place name
                <input
                  type="text"
                  className="voice-field-input"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                  placeholder="Where was this?"
                />
              </label>

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
                  className="voice-field-textarea"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="A brief summary of this memory..."
                  rows={3}
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
                        {v <= rating ? '\u2764\uFE0F' : '\uD83E\uDE76'}
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
