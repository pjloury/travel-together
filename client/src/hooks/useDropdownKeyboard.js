// useDropdownKeyboard — arrow key navigation + enter to select for autocomplete dropdowns
import { useState, useCallback } from 'react';

/**
 * @param {number} itemCount - Number of items in the dropdown
 * @param {function} onSelect - Called with the highlighted index when Enter is pressed
 * @param {function} [onEscape] - Called when Escape is pressed
 * @returns {{ highlightedIndex, setHighlightedIndex, handleKeyDown }}
 */
export default function useDropdownKeyboard(itemCount, onSelect, onEscape) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const handleKeyDown = useCallback((e) => {
    if (itemCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % itemCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev <= 0 ? itemCount - 1 : prev - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // If something is highlighted, select it; otherwise select first item
      const idx = highlightedIndex >= 0 ? highlightedIndex : 0;
      if (idx < itemCount) onSelect(idx);
    } else if (e.key === 'Escape') {
      setHighlightedIndex(-1);
      if (onEscape) onEscape();
    }
  }, [itemCount, highlightedIndex, onSelect, onEscape]);

  // Reset highlight when item count changes (new search results)
  const resetHighlight = useCallback(() => setHighlightedIndex(-1), []);

  return { highlightedIndex, setHighlightedIndex, handleKeyDown, resetHighlight };
}
