import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSocket } from '../api/canvasSocket';
import { openCanvasConnection, type CanvasConnectionState } from './canvasConnection';
import { useCanvasConnection } from './useCanvasConnection';

const { createCanvasSocket } = vi.hoisted(() => ({ createCanvasSocket: vi.fn() }));
vi.mock('../api/canvasSocket', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/canvasSocket')>()),
  createCanvasSocket,
}));

// 실제 네트워크 대신 서버 이벤트와 Socket.IO의 active 상태를 제어한다.
function fakeSocket() {
  type Listener = (...args: unknown[]) => void;
  const listeners = new Map<string, Listener>();
  const managerListeners = new Map<string, Listener>();
  const socket = {
    connected: false,
    active: false,
    on: vi.fn((event: string, listener: Listener) => {
      listeners.set(event, listener);
      return socket;
    }),
    removeAllListeners: vi.fn(() => listeners.clear()),
    connect: vi.fn(() => {
      socket.active = true;
      return socket;
    }),
    disconnect: vi.fn(() => {
      socket.connected = false;
      socket.active = false;
      listeners.get('disconnect')?.('io client disconnect');
      return socket;
    }),
    io: {
      reconnection: vi.fn(),
      on: vi.fn((event: string, listener: Listener) => managerListeners.set(event, listener)),
      off: vi.fn((event: string) => managerListeners.delete(event)),
    },
    receive(event: string, payload?: unknown) {
      if (event === 'connect') socket.connected = true;
      if (event === 'disconnect') {
        socket.connected = false;
        socket.active = payload !== 'io server disconnect';
      }
      listeners.get(event)?.(payload);
    },
    managerReceive(event: string) {
      managerListeners.get(event)?.();
    },
    listeners,
    managerListeners,
  };
  return socket;
}

const ready = {
  protocolVersion: 1,
  canvasKey: 'main',
  viewer: { status: 'guest', userId: null },
  canDraw: false,
  presence: { connectionCount: 2 },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  createCanvasSocket.mockReset();
});
afterEach(() => vi.useRealTimers());

function setup() {
  const socket = fakeSocket();
  createCanvasSocket.mockReturnValue(socket as unknown as CanvasSocket);
  let state: CanvasConnectionState;
  const connection = openCanvasConnection(value => {
    state = value;
  });
  return { socket, connection, state: () => state! };
}

describe('canvas connection lifecycle', () => {
  it('registers listeners before connecting and accepts presence only after ready', () => {
    const { socket, connection, state } = setup();
    const registered = socket.on.mock.invocationCallOrder;
    expect(registered[registered.length - 1]).toBeLessThan(
      socket.connect.mock.invocationCallOrder[0]
    );
    socket.receive('connect');
    socket.receive('canvas:presence', { canvasKey: 'main', connectionCount: 99 });
    expect(state().status).toBe('connecting');
    expect(state().connectionCount).toBeNull();
    socket.receive('connection:ready', ready);
    expect(state()).toMatchObject({ status: 'ready', connectionCount: 2 });
    socket.receive('canvas:presence', { canvasKey: 'main', connectionCount: 3 });
    expect(state().connectionCount).toBe(3);
    connection.dispose();
  });

  it('leaves network retries to Socket.IO without starting a second timer', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    socket.receive('disconnect', 'transport close');
    expect(state()).toMatchObject({ status: 'reconnecting', connectionCount: null });
    vi.advanceTimersByTime(9000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    expect(state().status).toBe('ready');
    connection.dispose();
  });

  it('waits for actual disconnect and respects the server retry delay', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    socket.receive('connection:reset', {
      reason: 'server_shutdown',
      retryable: true,
      retryAfterMs: 4000,
    });
    expect(state()).toMatchObject({ status: 'reconnecting', notice: 'server_shutdown' });
    socket.receive('canvas:presence', { canvasKey: 'main', connectionCount: 50 });
    expect(state().connectionCount).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.receive('disconnect', 'io server disconnect');
    vi.advanceTimersByTime(3999);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it('honors a reset delay even when transport close would normally start automatic recovery', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    socket.receive('connection:reset', {
      reason: 'server_shutdown',
      retryable: true,
      retryAfterMs: 6000,
    });
    expect(socket.io.reconnection).toHaveBeenLastCalledWith(false);
    socket.receive('disconnect', 'transport close');
    expect(socket.active).toBe(false);
    vi.advanceTimersByTime(5999);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    expect(state().status).toBe('reconnecting');
    connection.dispose();
  });

  it('stops all automatic retries when the reset is not retryable', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    socket.receive('connection:reset', {
      reason: 'connection_policy',
      retryable: false,
      retryAfterMs: 0,
    });
    expect(socket.io.reconnection).toHaveBeenLastCalledWith(false);
    expect(socket.disconnect).not.toHaveBeenCalled();
    socket.receive('disconnect', 'transport close');
    vi.advanceTimersByTime(60_000);
    expect(state()).toMatchObject({ status: 'failed', notice: 'connection_policy' });
    expect(socket.connect).toHaveBeenCalledTimes(1);
    connection.dispose();
  });

  it('spreads retry times without going below the server minimum delay', () => {
    vi.mocked(Math.random).mockReturnValue(0.5);
    const { socket, connection } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    socket.receive('connection:reset', {
      reason: 'server_shutdown',
      retryable: true,
      retryAfterMs: 4000,
    });
    socket.receive('disconnect', 'io server disconnect');
    vi.advanceTimersByTime(4000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(499);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it('uses delayed retry for a retryable middleware error and stops on explicit denial', () => {
    const { socket, connection, state } = setup();
    socket.active = false;
    socket.receive('connect_error', { data: { retryable: true, retryAfterMs: 3000 } });
    vi.advanceTimersByTime(2999);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    socket.active = false;
    socket.receive('connect_error', { data: { retryable: false, retryAfterMs: 0 } });
    expect(state().status).toBe('failed');
    vi.advanceTimersByTime(60_000);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.retry();
    expect(socket.connect).toHaveBeenCalledTimes(3);
    connection.dispose();
  });

  it('limits repeated namespace errors to the initial attempt plus three retries', () => {
    const { socket, connection, state } = setup();
    for (const delay of [1000, 2000, 4000]) {
      socket.active = false;
      socket.receive('connect_error', new Error('Denied'));
      vi.advanceTimersByTime(delay);
    }
    socket.active = false;
    socket.receive('connect_error', new Error('Denied'));
    expect(socket.connect).toHaveBeenCalledTimes(4);
    expect(state()).toMatchObject({ status: 'failed', notice: 'retry_limit', retryCount: 3 });
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(socket.connect).toHaveBeenCalledTimes(4);
    connection.retry();
    expect(socket.connect).toHaveBeenCalledTimes(5);
    expect(state()).toMatchObject({ status: 'connecting', retryCount: 0 });
    connection.dispose();
  });

  it('shares the retry budget between Manager retries and page-owned retries', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect_error', new Error('Network error'));
    socket.managerReceive('reconnect_attempt');
    expect(state().retryCount).toBe(1);
    socket.active = false;
    socket.receive('connect_error', { data: { retryable: true, retryAfterMs: 0 } });
    vi.advanceTimersByTime(2000);
    expect(state().retryCount).toBe(2);
    socket.receive('connect_error', new Error('Network error'));
    socket.managerReceive('reconnect_attempt');
    expect(state().retryCount).toBe(3);
    socket.receive('connect_error', new Error('Network error'));
    expect(state()).toMatchObject({ status: 'failed', notice: 'retry_limit' });
    socket.managerReceive('reconnect_attempt');
    expect(state().status).toBe('failed');
    expect(vi.getTimerCount()).toBe(0);
    connection.dispose();
  });

  it('times out the full attempt when the namespace never acknowledges the connection', () => {
    const { socket, connection, state } = setup();
    for (const retryDelay of [1000, 2000, 4000]) {
      vi.advanceTimersByTime(10_000);
      expect(state().notice).toBe('attempt_timeout');
      vi.advanceTimersByTime(retryDelay);
    }
    vi.advanceTimersByTime(10_000);
    expect(socket.connect).toHaveBeenCalledTimes(4);
    expect(state()).toMatchObject({ status: 'failed', notice: 'retry_limit' });
    expect(vi.getTimerCount()).toBe(0);
    connection.dispose();
  });

  it('does not restart the overall deadline after namespace connect', () => {
    const { socket, connection, state } = setup();
    vi.advanceTimersByTime(9000);
    socket.receive('connect');
    vi.advanceTimersByTime(1000);
    expect(state().notice).toBe('attempt_timeout');
    expect(socket.disconnect).toHaveBeenCalled();
    connection.dispose();
  });

  it.each([true, false])(
    'bounds reset waiting without a server disconnect: retryable=%s',
    retryable => {
      const { socket, connection, state } = setup();
      socket.receive('connect');
      socket.receive('connection:ready', ready);
      socket.receive('connection:reset', {
        reason: retryable ? 'server_shutdown' : 'connection_policy',
        retryable,
        retryAfterMs: 2000,
      });
      vi.advanceTimersByTime(4999);
      expect(socket.disconnect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(socket.connected).toBe(false);
      if (retryable) {
        expect(state().notice).toBe('reset_timeout');
        vi.advanceTimersByTime(1999);
        expect(socket.connect).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(1);
        expect(socket.connect).toHaveBeenCalledTimes(2);
      } else {
        expect(state()).toMatchObject({ status: 'failed', notice: 'connection_policy' });
        expect(vi.getTimerCount()).toBe(0);
      }
      connection.dispose();
    }
  );

  it('resets the shared retry count only after application ready', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect_error', new Error('Network error'));
    socket.managerReceive('reconnect_attempt');
    socket.receive('connect');
    expect(state().retryCount).toBe(1);
    socket.receive('connection:ready', ready);
    expect(state().retryCount).toBe(0);
    socket.receive('disconnect', 'transport close');
    socket.managerReceive('reconnect_attempt');
    expect(state().retryCount).toBe(1);
    connection.dispose();
  });

  it('stops immediately for a Socket.IO protocol compatibility error even if active is true', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect_error', new Error('Socket.IO server and client are not compatible'));
    expect(state()).toMatchObject({ status: 'failed', notice: 'protocol_error' });
    expect(socket.active).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    connection.dispose();
  });

  it('preserves jitter even when the server minimum delay exceeds ten seconds', () => {
    vi.mocked(Math.random).mockReturnValue(0.5);
    const { socket, connection } = setup();
    socket.active = false;
    socket.receive('connect_error', { data: { retryable: true, retryAfterMs: 10_000 } });
    vi.advanceTimersByTime(10_499);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it('cleans up an unready transport before retrying after the ready timeout', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    vi.advanceTimersByTime(5000);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ status: 'reconnecting', notice: 'ready_timeout' });
    vi.advanceTimersByTime(1000);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    vi.advanceTimersByTime(10_000);
    expect(state().status).toBe('ready');
    connection.dispose();
  });

  it('rejects an incompatible ready payload without retrying', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', { ...ready, protocolVersion: 2 });
    expect(state()).toMatchObject({ status: 'failed', notice: 'protocol_error' });
    vi.advanceTimersByTime(60_000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    connection.dispose();
  });

  it('removes listeners and pending retries on disposal', () => {
    const { socket, connection, state } = setup();
    socket.active = false;
    socket.receive('connect_error', { data: { retryable: true, retryAfterMs: 3000 } });
    const previous = state();
    connection.dispose();
    expect(socket.listeners.size).toBe(0);
    expect(socket.managerListeners.size).toBe(0);
    vi.advanceTimersByTime(30_000);
    socket.receive('connection:ready', ready);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(state()).toBe(previous);
  });

  it('does not recreate the socket on render and cleans up before remounting', () => {
    const sockets: ReturnType<typeof fakeSocket>[] = [];
    createCanvasSocket.mockImplementation(() => {
      const socket = fakeSocket();
      sockets.push(socket);
      return socket;
    });
    const { rerender, unmount } = renderHook(() => useCanvasConnection());
    expect(sockets).toHaveLength(1);
    expect(sockets[0].active).toBe(true);
    rerender();
    expect(sockets).toHaveLength(1);
    unmount();
    expect(sockets[0].disconnect).toHaveBeenCalledTimes(1);
    expect(sockets[0].listeners.size).toBe(0);
    const remounted = renderHook(() => useCanvasConnection());
    expect(sockets).toHaveLength(2);
    expect(sockets[1].active).toBe(true);
    remounted.unmount();
    expect(sockets[1].disconnect).toHaveBeenCalledTimes(1);
    expect(sockets[1].listeners.size).toBe(0);
  });
});
