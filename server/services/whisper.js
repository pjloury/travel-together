// Whisper transcription service for Travel Together
//
// Spec: docs/app/spec.md (Section 5: Voice Input Pipeline)
// Contract: docs/app/spec.md
//
// Required env: OPENAI_API_KEY
// Required dependency: openai (add to package.json if not present)

const OpenAI = require('openai');

// Lazily initialized — avoids startup crash when OPENAI_API_KEY is not yet set
let openai = null;
function getClient() {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openai;
}

/**
 * Transcribe audio buffer to text using OpenAI Whisper API.
 *
 * @implements REQ-VOICE-001, REQ-VOICE-002, REQ-VOICE-006
 *
 * @param {Buffer} audioBuffer - Raw audio data
 * @param {string} mimeType - MIME type of the audio (e.g. 'audio/webm', 'audio/wav')
 * @returns {Promise<{transcript: string}>}
 * @throws {Error} Descriptive error on Whisper API failure
 */
async function transcribeAudio(audioBuffer, mimeType) {
  // Determine file extension from MIME type for the Whisper API
  const extMap = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mp4': 'mp4',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
  };
  const ext = extMap[mimeType] || 'webm';

  // Create a File object from the buffer for the OpenAI SDK
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

  const response = await getClient().audio.transcriptions.create({
    model: 'whisper-1',
    file: file,
  });

  return { transcript: response.text };
}

module.exports = { transcribeAudio };
