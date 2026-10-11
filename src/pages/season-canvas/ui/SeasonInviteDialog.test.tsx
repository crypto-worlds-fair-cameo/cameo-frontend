import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeasonInviteDialog } from './SeasonInviteDialog';

const writeText = vi.fn();
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const season = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Design the UI',
  endsAt: '2026-11-01T00:00:00Z',
};

beforeEach(() => {
  writeText.mockReset();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('season invite sharing', () => {
  it('copies a working workspace URL and shows the copied state', async () => {
    writeText.mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<SeasonInviteDialog open season={season} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole('button', { name: '복사' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '복사됨 ✓' })).toBeTruthy());
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/season-canvas/${season.id}`);
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('keeps the link available for manual copying after a clipboard failure', async () => {
    writeText.mockRejectedValue(new Error('Permission denied'));
    render(<SeasonInviteDialog open season={season} onOpenChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '복사' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('직접 복사'));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toContain(`/season-canvas/${season.id}`);
    expect(screen.queryByRole('button', { name: '복사됨 ✓' })).toBeNull();
  });

  it('does not retain a late copied result after the dialog closes and reopens', async () => {
    let resolveCopy!: () => void;
    writeText.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveCopy = resolve;
        })
    );
    const props = { open: true, season, onOpenChange: vi.fn() };
    const { rerender } = render(<SeasonInviteDialog {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '복사' }));
    rerender(<SeasonInviteDialog {...props} open={false} />);
    resolveCopy();
    rerender(<SeasonInviteDialog {...props} />);
    await waitFor(() => expect(screen.getByRole('button', { name: '복사' })).toBeTruthy());
    expect(screen.queryByRole('button', { name: '복사됨 ✓' })).toBeNull();
  });
});
