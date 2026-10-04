import { afterEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import {
  createCanvasSocket,
  getErrorRetryPolicy,
  isCanvasPresence,
  isCanvasReady,
} from './canvasSocket';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

describe('canvas socket configuration', () => {
  it.each([
    ['', 'http://localhost:5000/canvas'],
    ['https://backend.example.com/', 'https://backend.example.com/canvas'],
  ])('uses a dedicated websocket without Manager retries: %s', (origin, url) => {
    vi.stubEnv('VITE_BACKEND_ORIGIN', origin);
    vi.stubEnv('VITE_API_URL', 'http://localhost:5000/api');
    createCanvasSocket();
    expect(io).toHaveBeenCalledWith(url, {
      path: '/realtime',
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
      forceNew: true,
      reconnection: false,
      timeout: 10_000,
    });
  });
});

describe('canvas server payload validation', () => {
  const ready = {
    protocolVersion: 1,
    canvasKey: 'main',
    presence: { connectionCount: 1 },
    viewer: { status: 'guest', userId: null },
    canDraw: false,
  };

  it('requires identity and permission with either guest or authenticated viewer', () => {
    expect(isCanvasReady(ready)).toBe(true);
    expect(
      isCanvasReady({
        ...ready,
        viewer: { status: 'authenticated', userId: 'user-1' },
        canDraw: true,
      })
    ).toBe(true);
    expect(isCanvasReady({ ...ready, viewer: { status: 'authenticated', userId: null } })).toBe(
      false
    );
    expect(isCanvasReady({ ...ready, canDraw: undefined })).toBe(false);
    expect(isCanvasReady({ ...ready, viewer: undefined })).toBe(false);
  });

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, '1'])(
    'rejects invalid ready and presence connection counts: %s',
    connectionCount => {
      expect(isCanvasReady({ ...ready, presence: { connectionCount } })).toBe(false);
      expect(isCanvasPresence({ canvasKey: 'main', connectionCount })).toBe(false);
    }
  );

  it('honors explicit denial even without a retryAfterMs field', () => {
    expect(getErrorRetryPolicy({ data: { retryable: false } })).toEqual({
      retryable: false,
      retryAfterMs: 0,
    });
    expect(getErrorRetryPolicy({ data: { retryable: true } })).toEqual({
      retryable: true,
      retryAfterMs: 0,
    });
    expect(getErrorRetryPolicy({ data: { retryable: true, retryAfterMs: 4000 } })).toEqual({
      retryable: true,
      retryAfterMs: 4000,
    });
    expect(getErrorRetryPolicy({ data: { retryable: true, retryAfterMs: -1 } })).toBeNull();
  });
});
