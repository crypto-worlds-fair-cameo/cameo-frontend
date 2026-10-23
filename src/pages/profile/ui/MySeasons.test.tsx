import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getHostedSeasons, type HostedSeason } from '../api/profile.api';
import { MySeasons } from './MySeasons';

vi.mock('../api/profile.api', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/profile.api')>()),
  getHostedSeasons: vi.fn(),
}));

function item(id: string, overrides: Partial<HostedSeason> = {}): HostedSeason {
  return {
    seasonId: id,
    title: `Season ${id.slice(0, 4)}`,
    lifecycleStatus: 'ended',
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2026-10-10T00:00:00.000Z',
    participantCount: 2,
    finalImageUrl: null,
    ...overrides,
  };
}

function renderSeasons() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MySeasons userId="user-1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('MySeasons', () => {
  it('lists my seasons in 20-item pages without duplicating a season', async () => {
    const first = item('11111111-1111-4111-8111-111111111111', {
      lifecycleStatus: 'active',
      participantCount: 1,
      finalImageUrl: 'https://cdn.example.com/final.png',
    });
    const second = item('22222222-2222-4222-8222-222222222222', { lifecycleStatus: 'cancelled' });
    vi.mocked(getHostedSeasons)
      .mockResolvedValueOnce({ items: [first], total: 21, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ items: [first, second], total: 21, limit: 20, offset: 20 });
    const user = userEvent.setup();
    renderSeasons();

    const [firstRow] = await screen.findAllByRole('article');
    expect(firstRow.textContent).toContain('참여자 1명');
    expect(firstRow.textContent).toContain('진행 중');
    expect(document.querySelector('img.profile-thumbnail')?.getAttribute('src')).toBe(
      first.finalImageUrl
    );
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    expect(within(screen.getAllByRole('article')[1]).getByText('취소')).toBeTruthy();
    expect(screen.getByRole('link', { name: `${second.title} 열기` }).getAttribute('href')).toBe(
      `/season-canvas/${second.seasonId}`
    );
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
    expect(vi.mocked(getHostedSeasons).mock.calls.map(call => call.slice(0, 2))).toEqual([
      [20, 0],
      [20, 20],
    ]);
  });

  it('shows a retry action when the list cannot be loaded, then the empty state', async () => {
    vi.mocked(getHostedSeasons)
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    const user = userEvent.setup();
    renderSeasons();
    expect((await screen.findByRole('alert')).textContent).toContain(
      '내 시즌을 불러오지 못했습니다'
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('아직 만든 시즌이 없습니다.')).toBeTruthy();
    expect(screen.getByRole('link', { name: '새 시즌' }).getAttribute('href')).toBe(
      '/season-canvas'
    );
  });
});
