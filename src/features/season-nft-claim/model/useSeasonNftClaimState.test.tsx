import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SeasonNftView } from '../api/season-nft.types';
import { useSeasonNftClaimState } from './useSeasonNftClaimState';

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  getSeasonNft: vi.fn(),
}));
vi.mock('@/entities/session', () => ({
  sessionMutationKey: ['session-mutation'],
  useSessionQuery: () => ({ data: mocks.session }),
}));
vi.mock('../api/season-nft.api', () => ({ getSeasonNft: mocks.getSeasonNft }));

function view(
  availability: SeasonNftView['availability'],
  claim: Partial<SeasonNftView['claim']> = {}
): Partial<SeasonNftView> {
  return {
    availability,
    claim: {
      eligibility: 'ELIGIBLE',
      state: 'UNCLAIMED',
      walletAddress: null,
      activeAttemptId: null,
      assetAddress: null,
      signature: null,
      receiptState: 'NONE',
      claimedAt: null,
      ...claim,
    },
  };
}

let client: QueryClient;
function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  client = new QueryClient();
  mocks.session = { user: { id: 'user-1' } };
  mocks.getSeasonNft.mockReset();
});

describe('season NFT claim state', () => {
  it.each([
    [view('READY'), 'claimable'],
    [view('READY', { state: 'PROCESSING' }), 'processing'],
    [view('READY', { state: 'CLAIMED' }), 'claimed'],
    [view('READY', { eligibility: 'NOT_PARTICIPANT' }), null],
    [view('PREPARING'), null],
  ] as const)('summarizes the server status as %o -> %s', async (status, expected) => {
    mocks.getSeasonNft.mockResolvedValue(status);
    const { result } = renderHook(() => useSeasonNftClaimState('season-1', true), { wrapper });
    await waitFor(() => expect(mocks.getSeasonNft).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current).toBe(expected));
  });

  it('does not ask the server when signed out or for a season that has not ended', async () => {
    mocks.session = null;
    const { result, rerender } = renderHook(
      ({ enabled }) => useSeasonNftClaimState('season-1', enabled),
      { initialProps: { enabled: true }, wrapper }
    );
    await act(async () => Promise.resolve());
    mocks.session = { user: { id: 'user-1' } };
    rerender({ enabled: false });
    await act(async () => Promise.resolve());
    expect(result.current).toBeNull();
    expect(mocks.getSeasonNft).not.toHaveBeenCalled();
  });
});
