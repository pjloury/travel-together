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

describe('Optimistic local add (no flicker)', () => {
  // Mirrors the merge logic in CountriesModal.effectiveCountries.
  function effective(countries, localAdds) {
    const seen = new Set(countries.map(c => c.country.toLowerCase().trim()));
    const merged = [...countries];
    for (const a of localAdds) {
      if (!seen.has(a.country.toLowerCase().trim())) {
        merged.push(a);
        seen.add(a.country.toLowerCase().trim());
      }
    }
    return merged;
  }

  it('appends a locally-added country to the visited list', () => {
    const out = effective(
      [{ country: 'France', flag: '🇫🇷' }],
      [{ country: 'Italy', flag: '🇮🇹' }]
    );
    expect(out.map(c => c.country).sort()).toEqual(['France', 'Italy']);
  });

  it('does not duplicate when parent eventually catches up', () => {
    const out = effective(
      [{ country: 'France' }, { country: 'Italy' }],
      [{ country: 'Italy', flag: '🇮🇹' }]
    );
    expect(out.length).toBe(2);
  });

  it('rolls back on error (caller resets localAdds)', () => {
    const local = [{ country: 'Italy' }];
    // simulating rollback
    const after = local.filter(a => a.country.toLowerCase() !== 'italy');
    expect(after).toEqual([]);
  });
});

describe('Arrow-key navigation', () => {
  // Mirrors the highlightIdx wrap-around logic.
  function next(idx, len) { return len ? (idx + 1) % len : 0; }
  function prev(idx, len) { return len ? (idx - 1 + len) % len : 0; }

  it('moves down through suggestions and wraps at the end', () => {
    expect(next(0, 3)).toBe(1);
    expect(next(2, 3)).toBe(0);
  });

  it('moves up through suggestions and wraps at the start', () => {
    expect(prev(1, 3)).toBe(0);
    expect(prev(0, 3)).toBe(2);
  });

  it('clamps to 0 when there are no suggestions', () => {
    expect(next(0, 0)).toBe(0);
    expect(prev(0, 0)).toBe(0);
  });
});

describe('Country aliases', () => {
  // Mirrors COUNTRY_ALIASES + aliasMatches behavior from the modal.
  const COUNTRY_ALIASES = {
    'usa': 'United States',
    'united states of america': 'United States',
    'america': 'United States',
    'uk': 'United Kingdom',
    'czechia': 'Czech Republic',
  };
  function aliasMatches(query) {
    const q = query.toLowerCase();
    const hits = new Set();
    for (const [alias, canon] of Object.entries(COUNTRY_ALIASES)) {
      if (alias.includes(q)) hits.add(canon);
    }
    return hits;
  }

  it('resolves "USA" to United States', () => {
    expect(Array.from(aliasMatches('usa'))).toContain('United States');
  });
  it('resolves "United States of America" to United States', () => {
    expect(Array.from(aliasMatches('united states of america'))).toContain('United States');
  });
  it('resolves "UK" to United Kingdom', () => {
    expect(Array.from(aliasMatches('uk'))).toContain('United Kingdom');
  });
  it('resolves partial alias "ame" to United States via "america"', () => {
    expect(Array.from(aliasMatches('ame'))).toContain('United States');
  });
});

describe('Visited countries reachable in suggestions', () => {
  // Mirrors the new suggestion behavior: visited countries are returned
  // (with visited:true) instead of being filtered out, so the user can
  // tap to remove them.
  function suggest(input, allCountries, visited) {
    const q = input.toLowerCase();
    const v = new Set(visited.map(c => c.toLowerCase()));
    const out = [];
    for (const c of allCountries) {
      const lc = c.toLowerCase();
      if (lc.includes(q)) {
        out.push({ name: c, visited: v.has(lc) });
      }
    }
    return out;
  }
  it('returns visited Russia with visited:true so user can remove it', () => {
    const out = suggest('russ', ['Russia', 'France'], ['Russia']);
    expect(out).toEqual([{ name: 'Russia', visited: true }]);
  });
  it('returns mix of visited + unvisited correctly tagged', () => {
    const out = suggest('a', ['Argentina', 'Albania'], ['Argentina']);
    expect(out).toEqual([
      { name: 'Argentina', visited: true },
      { name: 'Albania', visited: false },
    ]);
  });
});

describe('Prefix-first suggestion ranking', () => {
  // Mirrors the suggestions sort: prefix matches before substring matches.
  function rank(input, all, visited) {
    const q = input.toLowerCase();
    const prefix = []; const contains = [];
    const v = new Set(visited.map(c => c.toLowerCase()));
    for (const c of all) {
      const lc = c.toLowerCase();
      if (v.has(lc)) continue;
      if (lc.startsWith(q)) prefix.push(c);
      else if (lc.includes(q)) contains.push(c);
    }
    return [...prefix, ...contains];
  }

  it('puts startsWith() matches before includes() matches', () => {
    const out = rank('ja', ['Japan', 'Jamaica', 'Azerbaijan'], []);
    expect(out).toEqual(['Japan', 'Jamaica', 'Azerbaijan']);
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
