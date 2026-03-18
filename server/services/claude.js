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

module.exports = { generateCountryProfile, generatePersonalizedRecommendations, generateTripProposal, generateTravelProfile };
