import { afterEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { createCanvasSocket } from './canvasSocket';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
afterEach(() => vi.unstubAllEnvs());

describe('canvas socket configuration', () => {
  it.each([
    ['', 'http://localhost:5000/canvas'],
    ['https://backend.example.com/', 'https://backend.example.com/canvas'],
  ])('uses the backend origin without the HTTP API prefix: %s', (origin, url) => {
    vi.stubEnv('VITE_BACKEND_ORIGIN', origin);
    vi.stubEnv('VITE_API_URL', 'http://localhost:5000/api');
    createCanvasSocket();
    expect(io).toHaveBeenCalledWith(url, {
      path: '/realtime',
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
      forceNew: true,
      reconnectionAttempts: 3,
      timeout: 10_000,
    });
  });
});
