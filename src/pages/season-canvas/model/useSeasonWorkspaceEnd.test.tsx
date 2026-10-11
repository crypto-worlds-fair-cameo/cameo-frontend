import { act, renderHook } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Season } from '../api/seasons.types';
import type { useSeasonSessionScope } from './useSeasonSessionScope';
import { useSeasonWorkspaceEnd } from './useSeasonWorkspaceEnd';

const { mutateAsync, invalidateQueries } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  invalidateQueries: vi.fn(),
}));
vi.mock('@tanstack/react-query', async original => ({
  ...(await original<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ invalidateQueries }),
}));
vi.mock('../api/seasons.mutations', () => ({
  useEndSeasonMutation: () => ({ mutateAsync, isPending: false }),
}));

const season = { id: 's', title: 'Season', status: 'active', canEnd: true } as Season;
function scope(version = 0, isCurrentScope = () => true) {
  return {
    resetVersion: version,
    session: { user: { id: 'owner' } },
    captureScope: () => ({ sessionKey: 'owner', epoch: version }),
    isCurrentScope,
  } as unknown as ReturnType<typeof useSeasonSessionScope>;
}
function query(refetch = vi.fn(async () => ({ data: season, isError: false })), data = season) {
  return { data, isError: false, refetch } as unknown as UseQueryResult<Season, Error>;
}
beforeEach(() => {
  mutateAsync.mockReset();
  invalidateQueries.mockReset();
});

describe('workspace season ending ownership', () => {
  it('checks current permission before opening the confirmation', async () => {
    const currentQuery = query(
      vi.fn(async () => ({ data: { ...season, canEnd: false }, isError: false }))
    );
    const { result } = renderHook(() => useSeasonWorkspaceEnd(scope(), currentQuery));
    await act(async () => result.current.open());
    expect(result.current.target).toBeNull();
    expect(result.current.error).toBe('stateConflict');
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('discards a permission refresh completed after a session change', async () => {
    let resolveRefresh!: (value: unknown) => void;
    let current = true;
    const currentQuery = query(
      vi.fn(
        () =>
          new Promise(resolve => {
            resolveRefresh = resolve;
          })
      ) as never
    );
    const { result, rerender } = renderHook(
      ({ version }) =>
        useSeasonWorkspaceEnd(
          scope(version, () => current),
          currentQuery
        ),
      { initialProps: { version: 0 } }
    );
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.open();
    });
    current = false;
    rerender({ version: 1 });
    await act(async () => {
      resolveRefresh({ data: season, isError: false });
      await pending;
    });
    expect(result.current.target).toBeNull();
  });

  it('sends one scoped request even if confirmation is triggered twice', async () => {
    let resolveEnd!: (value: unknown) => void;
    mutateAsync.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveEnd = resolve;
        })
    );
    const { result } = renderHook(() => useSeasonWorkspaceEnd(scope(), query()));
    await act(async () => result.current.open());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.confirm();
      void result.current.confirm();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith({ id: 's', scope: { sessionKey: 'owner', epoch: 0 } });
    await act(async () => {
      resolveEnd({ ...season, status: 'ended' });
      await pending;
    });
    expect(result.current.target).toBeNull();
  });
});
