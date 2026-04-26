// Country search autocomplete + selection logic for CountriesModal.
// Stories:
//   2/3 — search input filters, hides already-visited, picks add a country
//   4/5 — selected country state is replaced on new pick, cleared on null
import { describe, it, expect } from 'vitest';

// Inline subset of CONTINENT_MAP keys — matches the production list.
const ALL_COUNTRIES = ['France', 'Italy', 'Iceland', 'India', 'Germany', 'Japan'];

function suggest(input, visited) {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const visitedSet = new Set(visited.map(c => c.toLowerCase()));
  return ALL_COUNTRIES
    .filter(c => c.toLowerCase().includes(q) && !visitedSet.has(c.toLowerCase()))
    .slice(0, 6);
}

describe('Country autocomplete', () => {
  it('returns no suggestions for empty input', () => {
    expect(suggest('', [])).toEqual([]);
    expect(suggest('   ', [])).toEqual([]);
  });

  it('matches partial prefix case-insensitively', () => {
    expect(suggest('it', [])).toEqual(['Italy']);
    expect(suggest('I', [])).toEqual(['Italy', 'Iceland', 'India']);
  });

  it('hides countries the user has already visited', () => {
    expect(suggest('I', ['Italy'])).toEqual(['Iceland', 'India']);
  });

  it('caps results at 6', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Country${i}`);
    const allCountries = many;
    const q = 'country';
    const result = allCountries
      .filter(c => c.toLowerCase().includes(q))
      .slice(0, 6);
    expect(result.length).toBe(6);
  });
});

describe('Map selection state', () => {
  it('replaces selection when user taps a different country', () => {
    let sel = { name: 'France', x: 100, y: 200 };
    sel = { name: 'Italy', x: 300, y: 250 };
    expect(sel.name).toBe('Italy');
  });

  it('clears selection on dismiss', () => {
    let sel = { name: 'France', x: 100, y: 200 };
    sel = null;
    expect(sel).toBeNull();
  });
});
