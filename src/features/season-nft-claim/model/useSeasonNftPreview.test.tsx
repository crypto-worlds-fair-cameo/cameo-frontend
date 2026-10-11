import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeasonNftPreview } from './useSeasonNftPreview';
import { claimQueryKeys } from '../api/season-nft.queries';

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  getSeasonNft: vi.fn(),
}));
vi.mock('@/entities/session', () => ({
  sessionMutationKey: ['session-mutation'],
  useSessionQuery: () => ({ data: mocks.session }),
}));
vi.mock('../api/season-nft.api', () => ({ getSeasonNft: mocks.getSeasonNft }));
const imageUrl = 'https://arweave.net/' + 'a'.repeat(43);
function wrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}
beforeEach(() => {
  mocks.session = null;
  mocks.getSeasonNft.mockReset().mockResolvedValue({ imageUrl });
});

describe('season preview query', () => {
  it('does not request NFT state before login or for an unfinished season', async () => {
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ enabled }) => useSeasonNftPreview('season-1', enabled),
      { initialProps: { enabled: true }, wrapper: wrapper(client) }
    );
    await act(async () => Promise.resolve());
    expect(result.current).toBeNull();
    mocks.session = { user: { id: 'user-1' } };
    rerender({ enabled: false });
    await act(async () => Promise.resolve());
    expect(mocks.getSeasonNft).not.toHaveBeenCalled();
  });

  it('reuses the claim card cache and fetches separately after the user changes', async () => {
    const client = new QueryClient();
    mocks.session = { user: { id: 'user-1' } };
    client.setQueryData(claimQueryKeys.status('user-1', 'season-1'), { imageUrl });
    const { result, rerender } = renderHook(() => useSeasonNftPreview('season-1', true), {
      wrapper: wrapper(client),
    });
    expect(result.current).toBe(imageUrl);
    expect(mocks.getSeasonNft).not.toHaveBeenCalled();
    mocks.session = { user: { id: 'user-2' } };
    mocks.getSeasonNft.mockResolvedValue({ imageUrl: null });
    rerender();
    expect(result.current).toBeNull();
    await waitFor(() => expect(mocks.getSeasonNft).toHaveBeenCalledTimes(1));
  });

  it('falls back without repeated requests when the optional preview API fails', async () => {
    const client = new QueryClient();
    mocks.session = { user: { id: 'user-1' } };
    mocks.getSeasonNft.mockRejectedValue(new Error('preview unavailable'));
    const { result } = renderHook(() => useSeasonNftPreview('season-1', true), {
      wrapper: wrapper(client),
    });
    await waitFor(() =>
      expect(client.getQueryState(claimQueryKeys.status('user-1', 'season-1'))?.status).toBe(
        'error'
      )
    );
    expect(result.current).toBeNull();
    expect(mocks.getSeasonNft).toHaveBeenCalledTimes(1);
  });
});
