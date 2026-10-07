import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { seasonQueryKeys } from '../api/seasons.queries';
import { useSeasonSessionScope } from './useSeasonSessionScope';

const sessionState = vi.hoisted(() => ({
  data: undefined as
    | null
    | {
        user: { id: string };
        session: { absoluteExpiresAt: string };
      }
    | undefined,
  isSuccess: false,
  isChanging: false,
}));

vi.mock('@/entities/session', () => ({
  sessionMutationKey: ['auth', 'session-change'],
  useSessionQuery: () => ({ data: sessionState.data, isSuccess: sessionState.isSuccess }),
}));

vi.mock('@tanstack/react-query', async importOriginal => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useIsMutating: () => (sessionState.isChanging ? 1 : 0),
}));

function session(id: string, absoluteExpiresAt = '2026-11-01T00:00:00.000Z') {
  return { user: { id }, session: { absoluteExpiresAt } };
}

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  sessionState.data = undefined;
  sessionState.isSuccess = false;
  sessionState.isChanging = false;
});

describe('useSeasonSessionScope', () => {
  it('removes old account caches across account switch and logout', async () => {
    const client = new QueryClient();
    sessionState.data = session('account-a');
    sessionState.isSuccess = true;
    const { result, rerender } = renderHook(() => useSeasonSessionScope(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.sessionKey).toContain('account-a'));
    const accountAKey = result.current.sessionKey!;
    client.setQueryData(seasonQueryKeys.detail(accountAKey, 'season-a'), { owner: 'a' });

    sessionState.data = session('account-b');
    rerender();
    await waitFor(() =>
      expect(client.getQueryData(seasonQueryKeys.detail(accountAKey, 'season-a'))).toBeUndefined()
    );
    const accountBKey = result.current.sessionKey!;
    client.setQueryData(seasonQueryKeys.detail(accountBKey, 'season-b'), { owner: 'b' });

    sessionState.data = null;
    rerender();
    await waitFor(() =>
      expect(client.getQueryData(seasonQueryKeys.detail(accountBKey, 'season-b'))).toBeUndefined()
    );
    expect(result.current.sessionKey).toBe('guest');
  });

  it('cancels season requests when session mutation starts and revalidates same account after it finishes', async () => {
    const client = new QueryClient();
    const cancelQueries = vi.spyOn(client, 'cancelQueries');
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
    sessionState.data = session('account-a');
    sessionState.isSuccess = true;
    const { rerender, result } = renderHook(() => useSeasonSessionScope(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    const accountKey = result.current.sessionKey!;

    sessionState.isChanging = true;
    rerender();
    await waitFor(() =>
      expect(cancelQueries).toHaveBeenCalledWith({ queryKey: seasonQueryKeys.root })
    );
    expect(result.current.isReady).toBe(false);

    sessionState.isChanging = false;
    rerender();
    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: seasonQueryKeys.session(accountKey),
      })
    );
  });

  it('treats a new absolute session expiry for same account as a new cache owner', async () => {
    const client = new QueryClient();
    sessionState.data = session('account-a', '2026-11-01T00:00:00.000Z');
    sessionState.isSuccess = true;
    const { result, rerender } = renderHook(() => useSeasonSessionScope(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    const firstScope = result.current.captureScope()!;
    const oldDetailKey = seasonQueryKeys.detail(firstScope.sessionKey, 'season-1');
    client.setQueryData(oldDetailKey, { title: 'First login' });

    sessionState.data = session('account-a', '2026-12-01T00:00:00.000Z');
    rerender();

    await waitFor(() => expect(client.getQueryData(oldDetailKey)).toBeUndefined());
    expect(result.current.sessionKey).not.toBe(firstScope.sessionKey);
    expect(result.current.isCurrentScope(firstScope)).toBe(false);
  });

  it('invalidates captured scopes after unmount', async () => {
    const client = new QueryClient();
    sessionState.data = session('account-a');
    sessionState.isSuccess = true;
    const { result, unmount } = renderHook(() => useSeasonSessionScope(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isReady).toBe(true));
    const scope = result.current.captureScope();
    expect(scope).not.toBeNull();

    unmount();

    expect(result.current.isCurrentScope(scope!)).toBe(false);
  });
});
