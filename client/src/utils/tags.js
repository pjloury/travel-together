// Tag utility - maps experience tag names to their IDs per spec.md Section 9.
//
// Spec: docs/app/spec.md Section 9

export const EXPERIENCE_TAGS = [
  { id: 1, name: 'Nature & Wildlife', emoji: '\uD83C\uDFDE\uFE0F', gradientStart: '#0F1A10', gradientEnd: '#1A2A1A' },
  { id: 2, name: 'Food & Drink', emoji: '\uD83C\uDF5C', gradientStart: '#201510', gradientEnd: '#301E15' },
  { id: 3, name: 'Culture & History', emoji: '\uD83C\uDFEF', gradientStart: '#1A1410', gradientEnd: '#2A211A' },
  { id: 4, name: 'Beach & Water', emoji: '\uD83C\uDF0A', gradientStart: '#0D2535', gradientEnd: '#1A3A4A' },
  { id: 5, name: 'Outdoor Adventure', emoji: '\uD83E\uDDD7', gradientStart: '#141F0F', gradientEnd: '#243318' },
  { id: 6, name: 'Winter Sports', emoji: '\uD83C\uDFBF', gradientStart: '#0F1520', gradientEnd: '#1A2535' },
  { id: 7, name: 'Sports', emoji: '\uD83C\uDFDF\uFE0F', gradientStart: '#0F1520', gradientEnd: '#162035' },
  { id: 8, name: 'Nightlife & Music', emoji: '\uD83C\uDF78', gradientStart: '#10091A', gradientEnd: '#1A1028' },
  { id: 9, name: 'Architecture & Streets', emoji: '\uD83C\uDFDB\uFE0F', gradientStart: '#141414', gradientEnd: '#242420' },
  { id: 10, name: 'Wellness & Slow Travel', emoji: '\uD83E\uDDD8', gradientStart: '#1A1510', gradientEnd: '#2A2018' },
  { id: 11, name: 'Arts & Creativity', emoji: '\uD83C\uDFAD', gradientStart: '#1A0F14', gradientEnd: '#2A1520' },
  { id: 12, name: 'People & Connections', emoji: '\uD83E\uDD1D', gradientStart: '#1A0F0F', gradientEnd: '#2A1515' },
  { id: 13, name: 'Epic Journeys', emoji: '\uD83D\uDE82', gradientStart: '#1A1208', gradientEnd: '#2A1E10' },
  { id: 14, name: 'Shopping & Markets', emoji: '\uD83D\uDECD\uFE0F', gradientStart: '#1A1510', gradientEnd: '#2D2215' },
  { id: 15, name: 'Festivals & Special Events', emoji: '\uD83C\uDF8A', gradientStart: '#1A0F14', gradientEnd: '#2A1520' },
  { id: 16, name: 'Photography', emoji: '\uD83D\uDCF8', gradientStart: '#101010', gradientEnd: '#1E1E1E' },
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

export const DEFAULT_GRADIENT_START = '#1A1A1A';
export const DEFAULT_GRADIENT_END = '#0A0A0A';
export const DEFAULT_EMOJI = '\uD83C\uDF0D';
