import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listCanvasHistory } from './api/history.api';
import type { CanvasHistoryItem } from './api/history.types';
import HistoryPage from './HistoryPage';

vi.mock('./api/history.api', () => ({ listCanvasHistory: vi.fn() }));

const canvasId = '0414f7c0-e937-4efb-a058-7b5bf11f75b8';

// 브라우저 시간대와 관계없이 표시 시각이 정해지도록 로컬 시각으로 만든다.
function snapshot(id: string, hour: number): CanvasHistoryItem {
  return {
    id,
    imageUrl: `https://api.example.com/canvas-assets/${id}.png`,
    width: 100,
    height: 100,
    capturedAt: new Date(2026, 9, 9, hour).toISOString(),
    isFinal: false,
  };
}

function renderHistory() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <HistoryPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.stubEnv('VITE_MAIN_CANVAS_ID', canvasId);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('history page', () => {
  it('explains that history is unavailable when the main canvas ID is not configured', () => {
    vi.stubEnv('VITE_MAIN_CANVAS_ID', '');
    renderHistory();
    expect(screen.getByRole('heading', { name: '히스토리를 사용할 수 없어요' })).toBeTruthy();
    expect(listCanvasHistory).not.toHaveBeenCalled();
  });

  it('shows the empty state when no snapshot exists yet', async () => {
    vi.mocked(listCanvasHistory).mockResolvedValue({ items: [], nextCursor: null, hasNext: false });
    renderHistory();
    expect(await screen.findByText('아직 스냅샷이 없어요')).toBeTruthy();
  });

  it('recovers from a failed first load with the retry action', async () => {
    vi.mocked(listCanvasHistory)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ items: [snapshot('a', 18)], nextCursor: null, hasNext: false });
    const user = userEvent.setup();
    renderHistory();
    expect((await screen.findByRole('alert')).textContent).toContain('스냅샷을 불러오지 못했어요');
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findAllByRole('button', { name: /스냅샷 열기/ })).toHaveLength(1);
  });

  it('marks the newest snapshot and loads the next page with the returned cursor', async () => {
    vi.mocked(listCanvasHistory)
      .mockResolvedValueOnce({
        items: [snapshot('a', 18), snapshot('b', 17)],
        nextCursor: 'cursor-1',
        hasNext: true,
      })
      .mockResolvedValueOnce({ items: [snapshot('c', 16)], nextCursor: null, hasNext: false });
    const user = userEvent.setup();
    renderHistory();

    const cards = await screen.findAllByRole('button', { name: /스냅샷 열기/ });
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('최신')).toBeTruthy();
    expect(screen.getByText('스냅샷 2개 이상')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '더 보기' }));
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /스냅샷 열기/ })).toHaveLength(3)
    );
    expect(vi.mocked(listCanvasHistory).mock.calls[1].slice(0, 2)).toEqual([
      canvasId,
      { limit: 20, cursor: 'cursor-1' },
    ]);
    expect(screen.getByText('스냅샷 3개')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  });

  it('moves between snapshots in the dialog and fetches older ones at the end of the list', async () => {
    vi.mocked(listCanvasHistory)
      .mockResolvedValueOnce({
        items: [snapshot('a', 18), snapshot('b', 17)],
        nextCursor: 'cursor-1',
        hasNext: true,
      })
      .mockResolvedValueOnce({ items: [snapshot('c', 16)], nextCursor: null, hasNext: false });
    const user = userEvent.setup();
    renderHistory();

    await user.click((await screen.findAllByRole('button', { name: /스냅샷 열기/ }))[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading').textContent).toContain('18:00');
    expect(within(dialog).getByRole('button', { name: /다음/ }).hasAttribute('disabled')).toBe(
      true
    );

    await user.click(within(dialog).getByRole('button', { name: /이전/ }));
    expect(within(dialog).getByRole('heading').textContent).toContain('17:00');

    // 불러온 마지막 스냅샷에서 이전을 누르면 다음 페이지를 받아 바로 이동한다.
    await user.click(within(dialog).getByRole('button', { name: /이전/ }));
    await waitFor(() => expect(within(dialog).getByRole('heading').textContent).toContain('16:00'));
    expect(within(dialog).getByRole('button', { name: /이전/ }).hasAttribute('disabled')).toBe(
      true
    );

    await user.click(within(dialog).getByRole('button', { name: /다음/ }));
    expect(within(dialog).getByRole('heading').textContent).toContain('17:00');
  });
});
