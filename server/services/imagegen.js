// AI image generation service using OpenAI DALL-E 3
//
// Generates stylized travel illustration cover images for memory and dream pins.
// Requires OPENAI_API_KEY environment variable.
//
// Returns base64 data URIs stored directly in photo_url — no external CDN needed.

const OPENAI_URL = 'https://api.openai.com/v1/images/generations';

/**
 * Build a prompt for a travel memory pin using all available context.
 */
function buildMemoryPrompt(pin) {
  const place = pin.place_name || pin.placeName || 'a travel destination';
  const tagNames = (pin.tags || []).map(t => t.name || t).filter(Boolean).slice(0, 3).join(', ');

  const rawSummary = pin.ai_summary || pin.aiSummary || pin.note || '';
  const summarySnippet = rawSummary
    ? rawSummary.replace(/^[\u2022\-*]\s*/gm, '').split('\n').filter(Boolean).slice(0, 2).join('. ')
    : '';

  const stops = (pin.locations || []).map(l => l.placeName || l.place_name).filter(Boolean);
  const stopText = stops.length > 0 ? ` including stops in ${stops.slice(0, 3).join(', ')}` : '';

  const year = pin.visitYear || pin.visit_year;
  const yearText = year ? ` (visited ${year})` : '';

  let prompt = `A vibrant travel illustration of ${place}${stopText}${yearText}`;
  if (tagNames) prompt += `, themed around ${tagNames}`;
  if (summarySnippet) prompt += `. Scene captures: ${summarySnippet}`;
  prompt += '. Style: warm colorful travel poster illustration, painterly, slightly cartoonish, golden hour lighting, editorial travel art, no text, no letters, no words.';

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
  prompt += '. Style: soft pastel travel poster illustration, impressionistic, whimsical, cinematic wide shot, bucket-list wanderlust feeling, no text, no letters, no words.';

  return prompt;
}

/**
 * Generate a stylized AI cover image for a pin via OpenAI DALL-E 3.
 *
 * Returns a base64 data URI (data:image/png;base64,...) which is stored
 * directly in photo_url — no external CDN needed.
 *
 * @param {Object} pin - Pin data (place_name/placeName, tags, ai_summary/aiSummary, pin_type/pinType)
 * @returns {Promise<string|null>} Data URI string, or null on error / missing key
 */
async function generatePinImage(pin) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[imagegen] OPENAI_API_KEY not configured — skipping AI image generation');
    return null;
  }

  const pinType = pin.pin_type || pin.pinType || 'memory';
  const prompt = pinType === 'dream' ? buildDreamPrompt(pin) : buildMemoryPrompt(pin);

  try {
    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[imagegen] DALL-E error:', response.status, err.slice(0, 300));
      return null;
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      console.warn('[imagegen] No image data in DALL-E response');
      return null;
    }

    return `data:image/png;base64,${b64}`;
  } catch (err) {
    console.error('[imagegen] generatePinImage error:', err.message);
    return null;
  }
}

module.exports = { generatePinImage };
