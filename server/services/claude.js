const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Generate country profile: cultural facts, best times, tips, experiences
 */
async function generateCountryProfile(countryCode, countryName) {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a knowledgeable travel expert. Generate an engaging travel guide for ${countryName} (${countryCode}).

Return ONLY valid JSON in this exact format:
{
  "bestTimes": [
    { "months": "March-May", "reason": "Perfect spring weather, fewer crowds" },
    { "months": "September-November", "reason": "Autumn colors, harvest festivals" }
  ],
  "culturalFacts": [
    "Fascinating fact about culture or history",
    "Interesting local custom or tradition",
    "Unique food or culinary highlight",
    "Surprising or lesser-known fact"
  ],
  "generalTips": [
    "Practical tip for travelers",
    "Cultural etiquette tip",
    "Money or transport tip"
  ],
  "topExperiences": [
    { "name": "Experience name", "type": "nature|culture|food|adventure|urban", "description": "Brief why it's special" },
    { "name": "Experience name", "type": "culture", "description": "Brief description" },
    { "name": "Experience name", "type": "food", "description": "Brief description" }
  ],
  "vibe": "One sentence capturing the essence of travel here"
}`
    }]
  });

  const text = message.content[0].text;
  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate personalized destination recommendations for a user
 */
async function generatePersonalizedRecommendations(visitedCountries, wishlistCountries, friendsWishlist) {
  const visitedNames = visitedCountries.map(c => c.country_name).join(', ') || 'none yet';
  const wishlistNames = wishlistCountries.map(c => c.country_name).join(', ') || 'none yet';
  const friendsWants = friendsWishlist.map(c => c.country_name).join(', ') || 'none';

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a personalized travel advisor. Based on this traveler's profile, suggest 6 destination recommendations.

Traveler's visited countries: ${visitedNames}
Traveler's wishlist: ${wishlistNames}
Countries their friends want to visit: ${friendsWants}

Analyze their travel patterns and suggest destinations that:
1. Match the vibe/region of places they've loved
2. Are logical "next steps" from their travel history
3. Could be great group trips given friend interests
4. Include at least 1 wild card they might not have considered

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "countryCode": "JP",
      "countryName": "Japan",
      "reason": "Specific personalized reason based on their history",
      "matchType": "style_match|friend_overlap|next_step|wild_card",
      "highlight": "The one thing they absolutely must experience",
      "bestWith": "solo|friends|both"
    }
  ],
  "travelPersonality": "2-sentence description of their travel style based on their history"
}`
    }]
  });

  const text = message.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate AI trip proposal for a group
 */
async function generateTripProposal(countryCode, countryName, participants) {
  const participantInfo = participants.map(p =>
    `${p.displayName}: visited ${p.visited.join(', ') || 'few places'}; wants to visit ${p.wishlist.join(', ') || 'unknown'}`
  ).join('\n');

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `You are a group travel planner. Create an exciting trip proposal for a group visiting ${countryName}.

Group members:
${participantInfo}

Create a proposal that works for everyone's interests. Be specific, enthusiastic, and practical.

Return ONLY valid JSON:
{
  "title": "Catchy trip title",
  "mood": "adventure|culture|relaxation|foodie|mixed",
  "tagline": "One exciting sentence about this trip",
  "duration": "Suggested duration (e.g., '10-14 days')",
  "activities": [
    "Specific activity 1 - with brief context why the group will love it",
    "Specific activity 2",
    "Specific activity 3",
    "Specific activity 4",
    "Specific activity 5"
  ],
  "itinerary": "3-4 paragraph narrative description of the ideal trip flow, weaving in the group's interests and giving vivid details about what makes each part special",
  "bestTimeToGo": "Month/season recommendation with reason",
  "groupTip": "One piece of advice specific to this group's dynamic"
}`
    }]
  });

  const text = message.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Generate user travel profile summary
 */
async function generateTravelProfile(visitedCountries, wishlistCountries) {
  const visited = visitedCountries.map(c => c.country_name);
  const wishlist = wishlistCountries.map(c => `${c.country_name} (interest: ${c.interest_level}/5)`);

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: `Analyze this traveler's profile and write an insightful summary.

Countries visited (${visited.length}): ${visited.join(', ') || 'none yet'}
Wishlist (${wishlist.length}): ${wishlist.join(', ') || 'none yet'}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence engaging description of their travel personality and style",
  "travelStyle": "adventurer|culture_seeker|beach_lover|foodie|digital_nomad|luxury_traveler|backpacker|explorer",
  "topRegions": ["Region they gravitate toward", "Another region"],
  "insights": [
    "Interesting observation about their travels",
    "Pattern you notice in their wishlist",
    "Suggestion based on their history"
  ],
  "nextChallenge": "One inspiring suggestion for their next travel milestone"
}`
    }]
  });

  const text = message.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  return JSON.parse(jsonMatch[0]);
}

// --- Phase 2: Voice pipeline + Location normalization functions ---

/**
 * The 16 fixed experience tag names from the taxonomy.
 * Used in prompts to constrain AI tag selection.
 */
const EXPERIENCE_TAG_NAMES = [
  'Nature & Wildlife',
  'Food & Drink',
  'Culture & History',
  'Beach & Water',
  'Outdoor Adventure',
  'Winter Sports',
  'Sports',
  'Nightlife & Music',
  'Architecture & Streets',
  'Wellness & Slow Travel',
  'Arts & Creativity',
  'People & Connections',
  'Epic Journeys',
  'Shopping & Markets',
  'Festivals & Special Events',
  'Photography',
];

/**
 * Structure a memory from a voice transcript (and optional correction transcript).
 *
 * Calls Claude to extract structured data: place name, tags (max 3 from fixed 16),
 * polished summary, and confidence level.
 *
 * @implements REQ-VOICE-003, SCN-VOICE-003-01
 *
 * @param {string} transcript - Original verbatim voice transcript
 * @param {string|null} correctionTranscript - Optional correction/re-record transcript
 * @returns {Promise<{place_name: string, tags: string[], summary: string, confidence: string}>}
 * @throws {Error} On Claude API error or JSON parse failure
 */
async function structureMemoryFromTranscript(transcript, correctionTranscript = null) {
  let transcriptSection = `Original transcript:\n"${transcript}"`;
  if (correctionTranscript) {
    transcriptSection += `\n\nCorrection transcript (use this to update/override details from the original):\n"${correctionTranscript}"`;
  }

  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a travel memory organizer. A user has recorded a voice memo about a place they visited. Extract structured data from their transcript.

${transcriptSection}

Choose up to 3 tags from ONLY these 16 options:
${EXPERIENCE_TAG_NAMES.map(t => `- ${t}`).join('\n')}

Return ONLY valid JSON:
{
  "place_name": "the place name as the user described it (free-form)",
  "tags": ["Tag Name 1", "Tag Name 2"],
  "summary": ["Vivid punchy fragment about what happened", "Another moment or detail", "One more if needed"],
  "visit_year": 2024,
  "rating": 4,
  "companions": ["Friends"],
  "confidence": "high|medium|low"
}

Rules for "summary":
- Array of up to 5 bullet strings (not a paragraph)
- Each bullet under 12 words
- No personal pronouns ("I", "we", "they") — just vivid, punchy fragments describing what happened
- Example: ["Hiked the Inca Trail at dawn", "Best ceviche at a tiny market stall in Cusco", "Unexpected thunderstorm made the ruins feel ancient"]

Rules for "visit_year":
- Extract the year visited if mentioned; null if not mentioned

Rules for "rating":
- Extract a 1-5 rating if the user expresses a clear opinion; null if unclear
- 5 = life-changing, 4 = loved it, 3 = good, 2 = meh, 1 = bad

Rules for "companions":
- Who the trip was with. Array of strings from: ["Solo", "Partner", "Family", "Friends", "Work"]
- Can be multiple (e.g. ["Partner", "Friends"])
- Empty array [] if unclear from transcript

Confidence levels:
- "high": transcript clearly describes a specific place and experience
- "medium": place is mentioned but details are sparse
- "low": too vague to confidently extract place or experience`
    }]
  });

  const text = message.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response for memory structuring');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Structure a dream from text content (used by Chrome extension and dream creation).
 *
 * Same output shape as structureMemoryFromTranscript but framed as
 * "someone wants to visit" rather than "someone visited".
 *
 * @implements REQ-VOICE-003
 *
 * @param {string} text - Text content describing a dream destination
 * @param {string} context - Context hint, defaults to 'dream'
 * @returns {Promise<{place_name: string, tags: string[], summary: string, confidence: string}>}
 * @throws {Error} On Claude API error or JSON parse failure
 */
async function structureDreamFromText(text, context = 'dream') {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a travel dream organizer. A user wants to visit a place and has provided text describing their dream destination. Extract structured data.

Text:
"${text}"

Choose up to 3 tags from ONLY these 16 options:
${EXPERIENCE_TAG_NAMES.map(t => `- ${t}`).join('\n')}

Return ONLY valid JSON:
{
  "place_name": "the destination as described (free-form)",
  "tags": ["Tag Name 1", "Tag Name 2"],
  "summary": "2-3 sentence polished summary of why this place is appealing, written engagingly",
  "confidence": "high|medium|low"
}

Confidence levels:
- "high": text clearly describes a specific destination
- "medium": destination is mentioned but details are sparse
- "low": too vague to confidently identify a destination`
    }]
  });

  const text_response = message.content[0].text;
  const jsonMatch = text_response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response for dream structuring');
  return JSON.parse(jsonMatch[0]);
}

/**
 * Normalize a free-form place name to structured location data using Claude.
 *
 * @implements REQ-LOCATION-001, REQ-LOCATION-002, SCN-LOCATION-002-01
 *
 * @param {string} placeName - Free-form place description from the user
 * @returns {Promise<{display_name: string, normalized_city: string|null, normalized_country: string|null, normalized_region: string|null, latitude: number|null, longitude: number|null, confidence: string}>}
 * @throws {Error} On Claude API error or JSON parse failure
 */
async function normalizeLocation(placeName) {
  const message = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Given this place description from a traveler: "${placeName}"

Normalize it to structured location data. The traveler may use informal, poetic, or vague descriptions.
Match to the most likely real-world location.

Return ONLY valid JSON:
{
  "display_name": "${placeName}",
  "normalized_city": "closest city or town name",
  "normalized_country": "country name",
  "normalized_region": "broader geographic region for matching (e.g., 'Patagonia', 'Amalfi Coast', 'Tokyo Metropolitan Area', 'Scottish Highlands')",
  "lat": 41.138,
  "lng": -8.646,
  "confidence": "high|medium|low"
}

Confidence levels:
- "high": clear, unambiguous location (e.g., "Paris", "Torres del Paine", "Shinjuku")
- "medium": likely correct but some ambiguity (e.g., "that coast in southern Italy", "the old town")
- "low": too vague or multiple strong candidates (e.g., "a beautiful beach", "the mountains")

For the "normalized_region" field: use a human-readable region name that would naturally group nearby locations.
Examples: "Torres del Paine", "El Chalten", and "Patagonia" should all normalize to region "Patagonia".
"Amalfi", "Positano", and "Ravello" should all normalize to region "Amalfi Coast".`
    }]
  });

  const text = message.content[0].text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response for location normalization');

  const parsed = JSON.parse(jsonMatch[0]);

  // Map the Claude response fields to the expected output shape
  // The prompt uses "lat"/"lng" but we return "latitude"/"longitude" per contract
  return {
    display_name: parsed.display_name,
    normalized_city: parsed.normalized_city || null,
    normalized_country: parsed.normalized_country || null,
    normalized_region: parsed.normalized_region || null,
    latitude: parsed.lat != null ? parsed.lat : null,
    longitude: parsed.lng != null ? parsed.lng : null,
    confidence: parsed.confidence,
  };
}

module.exports = {
  generateCountryProfile,
  generatePersonalizedRecommendations,
  generateTripProposal,
  generateTravelProfile,
  structureMemoryFromTranscript,
  structureDreamFromText,
  normalizeLocation,
};
