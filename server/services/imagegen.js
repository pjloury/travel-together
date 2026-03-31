// AI image generation service using Nano Banana (fal.ai/nano-banana-2)
//
// Generates stylized cartoon/illustration cover images for memory and dream pins.
// Requires FAL_KEY environment variable (get one at fal.ai).

const FAL_BASE_URL = 'https://fal.run/fal-ai/nano-banana-2';

/**
 * Build a prompt for a travel memory pin.
 */
function buildMemoryPrompt(pin) {
  const place = pin.place_name || pin.placeName || 'a travel destination';
  const tagNames = (pin.tags || []).map(t => t.name || t).filter(Boolean).slice(0, 2).join(' and ');
  const summaryLines = Array.isArray(pin.ai_summary || pin.aiSummary)
    ? (pin.ai_summary || pin.aiSummary).slice(0, 2).join('. ')
    : (pin.ai_summary || pin.aiSummary || '');

  let prompt = `A vibrant travel illustration of ${place}`;
  if (tagNames) prompt += `, themed around ${tagNames}`;
  if (summaryLines) prompt += `. Scene: ${summaryLines}`;
  prompt += '. Style: warm colorful travel poster illustration, painterly, slightly cartoonish, golden hour lighting, editorial travel art, no text.';

  return prompt;
}

/**
 * Build a prompt for a dream pin.
 */
function buildDreamPrompt(pin) {
  const place = pin.place_name || pin.placeName || 'a dream destination';
  const tagNames = (pin.tags || []).map(t => t.name || t).filter(Boolean).slice(0, 2).join(' and ');

  let prompt = `A dreamy, aspirational travel illustration of ${place}`;
  if (tagNames) prompt += `, evoking ${tagNames}`;
  prompt += '. Style: soft pastel travel poster illustration, impressionistic, whimsical, cinematic wide shot, bucket-list wanderlust feeling, no text.';

  return prompt;
}

/**
 * Generate a stylized AI cover image for a pin via Nano Banana (fal.ai).
 *
 * @param {Object} pin - Pin data (place_name/placeName, tags, ai_summary/aiSummary, pin_type/pinType)
 * @returns {Promise<string|null>} Image URL, or null on error / missing key
 */
async function generatePinImage(pin) {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    console.warn('[imagegen] FAL_KEY not configured — skipping AI image generation');
    return null;
  }

  const pinType = pin.pin_type || pin.pinType || 'memory';
  const prompt = pinType === 'dream' ? buildDreamPrompt(pin) : buildMemoryPrompt(pin);

  try {
    const response = await fetch(FAL_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        aspect_ratio: '4:3',
        num_images: 1,
        output_format: 'jpeg',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[imagegen] fal.ai error:', response.status, err);
      return null;
    }

    const data = await response.json();
    const imageUrl = data?.images?.[0]?.url;

    if (!imageUrl) {
      console.warn('[imagegen] No image URL in fal.ai response');
      return null;
    }

    return imageUrl;
  } catch (err) {
    console.error('[imagegen] generatePinImage error:', err.message);
    return null;
  }
}

module.exports = { generatePinImage };
