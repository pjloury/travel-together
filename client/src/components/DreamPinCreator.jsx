// DreamPinCreator component - modal/sheet for adding a dream pin.
//
// Spec: docs/app/spec.md Section 4
// @implements REQ-DREAM-001, REQ-DREAM-002, REQ-SOLO-001

import { useState } from 'react';
import api from '../api/client';
import TagPicker from './TagPicker';
import { tagNamesToPayload, EXPERIENCE_TAGS, DEFAULT_GRADIENT_START, DEFAULT_GRADIENT_END, DEFAULT_EMOJI } from '../utils/tags';

// Constants imported from utils/tags

/**
 * DreamPinCreator is a modal for adding a dream pin (quick and visual, no voice).
 *
 * @implements REQ-DREAM-001 (user creates dream pin with destination/experience)
 * @implements REQ-DREAM-002 (dream pins with Unsplash auto-fetch + gradient/emoji fallback)
 * @implements REQ-SOLO-001 (app rewarding with zero friends; voice-first day-1)
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Close the modal
 * @param {function} props.onSaved - Callback after pin is saved
 */
export default function DreamPinCreator({ isOpen, onClose, onSaved }) {
  const [placeName, setPlaceName] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [dreamNote, setDreamNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [unsplashImage, setUnsplashImage] = useState(null); // { imageUrl, attribution }
  const [fetchingImage, setFetchingImage] = useState(false);

  // Debounced Unsplash fetch when place name changes
  const unsplashDebounce = useState(null);
  function handlePlaceNameChange(val) {
    setPlaceName(val);
    setUnsplashImage(null);
    clearTimeout(unsplashDebounce[0]);
    if (val.trim().length < 3) return;
    unsplashDebounce[0] = setTimeout(async () => {
      setFetchingImage(true);
      try {
        const res = await api.post('/location/unsplash', {
          placeName: val.trim(),
          tags: selectedTags,
        });
        if (res.data && !res.data.fallback) {
          setUnsplashImage(res.data);
        }
      } catch {
        // Silently fall back to gradient preview
      } finally {
        setFetchingImage(false);
      }
    }, 800);
  }

  function resetForm() {
    setPlaceName('');
    setSelectedTags([]);
    setDreamNote('');
    setSaving(false);
    setError('');
    setUnsplashImage(null);
    setFetchingImage(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // Get gradient preview based on first selected tag
  function getPreviewGradient() {
    if (selectedTags.length > 0) {
      const tag = EXPERIENCE_TAGS.find(t => t.name === selectedTags[0]);
      if (tag) {
        return {
          gradient: `linear-gradient(135deg, ${tag.gradientStart}, ${tag.gradientEnd})`,
          emoji: tag.emoji,
        };
      }
    }
    return {
      gradient: `linear-gradient(135deg, ${DEFAULT_GRADIENT_START}, ${DEFAULT_GRADIENT_END})`,
      emoji: DEFAULT_EMOJI,
    };
  }

  async function handleSave() {
    if (!placeName.trim()) return;
    setSaving(true);
    setError('');

    try {
      const tagPayload = tagNamesToPayload(selectedTags);

      await api.post('/pins', {
        pinType: 'dream',
        placeName: placeName.trim(),
        dreamNote: dreamNote || null,
        tags: tagPayload,
        unsplashImageUrl: unsplashImage ? unsplashImage.imageUrl : null,
        unsplashAttribution: unsplashImage && unsplashImage.attribution
          ? `Photo by ${unsplashImage.attribution.photographerName} on Unsplash`
          : null,
      });

      if (onSaved) onSaved();
      handleClose();
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const preview = getPreviewGradient();

  return (
    <div className="dream-creator-modal">
      <div className="dream-creator-content">
        <button className="dream-creator-close" onClick={handleClose}>&times;</button>

        <h2 className="dream-creator-title">Add a Dream</h2>

        {/* Image preview: Unsplash photo if available, else gradient fallback with emoji */}
        <div
          className="dream-creator-preview"
          style={unsplashImage
            ? { backgroundImage: `url(${unsplashImage.imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: preview.gradient }}
        >
          {!unsplashImage && <span className="dream-creator-preview-emoji">{preview.emoji}</span>}
          {fetchingImage && <span className="dream-creator-preview-fetching">🔍</span>}
          {placeName.trim() && (
            <span className="dream-creator-preview-place">{placeName}</span>
          )}
          {unsplashImage && unsplashImage.attribution && (
            <span className="dream-creator-preview-attribution">
              Photo by {unsplashImage.attribution.photographerName} on Unsplash
            </span>
          )}
        </div>

        {/* Place name input - large and prominent */}
        <input
          type="text"
          className="dream-creator-place-input"
          value={placeName}
          onChange={(e) => handlePlaceNameChange(e.target.value)}
          placeholder="Where do you dream of going?"
          autoFocus
        />

        {/* Tag chip selector */}
        <div className="dream-creator-tags">
          <TagPicker
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            maxTags={3}
          />
        </div>

        {/* Optional note */}
        <textarea
          className="dream-creator-note"
          value={dreamNote}
          onChange={(e) => setDreamNote(e.target.value)}
          placeholder="Why do you want to go? (optional)"
          rows={3}
        />

        {error && <p className="dream-creator-error">{error}</p>}

        <button
          className="dream-creator-save-btn"
          onClick={handleSave}
          disabled={!placeName.trim() || saving}
        >
          {saving ? 'Saving...' : 'Add Dream'}
        </button>
      </div>
    </div>
  );
}
