import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeasonJoinFlow } from './useSeasonJoinFlow';
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

const open = {
  id: 'season-a',
  status: 'active',
  isParticipant: false,
  participantCount: 2,
  capacity: 10,
} as Season;

function setup({ signedIn = true } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  let current = true;
  const token = { sessionKey: 'account-a', epoch: 1 };
  const scope = {
    session: signedIn ? { user: { id: 'a' } } : null,
    resetVersion: 1,
    captureScope: () => token,
    isCurrentScope: () => current,
  } as unknown as ReturnType<typeof useSeasonSessionScope>;
  const onNotice = vi.fn();
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const hook = renderHook(
    ({ version }) => useSeasonJoinFlow({ ...scope, resetVersion: version }, onNotice),
    { wrapper, initialProps: { version: 1 } }
  );
  return {
    ...hook,
    client,
    onNotice,
    invalidate: () => {
      current = false;
    },
  };
}

beforeEach(() => api.joinSeason.mockReset());

describe('season join flow', () => {
  it('asks a guest to connect a wallet without sending a join request', async () => {
    const system = setup({ signedIn: false });
    await act(async () => {
      await system.result.current.join(open);
    });
    expect(system.result.current.notice).toEqual({ kind: 'wallet' });
    expect(system.onNotice).toHaveBeenCalledTimes(1);
    expect(api.joinSeason).not.toHaveBeenCalled();
  });

  it('shows the full notice for a season that is already at capacity', async () => {
    const system = setup();
    await act(async () => {
      await system.result.current.join({ ...open, participantCount: 10 });
    });
    expect(system.result.current.notice).toEqual({ kind: 'full' });
    expect(api.joinSeason).not.toHaveBeenCalled();
  });

  it('locks duplicate clicks and shows the joined notice after the server confirms', async () => {
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
      request = system.result.current.join(open);
      void system.result.current.join(open);
    });
    await waitFor(() => expect(system.result.current.joiningId).toBe('season-a'));
    expect(api.joinSeason).toHaveBeenCalledTimes(1);
    const joined = { ...open, isParticipant: true, participantCount: 3 };
    await act(async () => {
      resolve(joined);
      await request;
    });
    expect(system.result.current.notice).toEqual({ kind: 'joined', seasonId: 'season-a' });
    expect(system.result.current.joiningId).toBeNull();
    expect(system.client.getQueryData(seasonQueryKeys.detail('account-a', 'season-a'))).toBe(
      joined
    );
  });

  it('turns a server capacity rejection into the full notice and refreshes detail', async () => {
    api.joinSeason.mockRejectedValueOnce(
      new SeasonRequestError('full', 'business', 409, 'SEASON_CAPACITY_REACHED')
    );
    const system = setup();
    const invalidate = vi.spyOn(system.client, 'invalidateQueries');
    await act(async () => {
      await system.result.current.join(open);
    });
    expect(system.result.current.notice).toEqual({ kind: 'full' });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: seasonQueryKeys.detail('account-a', 'season-a'),
    });
  });

  it('keeps the season for a user-triggered retry after a failure', async () => {
    api.joinSeason.mockRejectedValueOnce(new SeasonRequestError('timeout', 'transport'));
    const system = setup();
    await act(async () => {
      await system.result.current.join(open);
    });
    expect(system.result.current.notice).toEqual({
      kind: 'error',
      season: open,
      error: 'unavailable',
    });
    api.joinSeason.mockResolvedValueOnce({ ...open, isParticipant: true });
    await act(async () => {
      await system.result.current.join(open);
    });
    expect(system.result.current.notice).toEqual({ kind: 'joined', seasonId: 'season-a' });
    expect(api.joinSeason).toHaveBeenCalledTimes(2);
  });

  it('ignores a prior account response', async () => {
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
      request = system.result.current.join(open);
    });
    await waitFor(() => expect(api.joinSeason).toHaveBeenCalledTimes(1));
    system.invalidate();
    system.rerender({ version: 2 });
    await act(async () => {
      resolve({ ...open, isParticipant: true });
      await request;
    });
    expect(system.result.current.notice).toBeNull();
    expect(system.onNotice).not.toHaveBeenCalled();
    expect(system.result.current.joiningId).toBeNull();
  });
});
