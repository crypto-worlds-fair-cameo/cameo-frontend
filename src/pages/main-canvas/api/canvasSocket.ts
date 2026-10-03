import { io, type Socket } from 'socket.io-client';
import { CANVAS_ATTEMPT_TIMEOUT_MS, MAX_CANVAS_RETRIES } from '../config/canvasConnectionPolicy';

export interface CanvasPresence {
  canvasKey: 'main';
  connectionCount: number;
}

export interface CanvasReady {
  protocolVersion: 1;
  canvasKey: 'main';
  presence: { connectionCount: number };
}

export interface CanvasReset {
  reason: 'server_shutdown' | 'connection_policy';
  retryable: boolean;
  retryAfterMs: number;
}

interface CanvasServerEvents {
  'connection:ready': (payload: unknown) => void;
  'canvas:presence': (payload: unknown) => void;
  'connection:reset': (payload: unknown) => void;
}

// 현재 서버 계약은 연결·접속 현황 수신뿐이다. 그리기/인증 이벤트는 아직 보내지 않는다.
export type CanvasSocket = Socket<CanvasServerEvents, Record<string, never>>;

export function createCanvasSocket(): CanvasSocket {
  // HTTP API의 baseURL과 분리한다. /api는 소켓 namespace나 전송 경로에 붙이지 않는다.
  const origin = (import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:5000').replace(
    /\/$/,
    ''
  );
  return io(`${origin}/canvas`, {
    path: '/realtime',
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: false,
    forceNew: true,
    reconnectionAttempts: MAX_CANVAS_RETRIES,
    timeout: CANVAS_ATTEMPT_TIMEOUT_MS,
  });
}

export function isSocketProtocolError(error: unknown): boolean {
  // Socket.IO 4.8.3은 잘못된 namespace CONNECT 응답을 받아도 active가 true일 수 있다.
  // 이 오류는 전송 장애와 구분해 즉시 종료한다. 재접속으로 버전 불일치를 해결할 수 없다.
  return (
    error instanceof Error &&
    error.message.includes('Socket.IO') &&
    error.message.includes('not compatible')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

export function isCanvasReady(value: unknown): value is CanvasReady {
  return (
    isRecord(value) &&
    value.protocolVersion === 1 &&
    value.canvasKey === 'main' &&
    isRecord(value.presence) &&
    isCount(value.presence.connectionCount)
  );
}

export function isCanvasPresence(value: unknown): value is CanvasPresence {
  return isRecord(value) && value.canvasKey === 'main' && isCount(value.connectionCount);
}

export function isCanvasReset(value: unknown): value is CanvasReset {
  return (
    isRecord(value) &&
    (value.reason === 'server_shutdown' || value.reason === 'connection_policy') &&
    typeof value.retryable === 'boolean' &&
    typeof value.retryAfterMs === 'number' &&
    Number.isFinite(value.retryAfterMs) &&
    value.retryAfterMs >= 0
  );
}

export function getErrorRetryPolicy(error: unknown) {
  if (!isRecord(error) || !isRecord(error.data)) return null;
  const { retryable, retryAfterMs } = error.data;
  if (
    typeof retryable !== 'boolean' ||
    typeof retryAfterMs !== 'number' ||
    !Number.isFinite(retryAfterMs) ||
    retryAfterMs < 0
  )
    return null;
  return { retryable, retryAfterMs };
}
