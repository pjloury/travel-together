// AI image generation service using Google Gemini 2.0 Flash
//
// Generates stylized travel illustration cover images for memory and dream pins.
// Requires GEMINI_API_KEY environment variable (get one at aistudio.google.com).
//
// Uses gemini-2.0-flash-preview-image-generation via the generateContent endpoint —
// same API key as the rest of Gemini, no Vertex AI / service account needed.
//
// Images are stored as base64 data URIs in photo_url — no external CDN needed.

const GEMINI_IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation';
const GEMINI_BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

/**
 * Build a prompt for a travel memory pin using all available context.
 */
function buildMemoryPrompt(pin) {
  const place = pin.place_name || pin.placeName || 'a travel destination';
  const tagNames = (pin.tags || []).map(t => t.name || t).filter(Boolean).slice(0, 3).join(', ');

  // Use ai_summary bullets or note for scene context
  const rawSummary = pin.ai_summary || pin.aiSummary || pin.note || '';
  const summarySnippet = rawSummary
    ? rawSummary.replace(/^[\u2022\-*]\s*/gm, '').split('\n').filter(Boolean).slice(0, 2).join('. ')
    : '';

  // Extra locations (multi-stop trips)
  const stops = (pin.locations || []).map(l => l.placeName || l.place_name).filter(Boolean);
  const stopText = stops.length > 0 ? ` including stops in ${stops.slice(0, 3).join(', ')}` : '';

  const year = pin.visitYear || pin.visit_year;
  const yearText = year ? ` (visited ${year})` : '';

  let prompt = `A vibrant travel illustration of ${place}${stopText}${yearText}`;
  if (tagNames) prompt += `, themed around ${tagNames}`;
  if (summarySnippet) prompt += `. Scene captures: ${summarySnippet}`;
  prompt += '. Style: warm colorful travel poster illustration, painterly, slightly cartoonish, golden hour lighting, editorial travel art, no text, no letters.';

  return prompt;
}

/**
 * Build a prompt for a dream pin using all available context.
 */
function buildDreamPrompt(pin) {
  const place = pin.place_name || pin.placeName || 'a dream destination';
  const tagNames = (pin.tags || []).map(t => t.name || t).filter(Boolean).slice(0, 3).join(', ');
  const dreamNote = pin.dream_note || pin.dreamNote || pin.note || '';
  const noteSnippet = dreamNote
    ? dreamNote.split('\n').filter(Boolean).slice(0, 1).join(' ')
    : '';

  let prompt = `A dreamy, aspirational travel illustration of ${place}`;
  if (tagNames) prompt += `, evoking ${tagNames}`;
  if (noteSnippet) prompt += `. Mood: ${noteSnippet}`;
  prompt += '. Style: soft pastel travel poster illustration, impressionistic, whimsical, cinematic wide shot, bucket-list wanderlust feeling, no text, no letters.';

  return prompt;
}

/**
 * Generate a stylized AI cover image for a pin via Gemini 2.0 Flash.
 *
 * Returns a base64 data URI (data:image/jpeg;base64,...) which is stored
 * directly in photo_url — no external CDN needed.
 *
 * @param {Object} pin - Pin data (place_name/placeName, tags, ai_summary/aiSummary, pin_type/pinType)
 * @returns {Promise<string|null>} Data URI string, or null on error / missing key
 */
async function generatePinImage(pin) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.warn('[imagegen] GEMINI_API_KEY not configured — skipping AI image generation');
    return null;
  }

  const pinType = pin.pin_type || pin.pinType || 'memory';
  const prompt = pinType === 'dream' ? buildDreamPrompt(pin) : buildMemoryPrompt(pin);

  try {
    const response = await fetch(`${GEMINI_BASE_URL}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[imagegen] Gemini image generation error:', response.status, err);
      return null;
    }

    const data = await response.json();

    // Response: candidates[0].content.parts[].inlineData.{ mimeType, data }
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.data);

    if (!imagePart) {
      console.warn('[imagegen] No image data in Gemini response', JSON.stringify(data).slice(0, 200));
      return null;
    }

    const { mimeType = 'image/jpeg', data: b64 } = imagePart.inlineData;
    return `data:${mimeType};base64,${b64}`;
  } catch (err) {
    console.error('[imagegen] generatePinImage error:', err.message);
    return null;
  }
}

module.exports = { generatePinImage };
