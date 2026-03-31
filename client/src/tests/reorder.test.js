// Story: Reorder saves optimistically — no full fetchData() called on success.
// Acceptance criteria:
//   1. After a successful reorder, fetchData is NOT called.
//   2. memoryTop / dreamTop state is updated in-place to reflect the new order.
//   3. On save failure, fetchData IS called to revert to server truth.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simulate the handleReorder logic extracted from BoardView
function makeHandleReorder({ activeTab, memoryTop, dreamTop, setMemoryTop, setDreamTop, apiPut, fetchData }) {
  return async function handleReorder(newPinIds) {
    const currentTop = activeTab === 'memory' ? memoryTop : dreamTop;
    const setTop = activeTab === 'memory' ? setMemoryTop : setDreamTop;

    // Optimistic update
    const pinMap = {};
    currentTop.forEach(tp => { pinMap[tp.pin?.id || tp.pinId] = tp; });
    const reordered = newPinIds
      .map((id, idx) => ({ ...(pinMap[id] || { pinId: id }), sortOrder: idx }))
      .filter(Boolean);
    setTop(reordered);

    try {
      await apiPut('/pins/top', { tab: activeTab, pinIds: newPinIds });
      // success — intentionally no fetchData()
    } catch {
      fetchData(); // revert on error
    }
  };
}

describe('handleReorder — optimistic update', () => {
  let fetchData, setMemoryTop, setDreamTop, apiPut;

  const memoryTop = [
    { pinId: 'a', pin: { id: 'a' }, sortOrder: 0 },
    { pinId: 'b', pin: { id: 'b' }, sortOrder: 1 },
    { pinId: 'c', pin: { id: 'c' }, sortOrder: 2 },
  ];

  beforeEach(() => {
    fetchData    = vi.fn();
    setMemoryTop = vi.fn();
    setDreamTop  = vi.fn();
    apiPut       = vi.fn().mockResolvedValue({});
  });

  it('does NOT call fetchData on successful save', async () => {
    const handleReorder = makeHandleReorder({
      activeTab: 'memory', memoryTop, dreamTop: [],
      setMemoryTop, setDreamTop, apiPut, fetchData,
    });
    await handleReorder(['c', 'a', 'b']);
    expect(fetchData).not.toHaveBeenCalled();
  });

  it('updates memoryTop state in the new order', async () => {
    const handleReorder = makeHandleReorder({
      activeTab: 'memory', memoryTop, dreamTop: [],
      setMemoryTop, setDreamTop, apiPut, fetchData,
    });
    await handleReorder(['c', 'a', 'b']);
    expect(setMemoryTop).toHaveBeenCalledOnce();
    const reordered = setMemoryTop.mock.calls[0][0];
    expect(reordered.map(tp => tp.pinId)).toEqual(['c', 'a', 'b']);
    expect(reordered.map(tp => tp.sortOrder)).toEqual([0, 1, 2]);
  });

  it('calls fetchData to revert when save fails', async () => {
    apiPut = vi.fn().mockRejectedValue(new Error('network error'));
    const handleReorder = makeHandleReorder({
      activeTab: 'memory', memoryTop, dreamTop: [],
      setMemoryTop, setDreamTop, apiPut, fetchData,
    });
    await handleReorder(['c', 'a', 'b']);
    expect(fetchData).toHaveBeenCalledOnce();
  });
});
