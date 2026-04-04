// Unsplash image service for Travel Together
//
// Spec: docs/app/spec.md (Section 7: Unsplash Integration, Section 9: Experience Tag Taxonomy)
// Contract: docs/app/spec.md
//
// Required env: UNSPLASH_ACCESS_KEY

const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

/**
 * Tag-to-fallback mapping derived from experience_tags seed data
 * (server/db/schema/010_experience_tags.sql).
 *
 * Each entry: { gradient: CSS linear-gradient string, emoji: string }
 */
const TAG_FALLBACKS = {
  'Nature & Wildlife':          { gradient: 'linear-gradient(135deg, #2D5016, #4A7C23)', emoji: '\uD83C\uDFDE\uFE0F' },
  'Food & Drink':               { gradient: 'linear-gradient(135deg, #8B4513, #D2691E)', emoji: '\uD83C\uDF5C' },
  'Culture & History':          { gradient: 'linear-gradient(135deg, #6B2D5B, #9B4B8A)', emoji: '\uD83C\uDFEF' },
  'Beach & Water':              { gradient: 'linear-gradient(135deg, #0E4D6E, #1A8FBF)', emoji: '\uD83C\uDF0A' },
  'Outdoor Adventure':          { gradient: 'linear-gradient(135deg, #8B4000, #CC5500)', emoji: '\uD83E\uDDD7' },
  'Winter Sports':              { gradient: 'linear-gradient(135deg, #1B3A5C, #3A7BD5)', emoji: '\uD83C\uDFBF' },
  'Sports':                     { gradient: 'linear-gradient(135deg, #1A472A, #2E8B57)', emoji: '\uD83C\uDFDF\uFE0F' },
  'Nightlife & Music':          { gradient: 'linear-gradient(135deg, #2D1B4E, #6A1B9A)', emoji: '\uD83C\uDF78' },
  'Architecture & Streets':     { gradient: 'linear-gradient(135deg, #4A4A4A, #7A7A7A)', emoji: '\uD83C\uDFDB\uFE0F' },
  'Wellness & Slow Travel':     { gradient: 'linear-gradient(135deg, #2E4A3E, #5B8A72)', emoji: '\uD83E\uDDD8' },
  'Arts & Creativity':          { gradient: 'linear-gradient(135deg, #8B2252, #CD3278)', emoji: '\uD83C\uDFAD' },
  'People & Connections':       { gradient: 'linear-gradient(135deg, #654321, #A0785A)', emoji: '\uD83E\uDD1D' },
  'Epic Journeys':              { gradient: 'linear-gradient(135deg, #4A2800, #8B5000)', emoji: '\uD83D\uDE82' },
  'Shopping & Markets':         { gradient: 'linear-gradient(135deg, #6B2D5B, #B8578A)', emoji: '\uD83D\uDECD\uFE0F' },
  'Festivals & Special Events': { gradient: 'linear-gradient(135deg, #8B0000, #DC143C)', emoji: '\uD83C\uDF8A' },
  'Photography':                { gradient: 'linear-gradient(135deg, #2C3E50, #4A6FA5)', emoji: '\uD83D\uDCF8' },
};

const DEFAULT_FALLBACK = { gradient: 'linear-gradient(135deg, #1A1A2E, #16213E)', emoji: '\uD83C\uDF0D' };

/**
 * Fetch a landscape image from Unsplash for a dream pin.
 *
 * @implements REQ-DREAM-002, SCN-DREAM-002-01
 *
 * @param {string} placeName - Place name to search for
 * @param {string[]} tags - Tag names; first tag is appended to search query
 * @returns {Promise<{imageUrl: string, attribution: {photographerName: string, photographerUrl: string, unsplashUrl: string}}|null>}
 *   Returns null if no results or API error (caller handles fallback).
 */
async function fetchDreamImage(placeName, tags = []) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.error('UNSPLASH_ACCESS_KEY not configured');
    return null;
  }

  // Build search query: placeName + first tag for better results
  let query = placeName;
  if (tags.length > 0) {
    query = `${placeName} ${tags[0]}`;
  }

  try {
    const url = new URL(`${UNSPLASH_BASE_URL}/search/photos`);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', '5');
    url.searchParams.set('orientation', 'landscape');

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
      },
    });

    if (!response.ok) {
      console.error('Unsplash API error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    // Pick the most-liked photo for higher quality
    const photo = data.results.reduce((best, p) =>
      (p.likes || 0) > (best.likes || 0) ? p : best, data.results[0]);

    return {
      imageUrl: photo.urls.regular,
      attribution: {
        photographerName: photo.user.name,
        photographerUrl: photo.user.links.html,
        unsplashUrl: photo.links.html,
      },
    };
  } catch (err) {
    console.error('Unsplash fetch error:', err.message);
    return null;
  }
}

/**
 * Get gradient + emoji fallback for a given tag name from the 16-tag taxonomy.
 *
 * @implements REQ-DREAM-002, SCN-DREAM-002-01
 *
 * @param {string} tagName - One of the 16 experience tag names
 * @returns {{gradient: string, emoji: string}}
 */
function getFallbackForTag(tagName) {
  if (tagName && TAG_FALLBACKS[tagName]) {
    return TAG_FALLBACKS[tagName];
  }
  return DEFAULT_FALLBACK;
}

module.exports = { fetchDreamImage, getFallbackForTag };
