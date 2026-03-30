// TagPicker component - tag selection UI for the 16 fixed experience tags.
//
// Spec: docs/app/spec.md Section 9 (Experience Tag Taxonomy)
// @implements REQ-MEMORY-003

import { EXPERIENCE_TAGS } from '../utils/tags';

/**
 * TagPicker renders a chip selector for the 16 fixed experience tags.
 *
 * @implements REQ-MEMORY-003 (user can tag memories from defined taxonomy)
 *
 * @param {Object} props
 * @param {Array<string>} props.selectedTags - Array of selected tag names
 * @param {function} props.onTagsChange - Callback with updated tag names array
 * @param {number} [props.maxTags=3] - Maximum number of selectable tags
 */

export default function TagPicker({ selectedTags, onTagsChange, maxTags = 3 }) {
  function toggleTag(tagName) {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(t => t !== tagName));
    } else if (selectedTags.length < maxTags) {
      onTagsChange([...selectedTags, tagName]);
    }
  }

  return (
    <div className="tag-picker">
      {EXPERIENCE_TAGS.map(tag => {
        const isSelected = selectedTags.includes(tag.name);
        return (
          <button
            key={tag.id}
            className={`tag-chip ${isSelected ? 'tag-chip-selected' : ''}`}
            onClick={() => toggleTag(tag.name)}
            type="button"
            disabled={!isSelected && selectedTags.length >= maxTags}
          >
            {tag.emoji} {tag.name}
          </button>
        );
      })}
      {selectedTags.length >= maxTags && (
        <p className="tag-picker-hint">Maximum {maxTags} tags selected</p>
      )}
    </div>
  );
}
