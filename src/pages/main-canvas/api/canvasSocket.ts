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
  // 서버 응답은 런타임 검증 전까지 unknown으로 받고, 아래 검증 함수가 필요한 필드만 확인한다.
  'connection:ready': (payload: unknown) => void;
  'canvas:presence': (payload: unknown) => void;
  'connection:reset': (payload: unknown) => void;
}

// 현재 서버 계약은 연결·접속 현황 수신뿐이다. 그리기/인증 이벤트는 아직 보내지 않는다.
export type CanvasSocket = Socket<CanvasServerEvents, Record<string, never>>;

/** 리스너를 등록한 뒤 직접 연결할 수 있도록, 아직 접속하지 않은 캔버스 전용 소켓을 만든다. */
export function createCanvasSocket(): CanvasSocket {
  // 환경변수가 비어 있으면 로컬 주소를 쓰고, 끝의 /를 제거해 /canvas 접속 주소를 만든다.
  // HTTP API의 baseURL과 분리하므로 설정 주소에 /api를 포함하지 않아야 한다.
  const origin = (import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:5000').replace(
    /\/$/,
    ''
  );
  // /canvas는 Socket.IO 연결 영역이고 /realtime은 실제 통신 경로다. 쿠키 전달 옵션을 켠다.
  // forceNew로 별도 Manager(연결·자동 재연결 관리자)를 만들고, 접속 시작은 호출자에게 맡긴다.
  // Manager의 횟수·통신 기한도 제한하며, 서버 ready까지의 기한과 두 재시도 경로의 합계는 모델이 관리한다.
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

/** Socket.IO가 보내는 버전 불일치 오류 문구인지 확인한다. */
export function isSocketProtocolError(error: unknown): boolean {
  // Socket.IO 4.8.3은 잘못된 namespace CONNECT 응답을 받아도 active가 true일 수 있다.
  // 이 오류는 전송 장애와 구분해 즉시 종료한다. 재접속으로 버전 불일치를 해결할 수 없다.
  // Error 객체에 두 문구가 모두 있으면 규격 오류로 분류하고, 나머지는 다른 오류 분기로 보낸다.
  return (
    error instanceof Error &&
    error.message.includes('Socket.IO') &&
    error.message.includes('not compatible')
  );
}

/** 응답 필드를 검사할 수 있도록 null이 아닌 객체인지 확인한다. */
function isRecord(value: unknown): value is Record<string, unknown> {
  // null이나 원시 값은 필드 검사를 진행하지 않고 거절한다.
  return typeof value === 'object' && value !== null;
}

/** 서버 연결 수가 음수가 아닌 안전한 정수인지 확인한다. */
function isCount(value: unknown): value is number {
  // 소수·음수·안전한 정수 범위 밖의 값은 연결 수로 사용하지 않는다.
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

/** 메인 캔버스의 버전 1 준비 응답과 초기 연결 수를 사용할 수 있는지 확인한다. */
export function isCanvasReady(value: unknown): value is CanvasReady {
  // 버전·캔버스·presence의 연결 수가 모두 맞아야 준비 완료로 받아들이며, 추가 필드는 허용한다.
  return (
    isRecord(value) &&
    value.protocolVersion === 1 &&
    value.canvasKey === 'main' &&
    isRecord(value.presence) &&
    isCount(value.presence.connectionCount)
  );
}

/** 메인 캔버스에 대한 연결 수 갱신인지 확인한다. */
export function isCanvasPresence(value: unknown): value is CanvasPresence {
  // 다른 캔버스의 응답이나 잘못된 연결 수는 현재 화면에 반영하지 않는다.
  return isRecord(value) && value.canvasKey === 'main' && isCount(value.connectionCount);
}

/** 종료 안내에 지원하는 사유와 재시도 여부·최소 대기 시간이 있는지 확인한다. */
export function isCanvasReset(value: unknown): value is CanvasReset {
  // 사유가 지원되지 않거나 지연이 음수·무한 값이면 종료 정책으로 사용하지 않는다.
  return (
    isRecord(value) &&
    (value.reason === 'server_shutdown' || value.reason === 'connection_policy') &&
    typeof value.retryable === 'boolean' &&
    typeof value.retryAfterMs === 'number' &&
    Number.isFinite(value.retryAfterMs) &&
    value.retryAfterMs >= 0
  );
}

/** 접속 오류의 data에서 재시도 정책을 꺼내며, 형식이 없거나 잘못되면 null을 반환한다. */
export function getErrorRetryPolicy(error: unknown) {
  // 오류와 data가 객체가 아니면 서버 정책 없이 일반 연결 오류로 판단하도록 null을 반환한다.
  if (!isRecord(error) || !isRecord(error.data)) return null;
  // 서버가 전달한 두 필드만 추출해 재시도 분기에서 사용할 정책을 만든다.
  const { retryable, retryAfterMs } = error.data;
  // 명시적인 boolean과 유한한 0 이상 지연이 모두 있어야 정책으로 사용한다.
  if (
    typeof retryable !== 'boolean' ||
    typeof retryAfterMs !== 'number' ||
    !Number.isFinite(retryAfterMs) ||
    retryAfterMs < 0
  )
    return null;
  return { retryable, retryAfterMs };
}
