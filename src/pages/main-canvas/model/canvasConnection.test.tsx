import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSocket } from '../api/canvasSocket';
import {
  openCanvasConnection,
  type CanvasConnectionHandlers,
  type CanvasConnectionState,
} from './canvasConnection';

const { createCanvasSocket } = vi.hoisted(() => ({ createCanvasSocket: vi.fn() }));
vi.mock('../api/canvasSocket', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/canvasSocket')>()),
  createCanvasSocket,
}));

// 서버 이벤트와 로컬 disconnect를 재현하며 실제 Manager 재접속은 사용하지 않는다.
function fakeSocket() {
  type Listener = (...args: unknown[]) => void;
  const listeners = new Map<string, Listener>();
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
    receive(event: string, payload?: unknown) {
      // connect/disconnect가 먼저 transport 상태를 바꾼 뒤 등록된 콜백을 실행한다.
      if (event === 'connect') socket.connected = true;
      if (event === 'disconnect') socket.connected = false;
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
  presence: { connectionCount: 2 },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  createCanvasSocket.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** 현재 상태를 읽을 수 있는 독립 연결과 가짜 서버를 만든다. */
function setup(handlers: CanvasConnectionHandlers = {}) {
  const socket = fakeSocket();
  createCanvasSocket.mockReturnValue(socket as unknown as CanvasSocket);
  let state: CanvasConnectionState;
  const connection = openCanvasConnection(value => {
    state = value;
  }, handlers);
  return { socket, connection, state: () => state! };
}

describe('canvas connection lifecycle', () => {
  it('registers preview before connect and applies identity and presence only after ready', () => {
    const onReady = vi.fn();
    const onPreview = vi.fn();
    const { socket, connection, state } = setup({ onReady, onPreview });
    expect(socket.on.mock.calls.map(([event]) => event)).toContain('stroke:preview');
    const registrations = socket.on.mock.invocationCallOrder;
    expect(registrations[registrations.length - 1]).toBeLessThan(
      socket.connect.mock.invocationCallOrder[0]
    );
    socket.receive('connect');
    socket.receive('canvas:presence', { canvasKey: 'main', connectionCount: 99 });
    socket.receive('stroke:preview', { early: true });
    expect(state()).toMatchObject({
      status: 'initializing',
      connectionCount: null,
      canDraw: false,
    });
    expect(onPreview).not.toHaveBeenCalled();
    const authenticated = {
      ...ready,
      viewer: { status: 'authenticated', userId: 'user-1' },
      canDraw: true,
    };
    socket.receive('connection:ready', authenticated);
    expect(state()).toMatchObject({
      status: 'ready',
      connectionCount: 2,
      viewer: authenticated.viewer,
      canDraw: true,
    });
    expect(onReady).toHaveBeenCalledWith(socket, authenticated);
    socket.receive('canvas:presence', { canvasKey: 'main', connectionCount: 3 });
    socket.receive('stroke:preview', { stroke: 'one' });
    expect(state().connectionCount).toBe(3);
    expect(onPreview).toHaveBeenCalledWith({ stroke: 'one' });
    connection.dispose();
  });

  it('owns indefinite network retries with capped exponential delays', () => {
    const { socket, connection, state } = setup();
    for (const delay of [1000, 2000, 4000, 8000, 8000, 8000]) {
      socket.receive('connect_error', new Error('Network error'));
      expect(state().status).toBe('reconnecting');
      const previousAttempts = socket.connect.mock.calls.length;
      vi.advanceTimersByTime(delay - 1);
      expect(socket.connect).toHaveBeenCalledTimes(previousAttempts);
      vi.advanceTimersByTime(1);
      expect(socket.connect).toHaveBeenCalledTimes(previousAttempts + 1);
    }
    expect(state().retryCount).toBe(6);
    expect(state().status).not.toBe('failed');
    connection.dispose();
  });

  it('closes reset immediately and honors the server minimum delay', () => {
    const onInterrupted = vi.fn();
    const { socket, connection, state } = setup({ onInterrupted });
    socket.receive('connect');
    socket.receive('connection:ready', ready);
    socket.receive('connection:reset', {
      reason: 'server_shutdown',
      retryable: true,
      retryAfterMs: 4000,
    });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({
      status: 'reconnecting',
      notice: 'server_shutdown',
      viewer: null,
      canDraw: false,
      transportConnected: false,
    });
    vi.advanceTimersByTime(3999);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it('stops an inactive middleware refusal unless the server explicitly permits retry', () => {
    const denied = setup();
    denied.socket.active = false;
    denied.socket.receive('connect_error', new Error('Connection refused'));
    expect(denied.state()).toMatchObject({ status: 'failed', notice: 'connection_policy' });
    expect(vi.getTimerCount()).toBe(0);
    denied.connection.dispose();
    const retryable = setup();
    retryable.socket.active = false;
    retryable.socket.receive('connect_error', { data: { retryable: true } });
    vi.advanceTimersByTime(1000);
    expect(retryable.socket.connect).toHaveBeenCalledTimes(2);
    retryable.connection.dispose();
  });

  it('adds up to 25 percent jitter without violating server delay', () => {
    vi.mocked(Math.random).mockReturnValue(0.5);
    const { socket, connection } = setup();
    socket.receive('connect_error', { data: { retryable: true, retryAfterMs: 10_000 } });
    vi.advanceTimersByTime(10_124);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it.each(['reset', 'connect_error'])('never retries an explicit denial from %s', event => {
    const { socket, connection, state } = setup();
    if (event === 'reset') {
      socket.receive('connect');
      socket.receive('connection:reset', {
        reason: 'connection_policy',
        retryable: false,
        retryAfterMs: 0,
      });
    } else {
      socket.receive('connect_error', { data: { retryable: false } });
    }
    expect(state()).toMatchObject({ status: 'failed', notice: 'connection_policy' });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    connection.dispose();
  });

  it('terminates after three unexplained server disconnects before ready', () => {
    const { socket, connection, state } = setup();
    for (const delay of [1000, 2000]) {
      socket.receive('connect');
      socket.receive('disconnect', 'io server disconnect');
      vi.advanceTimersByTime(delay);
    }
    socket.receive('connect');
    socket.receive('disconnect', 'io server disconnect');
    expect(state()).toMatchObject({ status: 'failed', notice: 'server_disconnect' });
    expect(socket.connect).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
    connection.dispose();
  });

  it('resets backoff and unexplained-disconnect count only after ready', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('disconnect', 'io server disconnect');
    vi.advanceTimersByTime(1000);
    socket.receive('connect');
    socket.receive('disconnect', 'io server disconnect');
    vi.advanceTimersByTime(2000);
    socket.receive('connect');
    expect(state().retryCount).toBe(2);
    socket.receive('connection:ready', ready);
    expect(state().retryCount).toBe(0);
    socket.receive('disconnect', 'transport close');
    vi.advanceTimersByTime(1000);
    expect(state().retryCount).toBe(1);
    socket.receive('connect');
    socket.receive('disconnect', 'io server disconnect');
    expect(state().status).toBe('reconnecting');
    connection.dispose();
  });

  it('closes an unready transport after five seconds and ignores late ready', () => {
    const onReady = vi.fn();
    const onInterrupted = vi.fn();
    const { socket, connection, state } = setup({ onReady, onInterrupted });
    vi.advanceTimersByTime(9000);
    socket.receive('connect');
    vi.advanceTimersByTime(4999);
    expect(state().status).toBe('initializing');
    vi.advanceTimersByTime(1);
    expect(state()).toMatchObject({ status: 'reconnecting', notice: 'ready_timeout' });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    socket.receive('connection:ready', ready);
    expect(onReady).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it('bounds transport attempts at ten seconds without relying on a Manager retry', () => {
    const { socket, connection, state } = setup();
    vi.advanceTimersByTime(10_000);
    expect(state()).toMatchObject({ status: 'reconnecting', notice: 'attempt_timeout' });
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(socket.connect).toHaveBeenCalledTimes(2);
    connection.dispose();
  });

  it.each([
    { ...ready, protocolVersion: 2 },
    { ...ready, presence: { connectionCount: 0 } },
    { ...ready, viewer: { status: 'guest', userId: 'user-1' } },
    { ...ready, canDraw: 'yes' },
  ])('rejects invalid ready payloads without retrying: %j', payload => {
    const { socket, connection, state } = setup();
    socket.receive('connect');
    socket.receive('connection:ready', payload);
    expect(state()).toMatchObject({ status: 'failed', notice: 'protocol_error' });
    expect(vi.getTimerCount()).toBe(0);
    connection.dispose();
  });

  it('terminates immediately for a Socket.IO protocol incompatibility', () => {
    const { socket, connection, state } = setup();
    socket.receive('connect_error', new Error('Socket.IO server and client are not compatible'));
    expect(state()).toMatchObject({ status: 'failed', notice: 'protocol_error' });
    expect(vi.getTimerCount()).toBe(0);
    connection.dispose();
  });

  it('schedules once for duplicate errors and clears callbacks, listeners and timers on disposal', () => {
    const onReady = vi.fn();
    const onInterrupted = vi.fn();
    const { socket, connection, state } = setup({ onReady, onInterrupted });
    const staleReady = socket.listeners.get('connection:ready')!;
    socket.receive('connect_error', new Error('Network error'));
    socket.receive('disconnect', 'transport close');
    socket.receive('connect_error', new Error('Network error'));
    expect(onInterrupted).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    const previous = state();
    connection.dispose();
    connection.dispose();
    expect(onInterrupted).toHaveBeenCalledTimes(2);
    expect(socket.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    staleReady(ready);
    vi.advanceTimersByTime(30_000);
    expect(socket.connect).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();
    expect(state()).toBe(previous);
  });
});
