import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeasonJoin } from './useSeasonJoin';
import type { useSeasonSessionScope } from './useSeasonSessionScope';
import { seasonQueryKeys } from '../api/seasons.queries';
import { SeasonRequestError, type Season } from '../api/seasons.types';

const api = vi.hoisted(() => ({ joinSeason: vi.fn() }));
vi.mock('../api/seasons.api', () => ({
  ...api,
  cancelSeason: vi.fn(),
  createSeason: vi.fn(),
  endSeason: vi.fn(),
}));
const season = {
  id: 'season-a',
  status: 'active',
  isParticipant: true,
  participantCount: 2,
} as Season;
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  let current = true;
  const token = { sessionKey: 'account-a', epoch: 1 };
  const scope = {
    session: { user: { id: 'a' } },
    resetVersion: 1,
    captureScope: () => token,
    isCurrentScope: () => current,
  } as unknown as ReturnType<typeof useSeasonSessionScope>;
  const joined = vi.fn();
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(
    ({ id, version }) => useSeasonJoin(id, { ...scope, resetVersion: version }, joined),
    { wrapper, initialProps: { id: 'season-a', version: 1 } }
  );
  return {
    ...hook,
    client,
    joined,
    invalidate: () => {
      current = false;
    },
  };
}
beforeEach(() => api.joinSeason.mockReset());
describe('season join lifecycle', () => {
  it('locks rapid duplicate clicks and reconnects after cache contains joined detail', async () => {
    let resolve!: (value: Season) => void;
    api.joinSeason.mockImplementationOnce(
      () =>
        new Promise<Season>(yes => {
          resolve = yes;
        })
    );
    const system = setup();
    let request!: Promise<void>;
    act(() => {
      request = system.result.current.join();
      void system.result.current.join();
    });
    await waitFor(() => expect(api.joinSeason).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolve(season);
      await request;
    });
    expect(system.client.getQueryData(seasonQueryKeys.detail('account-a', 'season-a'))).toBe(
      season
    );
    expect(system.joined).toHaveBeenCalledTimes(1);
  });
  it('allows a user-triggered retry after an ambiguous timeout without automatic retry', async () => {
    api.joinSeason.mockRejectedValueOnce(new SeasonRequestError('timeout', 'transport'));
    const system = setup();
    await act(async () => {
      await system.result.current.join();
    });
    expect(system.result.current.error).toBe('unavailable');
    expect(api.joinSeason).toHaveBeenCalledTimes(1);
    api.joinSeason.mockResolvedValueOnce(season);
    await act(async () => {
      await system.result.current.join();
    });
    expect(api.joinSeason.mock.calls.map(([id]) => id)).toEqual(['season-a', 'season-a']);
    expect(system.joined).toHaveBeenCalledTimes(1);
  });
  it('refreshes detail for capacity rejection and does not reconnect', async () => {
    api.joinSeason.mockRejectedValueOnce(
      new SeasonRequestError('full', 'business', 409, 'SEASON_CAPACITY_REACHED')
    );
    const system = setup();
    const invalidate = vi.spyOn(system.client, 'invalidateQueries');
    await act(async () => {
      await system.result.current.join();
    });
    expect(system.result.current.error).toBe('capacityReached');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: seasonQueryKeys.detail('account-a', 'season-a'),
    });
    expect(system.joined).not.toHaveBeenCalled();
  });
  it('ignores prior account response without creating a cache or new connection', async () => {
    let resolve!: (value: Season) => void;
    api.joinSeason.mockImplementationOnce(
      () =>
        new Promise<Season>(yes => {
          resolve = yes;
        })
    );
    const system = setup();
    let request!: Promise<void>;
    act(() => {
      request = system.result.current.join();
    });
    await waitFor(() => expect(api.joinSeason).toHaveBeenCalledTimes(1));
    system.invalidate();
    system.rerender({ id: 'season-a', version: 2 });
    await act(async () => {
      resolve(season);
      await request;
    });
    expect(
      system.client.getQueryData(seasonQueryKeys.detail('account-a', 'season-a'))
    ).toBeUndefined();
    expect(system.joined).not.toHaveBeenCalled();
    expect(system.result.current.isJoining).toBe(false);
  });
});
