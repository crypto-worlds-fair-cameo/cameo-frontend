import type { PropsWithChildren } from 'react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  claimQueryKeys,
  useClaimAttemptQuery,
  useSeasonNftStatusQuery,
} from './season-nft.queries';
import { SeasonNftRequestError } from './season-nft.types';

const api = vi.hoisted(() => ({ getSeasonNft: vi.fn(), getClaimAttempt: vi.fn() }));
vi.mock('./season-nft.api', () => api);
let visibility: DocumentVisibilityState;
function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  api.getSeasonNft.mockResolvedValue({ network: 'devnet' });
  api.getClaimAttempt.mockResolvedValue({ state: 'QUEUED' });
});
afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe('season NFT query ownership', () => {
  it('isolates status by user and season and attempts by network and attempt', () => {
    expect(claimQueryKeys.status('user-a', 'season-a')).not.toEqual(
      claimQueryKeys.status('user-b', 'season-a')
    );
    expect(claimQueryKeys.attempt('user-a', 'devnet', 'season-a', 'attempt-a')).not.toEqual(
      claimQueryKeys.attempt('user-a', 'mainnet-beta', 'season-a', 'attempt-a')
    );
  });

  it('polls status every 30 seconds only while visible and refetches on focus return', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    renderHook(() => useSeasonNftStatusQuery('user-a', 'season-a', true), {
      wrapper: wrapper(client),
    });
    await act(async () => Promise.resolve());
    expect(api.getSeasonNft).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(api.getSeasonNft).toHaveBeenCalledTimes(2);
    visibility = 'hidden';
    focusManager.setFocused(false);
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(api.getSeasonNft).toHaveBeenCalledTimes(2);
    visibility = 'visible';
    await act(async () => {
      focusManager.setFocused(true);
      await Promise.resolve();
    });
    expect(api.getSeasonNft).toHaveBeenCalledTimes(3);
  });

  it('polls an active attempt every 3 seconds without opening any wallet', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    renderHook(() => useClaimAttemptQuery('user-a', 'devnet', 'season-a', 'attempt-a', true), {
      wrapper: wrapper(client),
    });
    await act(async () => Promise.resolve());
    expect(api.getClaimAttempt).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(3_000));
    expect(api.getClaimAttempt).toHaveBeenCalledTimes(2);
  });

  it('does not retry status polling after a 401 rejection', async () => {
    api.getSeasonNft.mockRejectedValue(new SeasonNftRequestError('signed out', 'business', 401));
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

    renderHook(() => useSeasonNftStatusQuery('user-a', 'season-a', true), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(api.getSeasonNft).toHaveBeenCalledTimes(1);
  });

  it('does not retry attempt polling when the authenticated user is unavailable', async () => {
    api.getClaimAttempt.mockRejectedValue(
      new SeasonNftRequestError('user unavailable', 'business', 403, 'AUTH_USER_UNAVAILABLE')
    );
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });

    renderHook(() => useClaimAttemptQuery('user-a', 'devnet', 'season-a', 'attempt-a', true), {
      wrapper: wrapper(client),
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(api.getClaimAttempt).toHaveBeenCalledTimes(1);
  });
});
