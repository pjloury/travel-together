// Voice input routes for Travel Together
//
// Spec: docs/app/spec.md (Section 5: Voice Input Pipeline)
// Contract: docs/app/spec.md
//
// Required dependency: multer (add to package.json if not present)

const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { transcribeAudio } = require('../services/whisper');
const { structureMemoryFromTranscript, structureDreamFromText, getDreamInsights } = require('../services/claude');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/voice/transcribe
 *
 * Accepts audio file upload, transcribes via Whisper API.
 *
 * @implements REQ-VOICE-001, REQ-VOICE-002, SCN-VOICE-002-01
 *
 * Request: multipart/form-data with field "audio"
 * Response: { success: true, data: { transcript: string } }
 * Error: { success: false, error: string, canRetry: boolean, canTypeInstead: boolean }
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No audio file provided. Please record audio and try again.',
      });
    }

    const result = await transcribeAudio(req.file.buffer, req.file.mimetype);

    res.json({ success: true, data: { transcript: result.transcript } });
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(502).json({
      success: false,
      error: 'Transcription failed. Please try again or type your memory instead.',
      stage: 'transcription',
      canRetry: true,
      canTypeInstead: true,
    });
  }
});

/**
 * POST /api/voice/structure
 *
 * Structures a transcript into place name, tags, summary using Claude.
 *
 * @implements REQ-VOICE-003, SCN-VOICE-003-01
 *
 * Request body: { transcript: string, correctionTranscript?: string, context?: 'memory'|'dream' }
 * Response: { success: true, data: { place_name, tags, summary, confidence } }
 * Error: { success: false, error: string, canRetry: boolean, canEditManually: boolean }
 */
router.post('/structure', async (req, res) => {
  try {
    const { transcript, correctionTranscript, context } = req.body;

    if (!transcript) {
      return res.status(400).json({
        success: false,
        error: 'Transcript is required.',
      });
    }

    let result;
    if (context === 'dream') {
      result = await structureDreamFromText(transcript, context);
    } else {
      result = await structureMemoryFromTranscript(transcript, correctionTranscript || null);
    }

    res.json({
      success: true,
      data: {
        place_name: result.place_name,
        locations: result.locations || [],
        tags: result.tags || [],
        summary: result.summary,
        visit_year: result.visit_year || null,
        rating: result.rating || null,
        companions: result.companions || [],
        confidence: result.confidence,
      },
    });
  } catch (error) {
    console.error('Structure error:', error);
    res.status(502).json({
      success: false,
      error: 'Could not structure your memory. You can edit the fields manually.',
      stage: 'structuring',
      canRetry: true,
      canEditManually: true,
    });
  }
});

/**
 * POST /api/voice/dream-insights
 *
 * Generates vivid insider insights for a dream destination, one per experience tag.
 *
 * Request body: { placeName: string, tags?: string[] }
 * Response: { success: true, data: { highlights: [...] } }
 * Error: { success: false, error: string }
 */
router.post('/dream-insights', async (req, res) => {
  try {
    const { placeName, tags } = req.body;

    if (!placeName || typeof placeName !== 'string' || placeName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'placeName is required.',
      });
    }

    const result = await getDreamInsights(placeName, tags || []);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Dream insights error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate insights',
    });
  }
});

module.exports = router;
