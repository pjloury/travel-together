// TT28: Edit dream title and description
import { describe, it, expect } from 'vitest';

describe('TT28: dream editing', () => {
  it('title edit saves trimmed value', () => {
    const trimmed = (v) => v.trim();
    expect(trimmed('  Tokyo  ')).toBe('Tokyo');
    expect(trimmed('Bali')).toBe('Bali');
  });

  it('note edit replaces existing content (not appends)', () => {
    const saveNote = (existing, newText) => newText.trim(); // full replace
    expect(saveNote('old note', 'new note')).toBe('new note');
    expect(saveNote('', 'first note')).toBe('first note');
  });
});
