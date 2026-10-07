import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSeasonCreate } from './useSeasonCreate';

const { mutateAsync, invalidateQueries } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  invalidateQueries: vi.fn(),
}));
vi.mock('../api/seasons.mutations', () => ({
  useCreateSeasonMutation: () => ({ mutateAsync, isPending: false }),
}));
vi.mock('@tanstack/react-query', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQueryClient: () => ({ invalidateQueries }),
}));

describe('season create request ownership', () => {
  it('sends one request for two synchronous submits before pending rerender', async () => {
    let resolveRequest!: (value: { id: string }) => void;
    mutateAsync.mockReset();
    mutateAsync.mockImplementation(() => new Promise(resolve => (resolveRequest = resolve)));
    const token = { sessionKey: 'guest', epoch: 1 };
    const onCreated = vi.fn();
    const { result } = renderHook(() =>
      useSeasonCreate(
        {
          resetVersion: 0,
          captureScope: () => token,
          isCurrentScope: scope => scope === token,
        },
        onCreated,
        vi.fn()
      )
    );
    await act(async () => {});
    act(() => result.current.updateDraft('title', 'one request'));
    act(() => {
      void result.current.submit();
      void result.current.submit();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    await act(async () => resolveRequest({ id: 'season-1' }));
    expect(onCreated).toHaveBeenCalledWith('season-1');
  });

  it('invalidates the current session list when checking an ambiguous result', async () => {
    invalidateQueries.mockReset();
    const token = { sessionKey: 'user', epoch: 2 };
    const onCheckList = vi.fn();
    const { result } = renderHook(() =>
      useSeasonCreate(
        {
          resetVersion: 0,
          captureScope: () => token,
          isCurrentScope: () => true,
        },
        vi.fn(),
        onCheckList
      )
    );
    await act(async () => {});
    act(() => result.current.checkList());
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['season-canvas', 'user', 'list'],
    });
    expect(onCheckList).toHaveBeenCalledTimes(1);
  });
});
