// @vitest-environment jsdom
// TT28: Edit dream description (dreamNote) inline
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import DreamDetail from '../components/DreamDetail';

// Mock the api client
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../api/client';

const basePin = {
  id: 42,
  placeName: 'Tokyo',
  dreamNote: 'Amazing ramen and temples',
  aiSummary: null,
  tags: [],
  unsplashImageUrl: null,
  photoUrl: null,
};

function renderDreamDetail(props = {}) {
  const { pin, ...rest } = props;
  return render(
    <DreamDetail
      pin={pin || basePin}
      isOpen={true}
      onClose={vi.fn()}
      onPinChanged={rest.onPinChanged || vi.fn()}
      readOnly={rest.readOnly ?? false}
      {...rest}
    />
  );
}

describe('TT28: DreamDetail dreamNote inline editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.put.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the edit (pencil) button when not readOnly', () => {
    renderDreamDetail();
    // The pencil button should be present
    const editBtns = screen.getAllByText('✏️');
    expect(editBtns.length).toBeGreaterThan(0);
  });

  it('does NOT show the edit button when readOnly', () => {
    renderDreamDetail({ readOnly: true });
    const editBtns = screen.queryAllByText('✏️');
    expect(editBtns.length).toBe(0);
  });

  it('clicking pencil reveals textarea pre-filled with current dreamNote', () => {
    renderDreamDetail();
    const editBtn = screen.getByText('✏️');
    fireEvent.click(editBtn);

    const textarea = screen.getByPlaceholderText('Why do you want to go here?');
    expect(textarea).toBeTruthy();
    expect(textarea.value).toBe('Amazing ramen and temples');
  });

  it('clicking pencil hides the pencil button and shows Save/Cancel', () => {
    renderDreamDetail();
    fireEvent.click(screen.getByText('✏️'));

    // Save button in the note editor row
    const saveBtns = screen.getAllByText('Save');
    expect(saveBtns.length).toBeGreaterThan(0);
    expect(screen.getByText('Cancel')).toBeTruthy();
    // Pencil button should be gone
    expect(screen.queryAllByText('✏️').length).toBe(0);
  });

  it('Cancel closes edit mode without saving', () => {
    renderDreamDetail();
    fireEvent.click(screen.getByText('✏️'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(api.put).not.toHaveBeenCalled();
    // Pencil button should be back
    expect(screen.getByText('✏️')).toBeTruthy();
  });

  it('Save calls PUT /pins/:id with edited dreamNote and fires onPinChanged', async () => {
    const onPinChanged = vi.fn();
    renderDreamDetail({ onPinChanged });

    fireEvent.click(screen.getByText('✏️'));

    const textarea = screen.getByPlaceholderText('Why do you want to go here?');
    fireEvent.change(textarea, { target: { value: 'Updated reason to visit' } });

    // Click the Save button inside the note editor (first Save button = note save)
    const saveBtns = screen.getAllByText('Save');
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/pins/42', { dreamNote: 'Updated reason to visit' });
      expect(onPinChanged).toHaveBeenCalledWith(42, { dreamNote: 'Updated reason to visit' });
    });

    // Should exit edit mode after successful save — pencil button returns
    await waitFor(() => {
      expect(screen.getByText('✏️')).toBeTruthy();
    });
  });

  it('shows error message if PUT fails', async () => {
    api.put.mockRejectedValueOnce(new Error('Network error'));
    renderDreamDetail();

    fireEvent.click(screen.getByText('✏️'));
    const saveBtns = screen.getAllByText('Save');
    fireEvent.click(saveBtns[0]);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
    // Should still be in edit mode
    expect(screen.getByPlaceholderText('Why do you want to go here?')).toBeTruthy();
  });

  it('falls back to aiSummary when dreamNote is absent', () => {
    const pinWithAiSummary = { ...basePin, dreamNote: null, aiSummary: 'AI generated summary' };
    renderDreamDetail({ pin: pinWithAiSummary });

    fireEvent.click(screen.getByText('✏️'));
    const textarea = screen.getByPlaceholderText('Why do you want to go here?');
    expect(textarea.value).toBe('AI generated summary');
  });
});
