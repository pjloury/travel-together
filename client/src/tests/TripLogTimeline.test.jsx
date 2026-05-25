// Tests for the grouping logic used by TripLogTimeline
import { describe, it, expect } from 'vitest';

// Extracted grouping logic (mirrors TripLogTimeline.jsx internals)
function groupLogs(logs) {
  const groups = {};
  for (const log of logs) {
    const year = log.visitYear ?? 'Unknown';
    const month = log.visitMonth ?? 0;
    if (!groups[year]) groups[year] = {};
    if (!groups[year][month]) groups[year][month] = [];
    groups[year][month].push(log);
  }
  return groups;
}

function sortedYears(groups) {
  return Object.keys(groups).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return parseInt(b) - parseInt(a);
  });
}

function sortedMonths(monthMap) {
  return Object.keys(monthMap)
    .map(Number)
    .sort((a, b) => {
      if (a === 0) return 1;
      if (b === 0) return -1;
      return b - a;
    });
}

const make = (overrides) => overrides.map((o, i) => ({
  id: `log-${i}`,
  placeName: o.place || 'Somewhere',
  visitYear: o.year ?? null,
  visitMonth: o.month ?? null,
}));

describe('groupLogs', () => {
  it('groups entries by year and month', () => {
    const logs = make([
      { place: 'San Diego', year: 2026, month: 5 },
      { place: 'Tahoe',     year: 2026, month: 1 },
      { place: 'San Diego', year: 2025, month: 12 },
    ]);
    const groups = groupLogs(logs);
    expect(Object.keys(groups)).toContain('2026');
    expect(Object.keys(groups)).toContain('2025');
    expect(groups['2026'][5]).toHaveLength(1);
    expect(groups['2026'][1]).toHaveLength(1);
    expect(groups['2025'][12]).toHaveLength(1);
  });

  it('places entries without a year under "Unknown"', () => {
    const logs = make([{ place: 'Mystery', year: null, month: null }]);
    const groups = groupLogs(logs);
    expect(groups['Unknown']).toBeDefined();
    expect(groups['Unknown'][0]).toHaveLength(1);
  });

  it('groups multiple trips to same place in same month', () => {
    const logs = make([
      { place: 'San Diego', year: 2026, month: 3 },
      { place: 'San Diego', year: 2026, month: 3 },
    ]);
    const groups = groupLogs(logs);
    expect(groups['2026'][3]).toHaveLength(2);
  });
});

describe('sortedYears', () => {
  it('sorts years descending with Unknown last', () => {
    const groups = groupLogs(make([
      { year: 2024 }, { year: 2026 }, { year: null },
    ]));
    const years = sortedYears(groups);
    expect(years[0]).toBe('2026');
    expect(years[1]).toBe('2024');
    expect(years[years.length - 1]).toBe('Unknown');
  });
});

describe('sortedMonths', () => {
  it('sorts months descending with 0 (no-month) last', () => {
    const monthMap = { 3: [], 11: [], 0: [] };
    const months = sortedMonths(monthMap);
    expect(months[0]).toBe(11);
    expect(months[1]).toBe(3);
    expect(months[months.length - 1]).toBe(0);
  });
});
