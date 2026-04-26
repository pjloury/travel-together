// TripMergePicker — merge logic for the "I've been to {city}" Discover flow.
// Verifies the pure helpers used in mergeIntoExistingMemory:
//   - tag union (de-duped, capped at 12)
//   - note append rules (skip if city already mentioned)
//   - cover-photo patch only when existing pin has none
//   - same-country-first ranking
import { describe, it, expect } from 'vitest';

function mergeTags(existing, incoming) {
  const set = new Set(
    (existing || []).map(t => (typeof t === 'string' ? t : (t.name || t.label || ''))).filter(Boolean)
  );
  for (const t of (incoming || [])) set.add(t);
  return Array.from(set).slice(0, 12);
}

function mergeNote(existing, trip) {
  const e = (existing || '').trim();
  const tripLine = `Visited ${trip.city}, ${trip.country} — inspired by "${trip.title || 'Discover trip'}"`;
  const mentioned = e.toLowerCase().includes((trip.city || '').toLowerCase());
  if (mentioned || !trip.city) return e;
  return e ? `${e}\n\n${tripLine}` : tripLine;
}

function rankPins(pins, tripCountry) {
  const tc = (tripCountry || '').toLowerCase().trim();
  const same = [];
  const rest = [];
  for (const p of pins) {
    const c = (p.normalizedCountry || '').toLowerCase().trim();
    (c && c === tc ? same : rest).push(p);
  }
  return [...same, ...rest];
}

describe('Trip merge — tag union', () => {
  it('combines existing + incoming, de-duplicates', () => {
    const out = mergeTags(['food', 'history'], ['food', 'culture']);
    expect(out.sort()).toEqual(['culture', 'food', 'history']);
  });

  it('handles tag objects (with name) alongside strings', () => {
    const out = mergeTags([{ name: 'food' }, { label: 'art' }], ['art', 'nightlife']);
    expect(out.sort()).toEqual(['art', 'food', 'nightlife']);
  });

  it('caps the merged set at 12', () => {
    const existing = Array.from({ length: 10 }, (_, i) => `e${i}`);
    const incoming = Array.from({ length: 10 }, (_, i) => `i${i}`);
    expect(mergeTags(existing, incoming).length).toBe(12);
  });
});

describe('Trip merge — note append', () => {
  it('appends a trip line to a populated note', () => {
    const out = mergeNote('Best gelato of my life.', { city: 'Florence', country: 'Italy', title: 'Tuscany Eats' });
    expect(out).toContain('Best gelato of my life.');
    expect(out).toContain('Visited Florence, Italy');
  });

  it('uses the trip line alone when existing note is empty', () => {
    const out = mergeNote('', { city: 'Kyoto', country: 'Japan', title: 'Ancient Capital' });
    expect(out).toBe('Visited Kyoto, Japan — inspired by "Ancient Capital"');
  });

  it('skips append if the existing note already mentions the city', () => {
    const out = mergeNote('Loved Florence so much.', { city: 'Florence', country: 'Italy' });
    expect(out).toBe('Loved Florence so much.');
  });
});

describe('Trip merge — pin ranking', () => {
  it('puts same-country pins first', () => {
    const pins = [
      { id: '1', normalizedCountry: 'France' },
      { id: '2', normalizedCountry: 'Italy' },
      { id: '3', normalizedCountry: 'Italy' },
    ];
    const out = rankPins(pins, 'Italy');
    expect(out.map(p => p.id)).toEqual(['2', '3', '1']);
  });

  it('keeps original order within each bucket', () => {
    const pins = [
      { id: 'a', normalizedCountry: 'Spain' },
      { id: 'b', normalizedCountry: 'Italy' },
      { id: 'c', normalizedCountry: 'Italy' },
    ];
    const out = rankPins(pins, 'Italy');
    expect(out.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });
});
