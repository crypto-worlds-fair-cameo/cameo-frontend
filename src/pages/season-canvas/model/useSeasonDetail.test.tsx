import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Season } from '../api/seasons.types';
import { useSeasonDetail } from './useSeasonDetail';

const { invalidateQueries, refetch, queryState } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  refetch: vi.fn(),
  queryState: { data: undefined as Season | undefined },
}));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock('../api/seasons.queries', () => ({
  seasonQueryKeys: {
    root: ['season-canvas'],
    lists: (key: string) => ['season-canvas', key, 'list'],
    detail: (key: string, id: string) => ['season-canvas', key, 'detail', id],
  },
  useSeasonDetailQuery: () => ({ data: queryState.data, refetch, isLoading: false }),
}));
vi.mock('../api/seasons.mutations', () => ({
  useCancelSeasonMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEndSeasonMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function season(overrides: Partial<Season> = {}): Season {
  return {
    id: 'a',
    creatorId: 'u',
    title: 'A',
    description: null,
    width: 1000,
    height: 1000,
    strokeLimitPerUser: 1,
    capacity: 20,
    participantCount: 1,
    startsAt: '2026-10-10T00:00:00.000Z',
    endsAt: '2026-10-11T00:00:00.000Z',
    cancelledAt: null,
    forceEndedAt: null,
    createdAt: '2026-10-07T00:00:00.000Z',
    status: 'scheduled',
    isParticipant: true,
    isCreator: true,
    canCancel: true,
    canEnd: false,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
  queryState.data = undefined;
  refetch.mockReset();
  invalidateQueries.mockReset();
});

describe('season detail async ownership', () => {
  it('does not open A confirmation after the user switches to B', async () => {
    let resolveRefresh!: (value: unknown) => void;
    queryState.data = season();
    refetch.mockImplementation(() => new Promise(resolve => (resolveRefresh = resolve)));
    const token = { sessionKey: 'user', epoch: 1 };
    const { result } = renderHook(() =>
      useSeasonDetail({
        sessionKey: 'user',
        isReady: true,
        resetVersion: 0,
        captureScope: () => token,
        isCurrentScope: () => true,
      })
    );
    await act(async () => {});
    act(() => result.current.openDetail('a'));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.openManage('cancel');
    });
    act(() => result.current.openDetail('b'));
    await act(async () => {
      resolveRefresh({ data: season(), isError: false });
      await pending;
    });
    expect(result.current.manageAction).toBeNull();
  });

  it('re-arms a capped timer until a boundary more than 24 hours away', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T00:00:00.000Z'));
    queryState.data = season({ startsAt: '2026-10-09T00:00:00.000Z' });
    refetch.mockResolvedValue({ data: queryState.data, isError: false });
    const { result } = renderHook(() =>
      useSeasonDetail({
        sessionKey: 'user',
        isReady: true,
        resetVersion: 0,
        captureScope: () => ({ sessionKey: 'user', epoch: 1 }),
        isCurrentScope: () => true,
      })
    );
    await act(async () => {});
    act(() => result.current.openDetail('a'));
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(invalidateQueries).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 100));
    expect(invalidateQueries).toHaveBeenCalled();
  });

  it('releases management preparation when the session scope resets', async () => {
    let resolveRefresh!: (value: unknown) => void;
    queryState.data = season();
    refetch.mockImplementation(() => new Promise(resolve => (resolveRefresh = resolve)));
    const token = { sessionKey: 'user', epoch: 1 };
    const { result, rerender } = renderHook(
      ({ resetVersion }) =>
        useSeasonDetail({
          sessionKey: 'user',
          isReady: true,
          resetVersion,
          captureScope: () => token,
          isCurrentScope: () => false,
        }),
      { initialProps: { resetVersion: 0 } }
    );
    await act(async () => {});
    act(() => result.current.openDetail('a'));
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.openManage('cancel');
    });
    expect(result.current.isRefreshingManagement).toBe(true);
    rerender({ resetVersion: 1 });
    await act(async () => {});
    expect(result.current.isRefreshingManagement).toBe(false);
    await act(async () => {
      resolveRefresh({ data: season(), isError: false });
      await pending;
    });
    expect(result.current.manageAction).toBeNull();
  });
});
