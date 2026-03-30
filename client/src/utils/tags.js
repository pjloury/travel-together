// Tag utility - maps experience tag names to their IDs per spec.md Section 9.
//
// Spec: docs/app/spec.md Section 9

export const EXPERIENCE_TAGS = [
  { id: 1, name: 'Nature & Wildlife', emoji: '\uD83C\uDFDE\uFE0F', gradientStart: '#2D5016', gradientEnd: '#4A7C23' },
  { id: 2, name: 'Food & Drink', emoji: '\uD83C\uDF5C', gradientStart: '#8B4513', gradientEnd: '#D2691E' },
  { id: 3, name: 'Culture & History', emoji: '\uD83C\uDFEF', gradientStart: '#6B2D5B', gradientEnd: '#9B4B8A' },
  { id: 4, name: 'Beach & Water', emoji: '\uD83C\uDF0A', gradientStart: '#0E4D6E', gradientEnd: '#1A8FBF' },
  { id: 5, name: 'Outdoor Adventure', emoji: '\uD83E\uDDD7', gradientStart: '#8B4000', gradientEnd: '#CC5500' },
  { id: 6, name: 'Winter Sports', emoji: '\uD83C\uDFBF', gradientStart: '#1B3A5C', gradientEnd: '#3A7BD5' },
  { id: 7, name: 'Sports', emoji: '\uD83C\uDFDF\uFE0F', gradientStart: '#1A472A', gradientEnd: '#2E8B57' },
  { id: 8, name: 'Nightlife & Music', emoji: '\uD83C\uDF78', gradientStart: '#2D1B4E', gradientEnd: '#6A1B9A' },
  { id: 9, name: 'Architecture & Streets', emoji: '\uD83C\uDFDB\uFE0F', gradientStart: '#4A4A4A', gradientEnd: '#7A7A7A' },
  { id: 10, name: 'Wellness & Slow Travel', emoji: '\uD83E\uDDD8', gradientStart: '#2E4A3E', gradientEnd: '#5B8A72' },
  { id: 11, name: 'Arts & Creativity', emoji: '\uD83C\uDFAD', gradientStart: '#8B2252', gradientEnd: '#CD3278' },
  { id: 12, name: 'People & Connections', emoji: '\uD83E\uDD1D', gradientStart: '#654321', gradientEnd: '#A0785A' },
  { id: 13, name: 'Epic Journeys', emoji: '\uD83D\uDE82', gradientStart: '#4A2800', gradientEnd: '#8B5000' },
  { id: 14, name: 'Shopping & Markets', emoji: '\uD83D\uDECD\uFE0F', gradientStart: '#6B2D5B', gradientEnd: '#B8578A' },
  { id: 15, name: 'Festivals & Special Events', emoji: '\uD83C\uDF8A', gradientStart: '#8B0000', gradientEnd: '#DC143C' },
  { id: 16, name: 'Photography', emoji: '\uD83D\uDCF8', gradientStart: '#2C3E50', gradientEnd: '#4A6FA5' },
];

const TAG_NAME_TO_ID = {};
EXPERIENCE_TAGS.forEach(t => { TAG_NAME_TO_ID[t.name] = t.id; });

/**
 * Convert an array of tag names into the tag payload format expected by POST /api/pins.
 * Known experience tag names are mapped to experienceTagId; unknown names use customTagName.
 *
 * @param {Array<string>} tagNames - Array of tag name strings
 * @returns {Array<Object>} - Array of { experienceTagId: number } or { customTagName: string }
 */
export function tagNamesToPayload(tagNames) {
  return tagNames.map(name => {
    const id = TAG_NAME_TO_ID[name];
    if (id) {
      return { experienceTagId: id };
    }
    return { customTagName: name };
  });
}

export const DEFAULT_GRADIENT_START = '#1A1A2E';
export const DEFAULT_GRADIENT_END = '#16213E';
export const DEFAULT_EMOJI = '\uD83C\uDF0D';
