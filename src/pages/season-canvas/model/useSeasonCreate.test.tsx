import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeasonCreate } from './useSeasonCreate';
import { SeasonRequestError } from '../api/seasons.types';

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

beforeEach(() => {
  mutateAsync.mockReset();
  invalidateQueries.mockReset();
});

async function setup() {
  const token = { sessionKey: 'user', epoch: 1 };
  const onCreated = vi.fn();
  const onCheckList = vi.fn();
  const hook = renderHook(
    ({ version }) =>
      useSeasonCreate(
        {
          resetVersion: version,
          captureScope: () => token,
          isCurrentScope: scope => scope === token,
        },
        onCreated,
        onCheckList
      ),
    { initialProps: { version: 0 } }
  );
  await act(async () => {});
  const openForm = () => {
    act(() => {
      hook.result.current.openDialog();
      hook.result.current.updateDraft('title', 'new season');
    });
  };
  return { ...hook, onCreated, onCheckList, openForm };
}

describe('season create request ownership', () => {
  it('sends one request for two synchronous submits before pending rerender', async () => {
    let resolveRequest!: (value: { id: string }) => void;
    mutateAsync.mockImplementation(() => new Promise(resolve => (resolveRequest = resolve)));
    const system = await setup();
    system.openForm();
    act(() => {
      void system.result.current.submit();
      void system.result.current.submit();
    });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    act(() => system.result.current.closeDialog());
    expect(system.result.current.open).toBe(true);
    await act(async () => resolveRequest({ id: 'season-1' }));
    expect(system.onCreated).toHaveBeenCalledExactlyOnceWith('season-1');
    expect(system.result.current.createdId).toBe('season-1');
  });

  it('invalidates the current session list when checking an ambiguous result', async () => {
    const system = await setup();
    act(() => system.result.current.checkList());
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['season-canvas', 'user', 'list'],
    });
    expect(system.onCheckList).toHaveBeenCalledTimes(1);
  });

  it('ignores a late success after the session reset', async () => {
    let resolveRequest!: (value: { id: string }) => void;
    mutateAsync.mockImplementationOnce(() => new Promise(resolve => (resolveRequest = resolve)));
    const system = await setup();
    system.openForm();
    let request!: Promise<void>;
    act(() => {
      request = system.result.current.submit();
    });
    system.rerender({ version: 1 });
    await act(async () => {
      resolveRequest({ id: 'old-season' });
      await request;
    });
    expect(system.result.current.createdId).toBeNull();
    expect(system.result.current.open).toBe(false);
    expect(system.onCreated).not.toHaveBeenCalled();
  });

  it('does not notify the page when the request finishes after unmount', async () => {
    let resolveRequest!: (value: { id: string }) => void;
    mutateAsync.mockImplementationOnce(() => new Promise(resolve => (resolveRequest = resolve)));
    const system = await setup();
    system.openForm();
    let request!: Promise<void>;
    act(() => {
      request = system.result.current.submit();
    });
    system.unmount();
    await act(async () => {
      resolveRequest({ id: 'old-season' });
      await request;
    });
    expect(system.onCreated).not.toHaveBeenCalled();
  });
});

describe('season created notice', () => {
  it('closes the form on confirmed success and dismisses the notice without another request', async () => {
    mutateAsync.mockResolvedValueOnce({ id: 'season-1' });
    const system = await setup();
    system.openForm();
    await act(async () => system.result.current.submit());
    expect(system.result.current.open).toBe(false);
    expect(system.result.current.createdId).toBe('season-1');
    expect(system.onCreated).toHaveBeenCalledExactlyOnceWith('season-1');
    act(() => system.result.current.closeCreatedNotice());
    expect(system.result.current.createdId).toBeNull();
    expect(system.result.current.open).toBe(false);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('clears the previous success when opening a fresh form', async () => {
    mutateAsync.mockResolvedValueOnce({ id: 'season-1' });
    const system = await setup();
    system.openForm();
    await act(async () => system.result.current.submit());
    act(() => system.result.current.openDialog());
    expect(system.result.current.createdId).toBeNull();
    expect(system.result.current.open).toBe(true);
    expect(system.result.current.draft.title).toBe('');
  });

  it('hides the completed notice as soon as the session version changes', async () => {
    mutateAsync.mockResolvedValueOnce({ id: 'season-1' });
    const system = await setup();
    system.openForm();
    await act(async () => system.result.current.submit());
    expect(system.result.current.createdId).toBe('season-1');
    system.rerender({ version: 1 });
    expect(system.result.current.createdId).toBeNull();
    await act(async () => {});
    expect(system.result.current.draft.title).toBe('');
  });

  it('shows success only after an acknowledged retry of an ambiguous failure', async () => {
    mutateAsync.mockRejectedValueOnce(new SeasonRequestError('timeout', 'transport'));
    const system = await setup();
    system.openForm();
    await act(async () => system.result.current.submit());
    expect(system.result.current.open).toBe(true);
    expect(system.result.current.createdId).toBeNull();
    expect(system.result.current.ambiguous).toBe(true);
    expect(system.onCreated).not.toHaveBeenCalled();
    await act(async () => system.result.current.submit());
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    act(() => system.result.current.setRetryAcknowledged(true));
    mutateAsync.mockResolvedValueOnce({ id: 'season-1' });
    await act(async () => system.result.current.submit());
    expect(system.result.current.createdId).toBe('season-1');
    expect(system.result.current.ambiguous).toBe(false);
    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });
});
