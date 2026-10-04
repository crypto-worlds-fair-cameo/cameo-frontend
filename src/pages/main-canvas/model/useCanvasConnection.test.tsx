import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasConnection } from './useCanvasConnection';

const { createCanvasSocket, useSessionQuery } = vi.hoisted(() => ({
  createCanvasSocket: vi.fn(),
  useSessionQuery: vi.fn(),
}));
vi.mock('@/entities/session', () => ({ useSessionQuery }));
vi.mock('../api/canvasSocket', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/canvasSocket')>()),
  createCanvasSocket,
}));

/** 훅과 실제 연결 컨트롤러를 함께 검사할 수 있는 이벤트 transport를 만든다. */
function fakeSocket() {
  type Listener = (...args: unknown[]) => void;
  const listeners = new Map<string, Listener>();
  const socket = {
    connected: false,
    alive: false,
    on: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, listener);
      return socket;
    }),
    removeAllListeners: vi.fn(() => listeners.clear()),
    connect: vi.fn(() => {
      socket.alive = true;
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.alive = false;
      socket.connected = false;
      listeners.get('disconnect')?.('io client disconnect');
      return socket;
    }),
    receive(event: string, payload?: unknown) {
      // 서버 connect가 transport 상태를 먼저 바꾸고 준비 응답을 기다리게 한다.
      if (event === 'connect') socket.connected = true;
      listeners.get(event)?.(payload);
    },
    listeners,
  };
  return socket;
}

const ready = {
  protocolVersion: 1,
  canvasKey: 'main',
  viewer: { status: 'guest', userId: null },
  canDraw: false,
  presence: { connectionCount: 1 },
};

/** 사용자와 절대 만료 기한을 고정하고 갱신 가능한 만료 기한을 별도로 제공한다. */
function session(id = 'user-1', absoluteExpiresAt = 'tomorrow', expiresAt = 'tonight') {
  return { user: { id }, session: { absoluteExpiresAt, expiresAt } };
}

let sockets: ReturnType<typeof fakeSocket>[];
beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  createCanvasSocket.mockReset();
  createCanvasSocket.mockImplementation(() => {
    const socket = fakeSocket();
    sockets.push(socket);
    return socket;
  });
  useSessionQuery.mockReturnValue({ data: undefined });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('canvas connection hook ownership', () => {
  it('keeps one alive socket after StrictMode setup, cleanup and setup', () => {
    const onInterrupted = vi.fn();
    const { unmount } = renderHook(() => useCanvasConnection({ onInterrupted }), {
      reactStrictMode: true,
    });
    expect(sockets).toHaveLength(2);
    expect(sockets.filter(socket => socket.alive)).toHaveLength(1);
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sockets[0].listeners.size).toBe(0);
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(sockets.filter(socket => socket.alive)).toHaveLength(0);
    expect(sockets[1].disconnect).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses latest handler identities without reopening the socket', () => {
    const first = { onReady: vi.fn(), onPreview: vi.fn(), onInterrupted: vi.fn() };
    const latest = { onReady: vi.fn(), onPreview: vi.fn(), onInterrupted: vi.fn() };
    const { rerender, unmount } = renderHook(handlers => useCanvasConnection(handlers), {
      initialProps: first,
    });
    rerender(latest);
    expect(sockets).toHaveLength(1);
    act(() => {
      sockets[0].receive('connect');
      sockets[0].receive('connection:ready', ready);
      sockets[0].receive('stroke:preview', { stroke: 'one' });
    });
    expect(first.onReady).not.toHaveBeenCalled();
    expect(first.onPreview).not.toHaveBeenCalled();
    expect(latest.onReady).toHaveBeenCalledWith(sockets[0], ready);
    expect(latest.onPreview).toHaveBeenCalledWith({ stroke: 'one' });
    unmount();
    expect(first.onInterrupted).not.toHaveBeenCalled();
    expect(latest.onInterrupted).toHaveBeenCalledTimes(1);
  });

  it.each([null, session()])('keeps initial session hydration on the first socket: %j', data => {
    const { rerender, unmount } = renderHook(() => useCanvasConnection());
    useSessionQuery.mockReturnValue({ data });
    rerender();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].disconnect).not.toHaveBeenCalled();
    unmount();
  });

  it('reopens with the login cookie after the initial session request fails', () => {
    const { rerender, unmount } = renderHook(() => useCanvasConnection());
    act(() => {
      sockets[0].receive('connect');
      sockets[0].receive('connection:ready', ready);
    });
    useSessionQuery.mockReturnValue({ data: undefined, isError: true });
    rerender();

    useSessionQuery.mockReturnValue({ data: session(), isError: false });
    rerender();

    expect(sockets).toHaveLength(2);
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sockets[0].listeners.size).toBe(0);
    expect(sockets[1].alive).toBe(true);
    unmount();
  });

  it('reopens on login, user change, absolute expiration change and logout', () => {
    useSessionQuery.mockReturnValue({ data: null });
    const { rerender, unmount } = renderHook(() => useCanvasConnection());
    const nextSessions = [session(), session('user-2'), session('user-2', 'next-week'), null];
    for (const data of nextSessions) {
      useSessionQuery.mockReturnValue({ data });
      rerender();
    }
    expect(sockets).toHaveLength(5);
    expect(sockets.filter(socket => socket.alive)).toHaveLength(1);
    expect(sockets.slice(0, 4).every(socket => socket.disconnect.mock.calls.length === 1)).toBe(
      true
    );
    expect(sockets.slice(0, 4).every(socket => socket.listeners.size === 0)).toBe(true);
    unmount();
  });

  it('recognizes a new login session for the same user after initial hydration', () => {
    const { rerender, unmount } = renderHook(() => useCanvasConnection());
    useSessionQuery.mockReturnValue({ data: session() });
    rerender();
    expect(sockets).toHaveLength(1);
    useSessionQuery.mockReturnValue({ data: session('user-1', 'tomorrow', 'later') });
    rerender();
    expect(sockets).toHaveLength(1);
    useSessionQuery.mockReturnValue({ data: session('user-1', 'next-week') });
    rerender();
    expect(sockets).toHaveLength(2);
    expect(sockets[0].listeners.size).toBe(0);
    unmount();
  });

  it('ignores ready callbacks retained from a disposed session', () => {
    const onReady = vi.fn();
    useSessionQuery.mockReturnValue({ data: null });
    const { result, rerender, unmount } = renderHook(() => useCanvasConnection({ onReady }));
    act(() => sockets[0].receive('connect'));
    const staleReady = sockets[0].listeners.get('connection:ready')!;
    useSessionQuery.mockReturnValue({ data: session() });
    rerender();
    act(() => staleReady(ready));
    expect(onReady).not.toHaveBeenCalled();
    expect(result.current.connection.status).toBe('connecting');
    unmount();
  });
});
