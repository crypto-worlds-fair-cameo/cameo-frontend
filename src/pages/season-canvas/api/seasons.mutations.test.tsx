import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seasonQueryKeys } from './seasons.queries';
import type { Season } from './seasons.types';
import { useEndSeasonMutation } from './seasons.mutations';

const api = vi.hoisted(() => ({ endSeason: vi.fn() }));

vi.mock('./seasons.api', () => ({
  cancelSeason: vi.fn(),
  createSeason: vi.fn(),
  endSeason: api.endSeason,
}));

function season(id: string, title = 'Updated by mutation'): Season {
  return {
    id,
    creatorId: 'owner',
    title,
    description: null,
    width: 1000,
    height: 1000,
    strokeLimitPerUser: 1,
    capacity: 20,
    participantCount: 1,
    startsAt: '2026-10-10T00:00:00.000Z',
    endsAt: '2026-10-11T00:00:00.000Z',
    cancelledAt: null,
    forceEndedAt: '2026-10-10T12:00:00.000Z',
    createdAt: '2026-10-07T00:00:00.000Z',
    status: 'ended',
    isParticipant: true,
    isCreator: true,
    canCancel: false,
    canEnd: false,
  };
}

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('scoped season mutations', () => {
  it('drops a late response after its session scope becomes stale', async () => {
    const client = new QueryClient();
    let resolveRequest!: (value: Season) => void;
    api.endSeason.mockImplementationOnce(() => new Promise(resolve => (resolveRequest = resolve)));
    let current = true;
    const scope = { sessionKey: 'account-a', epoch: 1 };
    const accountBKey = seasonQueryKeys.detail('account-b', 'season-1');
    client.setQueryData(accountBKey, season('season-1', 'Account B data'));
    const { result } = renderHook(() => useEndSeasonMutation(() => current), {
      wrapper: wrapper(client),
    });

    let pending!: Promise<Season>;
    act(() => {
      pending = result.current.mutateAsync({ id: 'season-1', scope });
    });
    await waitFor(() => expect(api.endSeason).toHaveBeenCalledWith('season-1'));
    current = false;
    await act(async () => resolveRequest(season('season-1')));
    await pending;

    expect(
      client.getQueryData(seasonQueryKeys.detail(scope.sessionKey, 'season-1'))
    ).toBeUndefined();
    expect(client.getQueryData(accountBKey)).toEqual(season('season-1', 'Account B data'));
  });

  it('keeps mutation result when a detail request started earlier resolves late', async () => {
    const client = new QueryClient();
    const scope = { sessionKey: 'account-a', epoch: 1 };
    const detailKey = seasonQueryKeys.detail(scope.sessionKey, 'season-1');
    let resolveDetail!: (value: Season) => void;
    const inFlightDetail = client
      .fetchQuery({
        queryKey: detailKey,
        queryFn: () => new Promise<Season>(resolve => (resolveDetail = resolve)),
      })
      .catch(() => undefined);
    api.endSeason.mockResolvedValueOnce(season('season-1'));
    const { result } = renderHook(() => useEndSeasonMutation(() => true), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: 'season-1', scope });
    });
    resolveDetail(season('season-1', 'Stale detail response'));
    await inFlightDetail;

    expect(client.getQueryData<Season>(detailKey)?.title).toBe('Updated by mutation');
  });
});
