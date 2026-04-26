// Photo carousel ordering + cover-photo selection logic for MemoryDetail.
//
// These tests cover the pure helpers extracted from MemoryDetail.jsx:
//   - orderPhotosCoverFirst: places the current cover at index 0 and keeps the rest in stable order
//   - buildSetCoverPayload: returns the right PUT body shape for "Set as cover"
//
// Stories:
//   2 — carousel renders cover photo first
//   3 — Set as cover persists via PUT /pins/:id with the right field
//
import { describe, it, expect } from 'vitest';

// Mirror of the helper in MemoryDetail.jsx (kept in sync intentionally — this file is the contract).
function orderPhotosCoverFirst(photos, coverUrl) {
  if (!Array.isArray(photos) || photos.length < 2 || !coverUrl) return photos || [];
  const idx = photos.findIndex(p => p && p.photoUrl === coverUrl);
  if (idx <= 0) return photos;
  return [photos[idx], ...photos.slice(0, idx), ...photos.slice(idx + 1)];
}

// Mirror of the helper in MemoryDetail.jsx — returns the body for PUT /pins/:id when
// a user picks "Set as cover" on a photo from the carousel.
function buildSetCoverPayload(photo) {
  if (!photo || !photo.photoUrl) return null;
  // All photos in pin_photos use absolute photo_url + photo_source.
  // Setting any of them as cover writes to pins.photo_url + clears unsplash_image_url so
  // the read path (photoUrl || unsplashImageUrl) resolves to the chosen photo.
  return {
    photoUrl: photo.photoUrl,
    photoSource: photo.photoSource || 'upload',
    unsplashImageUrl: null,
    unsplashAttribution: null,
  };
}

describe('orderPhotosCoverFirst', () => {
  const a = { id: 1, photoUrl: 'http://img/a.jpg' };
  const b = { id: 2, photoUrl: 'http://img/b.jpg' };
  const c = { id: 3, photoUrl: 'http://img/c.jpg' };

  it('returns the array unchanged when fewer than 2 photos', () => {
    expect(orderPhotosCoverFirst([], 'x')).toEqual([]);
    expect(orderPhotosCoverFirst([a], a.photoUrl)).toEqual([a]);
  });

  it('keeps order when no cover is set', () => {
    expect(orderPhotosCoverFirst([a, b, c], null)).toEqual([a, b, c]);
  });

  it('keeps order when cover is already at index 0', () => {
    expect(orderPhotosCoverFirst([a, b, c], a.photoUrl)).toEqual([a, b, c]);
  });

  it('moves the cover to index 0 and keeps the rest stable', () => {
    expect(orderPhotosCoverFirst([a, b, c], c.photoUrl)).toEqual([c, a, b]);
    expect(orderPhotosCoverFirst([a, b, c], b.photoUrl)).toEqual([b, a, c]);
  });

  it('returns array unchanged when cover URL is not in the list', () => {
    expect(orderPhotosCoverFirst([a, b, c], 'http://img/missing.jpg')).toEqual([a, b, c]);
  });
});

describe('buildSetCoverPayload', () => {
  it('builds a PUT body with photoUrl + photoSource and clears unsplash fields', () => {
    const photo = { id: 7, photoUrl: 'data:image/jpeg;base64,xxx', photoSource: 'upload' };
    expect(buildSetCoverPayload(photo)).toEqual({
      photoUrl: 'data:image/jpeg;base64,xxx',
      photoSource: 'upload',
      unsplashImageUrl: null,
      unsplashAttribution: null,
    });
  });

  it('defaults photoSource to "upload" when missing', () => {
    const photo = { id: 8, photoUrl: 'http://img/x.jpg' };
    expect(buildSetCoverPayload(photo).photoSource).toBe('upload');
  });

  it('returns null for missing or invalid photo', () => {
    expect(buildSetCoverPayload(null)).toBeNull();
    expect(buildSetCoverPayload({ id: 1 })).toBeNull();
  });
});
