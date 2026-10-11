import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getParticipatedSeasons } from '../api/profile.api';
import { JoinedCanvases } from './JoinedCanvases';

vi.mock('../api/profile.api', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/profile.api')>()),
  getParticipatedSeasons: vi.fn(),
}));
vi.mock('@/features/season-nft-claim', () => ({
  SeasonNftClaimCard: ({
    seasonId,
    initialSummary,
  }: {
    seasonId: string;
    initialSummary: { availability: string };
  }) => <div data-testid={`nft-${seasonId}`}>{initialSummary.availability}</div>,
}));

function item(id: string, availability = 'PREPARING') {
  return {
    seasonId: id,
    title: `Season ${id.slice(0, 4)}`,
    lifecycleStatus: 'ended' as const,
    startsAt: '2026-10-01T00:00:00.000Z',
    endsAt: '2026-10-10T00:00:00.000Z',
    joinedAt: '2026-10-02T00:00:00.000Z',
    ownStrokeCount: 3,
    finalImageUrl: null as string | null,
    nft: {
      network: 'devnet' as const,
      availability: availability as 'PREPARING' | 'READY',
      reason: null,
      claim: {
        eligibility: 'ELIGIBLE' as const,
        state: 'UNCLAIMED' as const,
        walletAddress: null,
        activeAttemptId: null,
        assetAddress: null,
        signature: null,
        receiptState: 'NONE' as const,
        claimedAt: null,
      },
    },
  };
}

function renderJoined() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <JoinedCanvases userId="user-1" />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('JoinedCanvases', () => {
  it('loads 20-item pages, deduplicates season ids, and passes NFT summaries to cards', async () => {
    const first = item('11111111-1111-4111-8111-111111111111');
    first.finalImageUrl = 'https://cdn.example.com/final.png';
    const second = item('22222222-2222-4222-8222-222222222222', 'READY');
    vi.mocked(getParticipatedSeasons)
      .mockResolvedValueOnce({ items: [first], total: 21, limit: 20, offset: 0 })
      .mockResolvedValueOnce({ items: [first, second], total: 21, limit: 20, offset: 20 });
    const user = userEvent.setup();
    renderJoined();

    expect((await screen.findByTestId(`nft-${first.seasonId}`)).textContent).toBe('PREPARING');
    expect(document.querySelector('img.profile-thumbnail')?.getAttribute('src')).toBe(
      first.finalImageUrl
    );
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    expect((await screen.findByTestId(`nft-${second.seasonId}`)).textContent).toBe('READY');
    expect(screen.getAllByTestId(new RegExp('^nft-'))).toHaveLength(2);
    expect(vi.mocked(getParticipatedSeasons).mock.calls.map(call => call.slice(0, 2))).toEqual([
      [20, 0],
      [20, 20],
    ]);
  });

  it('shows a retry action when the list cannot be loaded', async () => {
    vi.mocked(getParticipatedSeasons)
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ items: [], total: 0, limit: 20, offset: 0 });
    const user = userEvent.setup();
    renderJoined();
    expect((await screen.findByRole('alert')).textContent).toContain(
      '참여한 캔버스를 불러오지 못했습니다'
    );
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByText('아직 참여한 캔버스가 없습니다.')).toBeTruthy();
  });

  it('pauses while hidden and refreshes PREPARING summaries when focus returns', async () => {
    const seasonId = '11111111-1111-4111-8111-111111111111';
    vi.mocked(getParticipatedSeasons)
      .mockResolvedValueOnce({ items: [item(seasonId)], total: 1, limit: 20, offset: 0 })
      .mockResolvedValue({ items: [item(seasonId, 'READY')], total: 1, limit: 20, offset: 0 });
    renderJoined();
    expect((await screen.findByTestId(`nft-${seasonId}`)).textContent).toBe('PREPARING');

    focusManager.setFocused(false);
    await Promise.resolve();
    expect(getParticipatedSeasons).toHaveBeenCalledTimes(1);
    focusManager.setFocused(true);
    await waitFor(() => expect(screen.getByTestId(`nft-${seasonId}`).textContent).toBe('READY'));
    focusManager.setFocused(undefined);
  });
});
