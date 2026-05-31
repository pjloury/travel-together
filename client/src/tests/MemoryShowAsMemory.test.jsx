// @vitest-environment jsdom
// "Show as a memory" toggle in MemoryDetail — controls is_trip_log (inverted).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import MemoryDetail from '../components/MemoryDetail';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api/client';

const tripPin = {
  id: 7,
  pinType: 'memory',
  placeName: 'San Diego, CA',
  isTripLog: true, // timeline-only → toggle should read OFF
  aiSummary: null,
  tags: [],
  companions: [],
  countries: [],
  locations: [{ id: 1, placeName: 'San Diego' }], // present so no background fetch
  photos: [],
};

function renderDetail(props = {}) {
  const { pin, ...rest } = props;
  return render(
    <MemoryDetail
      pin={pin || tripPin}
      isOpen={true}
      onClose={vi.fn()}
      onPinChanged={rest.onPinChanged || vi.fn()}
      readOnly={rest.readOnly ?? false}
      {...rest}
    />
  );
}

describe('Show-as-memory toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({});
  });

  afterEach(() => cleanup());

  it('renders the toggle OFF for a timeline-only trip (isTripLog true)', () => {
    renderDetail();
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
  });

  it('renders the toggle ON for a board memory (isTripLog false)', () => {
    renderDetail({ pin: { ...tripPin, isTripLog: false } });
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('true');
  });

  it('toggling ON persists is_trip_log=false and fires onPinChanged', async () => {
    const onPinChanged = vi.fn();
    renderDetail({ onPinChanged });

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/pins/7', { isTripLog: false });
      expect(onPinChanged).toHaveBeenCalledWith(7, { isTripLog: false });
    });
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('reverts the toggle if the save fails', async () => {
    api.put.mockRejectedValueOnce(new Error('boom'));
    renderDetail();

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    });
  });

  it('does NOT render the toggle when readOnly', () => {
    renderDetail({ readOnly: true });
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('does NOT render the toggle for non-memory pins', () => {
    renderDetail({ pin: { ...tripPin, pinType: 'dream' } });
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
