import type { PropsWithChildren } from 'react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeasonsQuery } from './seasons.queries';

const api = vi.hoisted(() => ({ listSeasons: vi.fn() }));

vi.mock('./seasons.api', () => ({
  getSeason: vi.fn(),
  listSeasons: api.listSeasons,
}));

let visibility: DocumentVisibilityState = 'visible';

function wrapper(client: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function flushQueries() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  api.listSeasons.mockResolvedValue({ items: [], page: 1, limit: 20, hasNext: false });
});

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

describe('season list query refresh policy', () => {
  it('polls every 30 seconds while the document is visible', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    renderHook(() => useSeasonsQuery('account-a', { page: 1, limit: 20 }, true), {
      wrapper: wrapper(client),
    });
    await flushQueries();
    expect(api.listSeasons).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(api.listSeasons).toHaveBeenCalledTimes(2);
  });

  it('does not schedule polling while the document is hidden', async () => {
    visibility = 'hidden';
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    renderHook(() => useSeasonsQuery('account-a', { page: 1, limit: 20 }, true), {
      wrapper: wrapper(client),
    });
    await flushQueries();
    expect(api.listSeasons).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(api.listSeasons).toHaveBeenCalledTimes(1);
  });

  it('refreshes stale data when focus returns after the document becomes visible', async () => {
    visibility = 'hidden';
    focusManager.setFocused(false);
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    renderHook(() => useSeasonsQuery('account-a', { page: 1, limit: 20 }, true), {
      wrapper: wrapper(client),
    });
    await flushQueries();
    expect(api.listSeasons).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    visibility = 'visible';
    await act(async () => {
      focusManager.setFocused(true);
      await Promise.resolve();
    });

    expect(api.listSeasons).toHaveBeenCalledTimes(2);
  });
});
