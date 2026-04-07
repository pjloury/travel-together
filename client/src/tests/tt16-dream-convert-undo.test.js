// TT16: confetti + undo after dream-to-memory conversion
//
// Acceptance criteria:
//   1. handleDreamConvertSaved triggers confetti (setShowConfetti(true)) and sets undoPin.
//   2. After 8s, undoPin is cleared automatically.
//   3. handleUndo deletes the memory pin and, when dreamArchived=true, unarchives the dream.
//   4. handleUndo is a no-op when undoPin is null.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── extracted logic matching BoardView's handleDreamConvertSaved / handleUndo ──

function makeHandlers({ setDreamConvertOpen, setDreamConvertPin, fetchData,
                         setShowConfetti, setUndoPin, setUndoTimer,
                         getUndoPin, getUndoTimer,
                         apiDelete, apiPut }) {
  function handleDreamConvertSaved({ memoryId, dreamId, dreamArchived } = {}) {
    setDreamConvertOpen(false);
    setDreamConvertPin(null);
    fetchData();

    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);

    const currentTimer = getUndoTimer();
    if (currentTimer) clearTimeout(currentTimer);
    setUndoPin({ memoryId, dreamId, dreamArchived });
    const t = setTimeout(() => setUndoPin(null), 8000);
    setUndoTimer(t);
  }

  async function handleUndo() {
    const undoPin = getUndoPin();
    if (!undoPin) return;
    const timer = getUndoTimer();
    clearTimeout(timer);
    setUndoPin(null);
    try {
      if (undoPin.memoryId) await apiDelete(`/pins/${undoPin.memoryId}`);
      if (undoPin.dreamId && undoPin.dreamArchived) {
        await apiPut(`/pins/${undoPin.dreamId}`, { archived: false });
      }
    } catch { /* silent */ }
    fetchData();
  }

  return { handleDreamConvertSaved, handleUndo };
}

describe('TT16 — handleDreamConvertSaved', () => {
  let setDreamConvertOpen, setDreamConvertPin, fetchData;
  let setShowConfetti, setUndoPin, setUndoTimer;
  let undoPinValue, undoTimerValue;

  beforeEach(() => {
    vi.useFakeTimers();
    undoPinValue = null;
    undoTimerValue = null;
    setDreamConvertOpen = vi.fn();
    setDreamConvertPin = vi.fn();
    fetchData = vi.fn();
    setShowConfetti = vi.fn();
    setUndoPin = vi.fn((v) => { undoPinValue = typeof v === 'function' ? v(undoPinValue) : v; });
    setUndoTimer = vi.fn((v) => { undoTimerValue = v; });
  });

  function makeH(apiDelete = vi.fn(), apiPut = vi.fn()) {
    return makeHandlers({
      setDreamConvertOpen, setDreamConvertPin, fetchData,
      setShowConfetti, setUndoPin, setUndoTimer,
      getUndoPin: () => undoPinValue,
      getUndoTimer: () => undoTimerValue,
      apiDelete, apiPut,
    });
  }

  it('closes modal and calls fetchData', () => {
    const { handleDreamConvertSaved } = makeH();
    handleDreamConvertSaved({ memoryId: 5, dreamId: 3, dreamArchived: false });
    expect(setDreamConvertOpen).toHaveBeenCalledWith(false);
    expect(setDreamConvertPin).toHaveBeenCalledWith(null);
    expect(fetchData).toHaveBeenCalledOnce();
  });

  it('sets showConfetti to true then false after 3s', () => {
    const { handleDreamConvertSaved } = makeH();
    handleDreamConvertSaved({ memoryId: 5, dreamId: 3, dreamArchived: false });
    expect(setShowConfetti).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(3000);
    expect(setShowConfetti).toHaveBeenCalledWith(false);
  });

  it('sets undoPin with correct ids', () => {
    const { handleDreamConvertSaved } = makeH();
    handleDreamConvertSaved({ memoryId: 5, dreamId: 3, dreamArchived: true });
    expect(undoPinValue).toEqual({ memoryId: 5, dreamId: 3, dreamArchived: true });
  });

  it('clears undoPin after 8 seconds', () => {
    const { handleDreamConvertSaved } = makeH();
    handleDreamConvertSaved({ memoryId: 5, dreamId: 3, dreamArchived: false });
    expect(undoPinValue).not.toBeNull();
    vi.advanceTimersByTime(8000);
    expect(undoPinValue).toBeNull();
  });
});

describe('TT16 — handleUndo', () => {
  let fetchData, setUndoPin, setUndoTimer;
  let undoPinValue, undoTimerValue;
  let apiDelete, apiPut;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchData = vi.fn();
    apiDelete = vi.fn().mockResolvedValue({});
    apiPut = vi.fn().mockResolvedValue({});
    setUndoPin = vi.fn((v) => { undoPinValue = typeof v === 'function' ? v(undoPinValue) : v; });
    setUndoTimer = vi.fn((v) => { undoTimerValue = v; });
  });

  function makeH(initialPin = null) {
    undoPinValue = initialPin;
    undoTimerValue = null;
    return makeHandlers({
      setDreamConvertOpen: vi.fn(), setDreamConvertPin: vi.fn(), fetchData,
      setShowConfetti: vi.fn(), setUndoPin, setUndoTimer,
      getUndoPin: () => undoPinValue,
      getUndoTimer: () => undoTimerValue,
      apiDelete, apiPut,
    });
  }

  it('is a no-op when undoPin is null', async () => {
    const { handleUndo } = makeH(null);
    await handleUndo();
    expect(apiDelete).not.toHaveBeenCalled();
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('deletes the memory pin on undo', async () => {
    const { handleUndo } = makeH({ memoryId: 7, dreamId: 2, dreamArchived: false });
    await handleUndo();
    expect(apiDelete).toHaveBeenCalledWith('/pins/7');
  });

  it('unarchives dream when dreamArchived=true', async () => {
    const { handleUndo } = makeH({ memoryId: 7, dreamId: 2, dreamArchived: true });
    await handleUndo();
    expect(apiPut).toHaveBeenCalledWith('/pins/2', { archived: false });
  });

  it('does NOT unarchive dream when dreamArchived=false', async () => {
    const { handleUndo } = makeH({ memoryId: 7, dreamId: 2, dreamArchived: false });
    await handleUndo();
    expect(apiPut).not.toHaveBeenCalled();
  });

  it('clears undoPin and calls fetchData', async () => {
    const { handleUndo } = makeH({ memoryId: 7, dreamId: 2, dreamArchived: false });
    await handleUndo();
    expect(undoPinValue).toBeNull();
    expect(fetchData).toHaveBeenCalledOnce();
  });

  it('still calls fetchData even when api calls fail', async () => {
    apiDelete = vi.fn().mockRejectedValue(new Error('network'));
    const { handleUndo } = makeH({ memoryId: 7, dreamId: 2, dreamArchived: false });
    await handleUndo();
    expect(fetchData).toHaveBeenCalledOnce();
  });
});
