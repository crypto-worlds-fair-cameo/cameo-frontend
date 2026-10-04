import { io, type Socket } from 'socket.io-client';
import { CANVAS_ATTEMPT_TIMEOUT_MS } from '../config/canvasConnectionPolicy';
import type {
  AppendStrokeInput,
  AppendStrokeResult,
  CanvasAckCallback,
  CanvasSyncPage,
  SyncCanvasInput,
} from './canvasProtocol';

export interface CanvasPresence {
  canvasKey: 'main';
  connectionCount: number;
}

export type CanvasViewer =
  { status: 'guest'; userId: null } | { status: 'authenticated'; userId: string };

export interface CanvasReady {
  protocolVersion: 1;
  canvasKey: 'main';
  presence: { connectionCount: number };
  viewer: CanvasViewer;
  canDraw: boolean;
}

export interface CanvasReset {
  reason: 'server_shutdown' | 'connection_policy';
  retryable: boolean;
  retryAfterMs: number;
}

interface CanvasServerEvents {
  // 소켓 입력은 검증 전까지 unknown으로 유지해 잘못된 서버 값을 상태에 넣지 않는다.
  'connection:ready': (payload: unknown) => void;
  'canvas:presence': (payload: unknown) => void;
  'connection:reset': (payload: unknown) => void;
  'stroke:preview': (payload: unknown) => void;
}

interface CanvasClientEvents {
  'stroke:append': (
    input: AppendStrokeInput,
    callback: CanvasAckCallback<AppendStrokeResult>
  ) => void;
  'canvas:sync': (input: SyncCanvasInput, callback: CanvasAckCallback<CanvasSyncPage>) => void;
}

export type CanvasSocket = Socket<CanvasServerEvents, CanvasClientEvents>;

/** 리스너를 먼저 등록할 수 있도록 접속 전 상태의 캔버스 전용 소켓을 만든다. */
export function createCanvasSocket(): CanvasSocket {
  // HTTP API 경로와 별도로 origin을 사용하며, 빈 설정은 로컬 서버로 연결한다.
  const origin = (import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:5000').replace(
    /\/$/,
    ''
  );
  // Manager 자동 복구를 끄고 컨트롤러만 재접속을 예약한다. 쿠키는 인증 확인에 전달한다.
  return io(`${origin}/canvas`, {
    path: '/realtime',
    transports: ['websocket'],
    withCredentials: true,
    autoConnect: false,
    forceNew: true,
    reconnection: false,
    timeout: CANVAS_ATTEMPT_TIMEOUT_MS,
  });
}

/** Socket.IO 버전 불일치는 접속을 반복해도 해결되지 않는 오류로 분류한다. */
export function isSocketProtocolError(error: unknown): boolean {
  // 두 문구가 있는 Error만 버전 불일치로 보고 나머지는 네트워크 정책으로 판단한다.
  return (
    error instanceof Error &&
    error.message.includes('Socket.IO') &&
    error.message.includes('not compatible')
  );
}

/** 서버 필드를 읽을 수 있는 객체만 통과시킨다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  // null과 원시 값에는 서버 응답 필드가 없으므로 거절한다.
  return typeof value === 'object' && value !== null;
}

/** 현재 소켓을 포함해 하나 이상인 안전한 연결 수만 통과시킨다. */
function isCount(value: unknown): value is number {
  // 0, 음수, 소수와 안전한 정수 범위 밖의 값은 사용하지 않는다.
  return Number.isSafeInteger(value) && (value as number) >= 1;
}

/** 서버가 보낸 게스트 또는 인증 사용자 신원을 확인한다. */
function isCanvasViewer(value: unknown): value is CanvasViewer {
  // 객체가 아니면 신원 필드를 검사하지 않는다.
  if (!isRecord(value)) return false;
  // 게스트는 null, 인증 사용자는 문자열 ID여야 하며 다른 상태는 거절한다.
  return (
    (value.status === 'guest' && value.userId === null) ||
    (value.status === 'authenticated' && typeof value.userId === 'string')
  );
}

/** 메인 캔버스의 버전, 권한, 신원과 초기 연결 수가 모두 유효한지 확인한다. */
export function isCanvasReady(value: unknown): value is CanvasReady {
  // 필수 필드가 모두 맞아야 준비 완료로 받아들이며 추가 서버 필드는 허용한다.
  return (
    isRecord(value) &&
    value.protocolVersion === 1 &&
    value.canvasKey === 'main' &&
    isRecord(value.presence) &&
    isCount(value.presence.connectionCount) &&
    isCanvasViewer(value.viewer) &&
    typeof value.canDraw === 'boolean'
  );
}

/** 메인 캔버스에서 받은 유효한 연결 수 갱신만 통과시킨다. */
export function isCanvasPresence(value: unknown): value is CanvasPresence {
  // 다른 캔버스나 잘못된 연결 수는 현재 캔버스 통계를 바꾸지 않는다.
  return isRecord(value) && value.canvasKey === 'main' && isCount(value.connectionCount);
}

/** 종료 사유와 서버 재시도 정책을 사용할 수 있는지 확인한다. */
export function isCanvasReset(value: unknown): value is CanvasReset {
  // 알 수 없는 사유나 유효하지 않은 지연은 종료 정책으로 사용하지 않는다.
  return (
    isRecord(value) &&
    (value.reason === 'server_shutdown' || value.reason === 'connection_policy') &&
    typeof value.retryable === 'boolean' &&
    typeof value.retryAfterMs === 'number' &&
    Number.isFinite(value.retryAfterMs) &&
    value.retryAfterMs >= 0
  );
}

/** 접속 오류에 명시된 재시도 정책을 읽고, 정책이 없으면 null을 반환한다. */
export function getErrorRetryPolicy(error: unknown) {
  // data가 없거나 객체가 아니면 일반 네트워크 복구 정책을 사용한다.
  if (!isRecord(error) || !isRecord(error.data)) return null;
  const { retryable, retryAfterMs = 0 } = error.data;
  // retryable=false는 대기 시간 없이도 종료 지시로 사용한다.
  if (retryable === false) return { retryable: false, retryAfterMs: 0 };
  // 지연이 생략되면 기본 지연을 쓰며, 명시된 지연은 유한한 0 이상이어야 한다.
  if (
    retryable !== true ||
    typeof retryAfterMs !== 'number' ||
    !Number.isFinite(retryAfterMs) ||
    retryAfterMs < 0
  )
    return null;
  return { retryable, retryAfterMs };
}
