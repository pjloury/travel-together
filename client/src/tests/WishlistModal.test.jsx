// Mirrors the gating logic that drives WishlistModal's suggestion
// dropdown + tooltip CTA. Kept as pure functions so the tests don't need
// react-simple-maps wiring or DOM rendering — same approach as
// CountriesModal.test.jsx.
import { describe, it, expect } from 'vitest';

const ALL = ['France', 'Italy', 'Iceland', 'India', 'Mexico', 'Japan', 'Spain'];

function suggestionState(input, wishlist, visited) {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const wl = new Set(wishlist.map(c => c.toLowerCase()));
  const vs = new Set(visited.map(c => c.toLowerCase()));
  return ALL
    .filter(c => c.toLowerCase().includes(q))
    .map(c => ({
      name: c,
      wishlisted: wl.has(c.toLowerCase()),
      visited: vs.has(c.toLowerCase()),
    }))
    .slice(0, 8);
}

function tooltipCta(name, wishlist, visited) {
  const lc = name.toLowerCase();
  if (visited.has(lc)) return 'visited';   // no CTA, just informational
  if (wishlist.has(lc)) return 'remove';
  return 'add';
}

describe('Wishlist suggestions', () => {
  it('marks visited countries so the row can render disabled', () => {
    const out = suggestionState('I', ['Italy'], ['India']);
    const india = out.find(o => o.name === 'India');
    expect(india.visited).toBe(true);
    expect(india.wishlisted).toBe(false);
  });

  it('flags already-on-wishlist countries for the remove path', () => {
    const out = suggestionState('I', ['Italy'], []);
    const italy = out.find(o => o.name === 'Italy');
    expect(italy.wishlisted).toBe(true);
  });
});

describe('Wishlist tooltip CTA', () => {
  it('shows Add for unvisited, not-on-wishlist countries', () => {
    expect(tooltipCta('Mexico', new Set(), new Set())).toBe('add');
  });
  it('shows Remove for countries already on the wishlist', () => {
    expect(tooltipCta('Mexico', new Set(['mexico']), new Set())).toBe('remove');
  });
  it('shows the visited badge (no CTA) when the user has been there', () => {
    // Visited beats wishlist so the contract "you can't wishlist a place
    // you've been to" still holds even if the data drifts.
    expect(tooltipCta('Mexico', new Set(['mexico']), new Set(['mexico']))).toBe('visited');
    expect(tooltipCta('Mexico', new Set(), new Set(['mexico']))).toBe('visited');
  });
});
