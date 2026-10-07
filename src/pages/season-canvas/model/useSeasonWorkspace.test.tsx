import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionQueryKey, sessionMutationKey } from '@/entities/session';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useSeasonWorkspace } from './useSeasonWorkspace';
import { seasonQueryKeys } from '../api/seasons.queries';
import type { Season } from '../api/seasons.types';

const api = vi.hoisted(() => ({
  createCanvasSocket: vi.fn(),
  getSession: vi.fn(),
  getSeason: vi.fn(),
  joinSeason: vi.fn(),
}));
vi.mock('@/features/canvas-workspace/api/canvasSocket', async original => ({
  ...(await original<typeof import('@/features/canvas-workspace/api/canvasSocket')>()),
  createCanvasSocket: api.createCanvasSocket,
}));
vi.mock('@/entities/session/api/session.api', () => ({ getSession: api.getSession }));
vi.mock('../api/seasons.api', () => ({
  getSeason: api.getSeason,
  joinSeason: api.joinSeason,
  cancelSeason: vi.fn(),
  createSeason: vi.fn(),
  endSeason: vi.fn(),
}));
const id = '11111111-1111-4111-8111-111111111111';
const epoch = '00000000-0000-4000-8000-000000000001';
let season: Season;
let flag: boolean;
const session = (userId = 'u', absoluteExpiresAt = '2026-11-01T00:00:00Z') => ({
  user: { id: userId, displayName: null, avatarUrl: null, wallets: [] },
  session: { expiresAt: absoluteExpiresAt, absoluteExpiresAt },
});
let currentSession: ReturnType<typeof session> | null;
const clients: QueryClient[] = [];
const sockets: ReturnType<typeof fakeSocket>[] = [];
function fakeSocket() {
  const boundUser = currentSession?.user.id;
  const listeners = new Map<string, (payload?: unknown) => void>();
  const socket = {
    connected: false,
    active: true,
    on(event: string, callback: (payload?: unknown) => void) {
      listeners.set(event, callback);
      return socket;
    },
    connect: vi.fn(() => {
      queueMicrotask(() => {
        socket.connected = true;
        listeners.get('connect')?.();
        listeners.get('connection:ready')?.({
          protocolVersion: 1,
          canvasKey: `season:${id}`,
          presence: { connectionCount: 2 },
          viewer: boundUser
            ? { status: 'authenticated', userId: boundUser }
            : { status: 'guest', userId: null },
          canDraw: flag && Boolean(boundUser) && season.isParticipant && season.status === 'active',
          season,
          serverTime: season.startsAt,
        });
      });
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      listeners.get('disconnect')?.('io client disconnect');
      return socket;
    }),
    removeAllListeners: vi.fn(() => {
      listeners.clear();
      return socket;
    }),
    timeout() {
      return socket;
    },
    emitWithAck: vi.fn(async (event: string, _input: unknown) => {
      if (event === 'canvas:sync')
        return {
          ok: true,
          data: {
            canvasKey: `season:${id}`,
            epoch,
            reset: true,
            previews: [],
            headSequence: '0',
            nextSequence: '0',
            hasMore: false,
          },
        };
      return { ok: false, error: { code: 'SEASON_DRAWING_DISABLED', message: 'disabled' } };
    }),
    receive(event: string, value: unknown) {
      listeners.get(event)?.(value);
    },
  };
  return socket;
}
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return {
    ...renderHook(() => useSeasonWorkspace(id, defaultBrushSettings, 'live'), { wrapper }),
    client,
  };
}
beforeEach(() => {
  sockets.length = 0;
  flag = true;
  currentSession = session();
  season = {
    id,
    creatorId: 'owner',
    title: 'Season',
    description: null,
    width: 800,
    height: 600,
    capacity: 4,
    participantCount: 1,
    strokeLimitPerUser: 2,
    status: 'active',
    startsAt: '2026-10-07T00:00:00Z',
    endsAt: '2026-10-08T00:00:00Z',
    createdAt: '2026-10-07T00:00:00Z',
    forceEndedAt: null,
    cancelledAt: null,
    isCreator: false,
    isParticipant: false,
    canCancel: false,
    canEnd: false,
  };
  vi.clearAllMocks();
  api.createCanvasSocket.mockImplementation(() => {
    const socket = fakeSocket();
    sockets.push(socket);
    return socket;
  });
  api.getSession.mockImplementation(async () => currentSession);
  api.getSeason.mockImplementation(async () => ({ ...season }));
  api.joinSeason.mockImplementation(async () => {
    season = { ...season, isParticipant: true, participantCount: 2 };
    return season;
  });
});
afterEach(() => {
  clients.splice(0).forEach(client => client.clear());
});
describe('season workspace integration', () => {
  it('reconciles a first HTTP result received after a stale active ready when the end event was lost', async () => {
    season = { ...season, isParticipant: true };
    let resolve!: (value: Season) => void;
    api.getSeason.mockImplementationOnce(
      () =>
        new Promise<Season>(yes => {
          resolve = yes;
        })
    );
    const system = setup();
    await waitFor(() => expect(system.result.current.ready).not.toBeNull());
    const old = sockets[sockets.length - 1];
    season = { ...season, status: 'ended' };
    await act(async () => {
      resolve(season);
    });
    await waitFor(() => expect(system.result.current.status).toBe('ended'));
    expect(old.disconnect).toHaveBeenCalled();
    expect(system.result.current.canDraw).toBe(false);
  });
  it('joins then waits for a new ready and sync before allowing source-size drawing', async () => {
    const system = setup();
    await waitFor(() => expect(system.result.current.realtime.sync.status).toBe('ready'));
    expect(system.result.current.canDraw).toBe(false);
    expect(system.result.current.canJoin).toBe(true);
    const oldSocket = sockets[sockets.length - 1];
    await act(async () => {
      await system.result.current.join.join();
    });
    await waitFor(() => expect(system.result.current.canDraw).toBe(true));
    expect(oldSocket.disconnect).toHaveBeenCalled();
    expect(api.createCanvasSocket).toHaveBeenLastCalledWith(`season:${id}`);
    expect(system.result.current.realtime.dimensions).toEqual({ width: 800, height: 600 });
    act(() => {
      expect(system.result.current.realtime.drawingModel.startStroke(1, { x: 800, y: 300 })).toBe(
        false
      );
    });
  });
  it('re-handshakes an existing participant at scheduled start and closes drawing at end', async () => {
    season = { ...season, status: 'scheduled', isParticipant: true };
    const system = setup();
    await waitFor(() => expect(system.result.current.ready).not.toBeNull());
    expect(system.result.current.canDraw).toBe(false);
    const previous = sockets[sockets.length - 1];
    season = { ...season, status: 'active' };
    act(() =>
      previous.receive('season:state', {
        ...season,
        canvasKey: `season:${id}`,
        serverTime: season.startsAt,
        epoch,
        headSequence: '0',
      })
    );
    await waitFor(() => expect(system.result.current.canDraw).toBe(true));
    expect(previous.disconnect).toHaveBeenCalled();
    season = { ...season, status: 'ended' };
    act(() =>
      sockets[sockets.length - 1].receive('season:state', {
        ...season,
        canvasKey: `season:${id}`,
        serverTime: season.endsAt,
        epoch,
        headSequence: '0',
      })
    );
    await waitFor(() => expect(system.result.current.status).toBe('ended'));
    expect(system.result.current.canDraw).toBe(false);
    act(() =>
      expect(system.result.current.realtime.drawingModel.startStroke(1, { x: 100, y: 100 })).toBe(
        false
      )
    );
  });
  it('recovers a missed lifecycle broadcast from HTTP detail', async () => {
    season = { ...season, isParticipant: true };
    const system = setup();
    await waitFor(() => expect(system.result.current.canDraw).toBe(true));
    const previous = sockets[sockets.length - 1];
    season = { ...season, status: 'ended' };
    await act(async () => {
      await system.result.current.query.refetch();
    });
    await waitFor(() => expect(system.result.current.status).toBe('ended'));
    expect(previous.disconnect).toHaveBeenCalled();
    expect(system.result.current.canDraw).toBe(false);
  });
  it('keeps guest and flag-disabled participant viewing without allowing append', async () => {
    flag = false;
    season = { ...season, isParticipant: true };
    const system = setup();
    await waitFor(() => expect(system.result.current.realtime.sync.status).toBe('ready'));
    expect(system.result.current.canDraw).toBe(false);
    currentSession = null;
    act(() => system.client.setQueryData(sessionQueryKey, null));
    await waitFor(() => expect(system.result.current.ready?.viewer.status).toBe('guest'));
    expect(system.result.current.canDraw).toBe(false);
  });
  it('disposes the old binding during same-user session mutation and clears unknown input', async () => {
    season = { ...season, isParticipant: true };
    const system = setup();
    await waitFor(() => expect(system.result.current.canDraw).toBe(true));
    const old = sockets[sockets.length - 1];
    old.emitWithAck.mockImplementation((event: string, _input: unknown) =>
      event === 'stroke:append'
        ? new Promise(() => {})
        : Promise.resolve({
            ok: true,
            data: {
              canvasKey: `season:${id}`,
              epoch,
              reset: true,
              previews: [],
              headSequence: '0',
              nextSequence: '0',
              hasMore: false,
            },
          })
    );
    act(() =>
      expect(system.result.current.realtime.drawingModel.startStroke(1, { x: 100, y: 100 })).toBe(
        true
      )
    );
    let finish!: () => void;
    const mutation = system.client.getMutationCache().build(system.client, {
      mutationKey: sessionMutationKey,
      mutationFn: () =>
        new Promise<void>(resolve => {
          finish = resolve;
        }),
    });
    let pending!: Promise<void>;
    act(() => {
      pending = mutation.execute(undefined);
    });
    await waitFor(() => expect(system.result.current.scope.isChangingSession).toBe(true));
    expect(old.disconnect).toHaveBeenCalled();
    await act(async () => {
      finish();
      await pending;
    });
    await waitFor(() => expect(system.result.current.canDraw).toBe(true));
    expect(system.result.current.realtime.sync.optimisticStrokes).toEqual([]);
    expect(
      sockets[sockets.length - 1].emitWithAck.mock.calls.filter(
        ([event]) => event === 'stroke:append'
      )
    ).toHaveLength(0);
    expect(
      system.client.getQueryData(
        seasonQueryKeys.detail(system.result.current.scope.sessionKey!, id)
      )
    ).toBeDefined();
  });
});
