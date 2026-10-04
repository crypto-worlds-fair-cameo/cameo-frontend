import {
  createCanvasSocket,
  getErrorRetryPolicy,
  isCanvasPresence,
  isCanvasReady,
  isCanvasReset,
  isSocketProtocolError,
  type CanvasReady,
  type CanvasReset,
  type CanvasSocket,
  type CanvasViewer,
} from '../api/canvasSocket';
import {
  CANVAS_ATTEMPT_TIMEOUT_MS,
  CANVAS_READY_TIMEOUT_MS,
  CANVAS_RETRY_BASE_DELAY_MS,
  CANVAS_RETRY_MAX_DELAY_MS,
  MAX_UNEXPLAINED_SERVER_DISCONNECTS,
} from '../config/canvasConnectionPolicy';

/** 서버 연결 이벤트를 캔버스 권한, 통계와 화면 상태로 바꾼 결과다. */
export interface CanvasConnectionState {
  status: 'connecting' | 'initializing' | 'ready' | 'reconnecting' | 'failed';
  connectionCount: number | null;
  transportConnected: boolean;
  retryCount: number;
  viewer: CanvasViewer | null;
  canDraw: boolean;
  notice:
    | CanvasReset['reason']
    | 'connection_error'
    | 'ready_timeout'
    | 'attempt_timeout'
    | 'server_disconnect'
    | 'protocol_error'
    | null;
}

export interface CanvasConnectionHandlers {
  onReady?: (socket: CanvasSocket, ready: CanvasReady) => void;
  onInterrupted?: () => void;
  onPreview?: (payload: unknown) => void;
}

export const initialCanvasConnection: CanvasConnectionState = {
  status: 'connecting',
  connectionCount: null,
  transportConnected: false,
  retryCount: 0,
  viewer: null,
  canDraw: false,
  notice: null,
};

/**
 * 소켓 하나의 수명을 소유하고, 준비 응답 이후에만 캔버스 권한과 이벤트를 전달한다.
 * 복구 가능한 장애는 지연을 두고 계속 재시도한다. 호출자는 이탈 시 dispose를 호출한다.
 */
export function openCanvasConnection(
  onChange: (state: CanvasConnectionState) => void,
  handlers: CanvasConnectionHandlers = {}
) {
  const socket = createCanvasSocket();
  let state = { ...initialCanvasConnection };
  let disposed = false;
  let terminal = false;
  let closingLocally = false;
  let awaitingReady = false;
  let attemptActive = false;
  let readyThisAttempt = false;
  let retriesUsed = 0;
  let unexplainedDisconnects = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attemptTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;

  /** 서버 이벤트의 변경분을 합쳐 현재 페이지로 전달한다. */
  const update = (patch: Partial<CanvasConnectionState>) => {
    // 정리 후 도착한 이벤트는 이전 페이지 상태를 바꾸지 않는다.
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  /** 이전 시도의 대기 시간을 취소해 늦은 ready를 받지 않게 한다. */
  const clearWait = () => {
    clearTimeout(attemptTimer);
    clearTimeout(readyTimer);
    attemptTimer = readyTimer = undefined;
    awaitingReady = false;
    attemptActive = false;
  };
  /** 로컬 종료 이벤트가 재시도 예약을 중복 생성하지 않도록 연결을 닫는다. */
  const closeTransport = () => {
    closingLocally = true;
    socket.disconnect();
    closingLocally = false;
  };
  /** 이전 연결의 비동기 작업을 무효화하고 화면 권한을 비운다. */
  const interrupt = () => {
    clearWait();
    handlers.onInterrupted?.();
    update({ connectionCount: null, transportConnected: false, viewer: null, canDraw: false });
  };
  /** 재시도로 해결되지 않는 서버 정책이나 규격 오류는 영구 실패로 표시한다. */
  const fail = (notice: CanvasConnectionState['notice']) => {
    // 이미 끝난 연결에서는 종료 작업과 콜백을 반복하지 않는다.
    if (disposed || terminal) return;
    terminal = true;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    interrupt();
    closeTransport();
    update({ status: 'failed', notice });
  };

  /** 이전 연결을 바로 닫고, 서버 최소 지연과 지수 백오프로 단일 재접속을 예약한다. */
  const scheduleRetry = (minimumDelay: number, notice: CanvasConnectionState['notice']) => {
    // 예약 중 발생한 중복 종료 이벤트나 이미 끝난 연결은 새 타이머를 만들지 않는다.
    if (disposed || terminal || retryTimer !== undefined) return;
    interrupt();
    closeTransport();
    const backoff = Math.min(
      CANVAS_RETRY_MAX_DELAY_MS,
      CANVAS_RETRY_BASE_DELAY_MS * 2 ** Math.min(retriesUsed, 3)
    );
    // 서버 지연을 하한으로 지키면서 최대 25% jitter로 복구 시점을 분산한다.
    const delay = Math.max(minimumDelay, backoff) + Math.floor(Math.random() * backoff * 0.25);
    update({ status: 'reconnecting', notice });
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      // 페이지 이탈 또는 영구 실패 뒤에는 예약됐던 접속을 시작하지 않는다.
      if (disposed || terminal) return;
      retriesUsed += 1;
      beginAttempt(true);
    }, delay);
  };

  /** 접속 시도의 화면 상태와 기한을 만든 뒤 transport 연결을 시작한다. */
  function beginAttempt(isRetry: boolean) {
    clearWait();
    attemptActive = true;
    readyThisAttempt = false;
    update({
      status: isRetry ? 'reconnecting' : 'connecting',
      retryCount: retriesUsed,
      notice: null,
    });
    attemptTimer = setTimeout(() => {
      // 접속 완료 또는 정리된 시도의 늦은 타이머는 다음 연결에 영향을 주지 않는다.
      if (disposed || terminal || !attemptActive || socket.connected) return;
      scheduleRetry(0, 'attempt_timeout');
    }, CANVAS_ATTEMPT_TIMEOUT_MS);
    socket.connect();
  }

  // connect는 권한 확인 전 단계다. transport 기한을 끝내고 서버 ready를 최대 5초 기다린다.
  socket.on('connect', () => {
    // 예약 대기 중이거나 이미 끝난 시도의 connect는 연결 상태를 되살리지 않는다.
    if (disposed || terminal || !attemptActive) return;
    clearTimeout(attemptTimer);
    attemptTimer = undefined;
    awaitingReady = true;
    update({ status: 'initializing', transportConnected: true, notice: null });
    readyTimer = setTimeout(() => {
      // 준비 대기가 끝난 연결은 이전 기한을 무시한다.
      if (disposed || terminal || !awaitingReady) return;
      scheduleRetry(0, 'ready_timeout');
    }, CANVAS_READY_TIMEOUT_MS);
  });

  // 검증된 ready가 도착해야 서버 신원과 그리기 권한을 페이지에 전달한다.
  socket.on('connection:ready', payload => {
    // 현재 연결이 준비 응답을 기다리지 않으면 늦거나 중복된 ready를 무시한다.
    if (disposed || terminal || !socket.connected || !awaitingReady) return;
    // 지원하지 않는 버전 또는 잘못된 권한 응답은 복구 대신 실패로 종료한다.
    if (!isCanvasReady(payload)) {
      fail('protocol_error');
      return;
    }
    clearWait();
    readyThisAttempt = true;
    retriesUsed = 0;
    unexplainedDisconnects = 0;
    update({
      status: 'ready',
      connectionCount: payload.presence.connectionCount,
      transportConnected: true,
      viewer: payload.viewer,
      canDraw: payload.canDraw,
      retryCount: 0,
      notice: null,
    });
    handlers.onReady?.(socket, payload);
  });

  // 준비 완료 후 받은 연결 수만 현재 통계에 반영한다.
  socket.on('canvas:presence', payload => {
    // 준비 전, 실패, 정리 후 또는 잘못된 응답은 통계에 반영하지 않는다.
    if (disposed || terminal || state.status !== 'ready' || !isCanvasPresence(payload)) return;
    update({ connectionCount: payload.connectionCount });
  });

  // sync 시작 전부터 리스너를 등록해 준비 완료 직후의 실시간 획도 페이지로 전달한다.
  socket.on('stroke:preview', payload => {
    // 사용 가능한 연결에서 온 획만 전달하고 이전 연결의 이벤트는 버린다.
    if (disposed || terminal || state.status !== 'ready') return;
    handlers.onPreview?.(payload);
  });

  // reset은 실제 disconnect를 기다리지 않고 즉시 연결을 닫아 이전 권한을 무효화한다.
  socket.on('connection:reset', payload => {
    // 이미 닫혔거나 예약 대기 중인 연결은 중복 reset을 받지 않는다.
    if (disposed || terminal || !socket.connected || retryTimer !== undefined) return;
    // 정책이 잘못됐으면 영구 실패로, 재시도가 금지됐으면 서버 사유로 종료한다.
    if (!isCanvasReset(payload)) {
      fail('protocol_error');
    } else if (!payload.retryable) {
      fail(payload.reason);
    } else {
      scheduleRetry(payload.retryAfterMs, payload.reason);
    }
  });

  // 네트워크 종료는 계속 복구하며 ready 전 반복되는 서버 강제 종료만 제한한다.
  socket.on('disconnect', reason => {
    // 로컬 정리와 중복 종료는 재시도 수와 서버 거절 수를 늘리지 않는다.
    if (disposed || terminal || closingLocally || retryTimer !== undefined) return;
    // ready 없이 서버가 강제로 닫는 시도만 세 번 연속으로 기록한다.
    if (reason === 'io server disconnect' && !readyThisAttempt) {
      unexplainedDisconnects += 1;
      // 세 번째 설명 없는 서버 종료는 영구 실패로 표시한다.
      if (unexplainedDisconnects >= MAX_UNEXPLAINED_SERVER_DISCONNECTS) {
        fail('server_disconnect');
        return;
      }
    }
    scheduleRetry(0, reason === 'io server disconnect' ? 'server_disconnect' : 'connection_error');
  });

  // 접속 오류의 명시적 종료 정책을 우선 적용하며 일반 오류는 단일 타이머로 복구한다.
  socket.on('connect_error', error => {
    // 이미 종료되거나 재접속을 기다리는 연결의 중복 오류는 무시한다.
    if (disposed || terminal || retryTimer !== undefined) return;
    const policy = getErrorRetryPolicy(error);
    // 프로토콜 불일치는 영구 실패이고 retryable=false는 서버 접속 거절이다.
    if (isSocketProtocolError(error)) {
      fail('protocol_error');
    } else if (policy?.retryable === false || (!socket.active && policy?.retryable !== true)) {
      // inactive는 Socket.IO가 middleware 거절로 이 연결을 폐기했다는 표시다.
      // 명시적 재시도 허용이 없는 영구 거절을 네트워크 오류처럼 무한 반복하지 않는다.
      fail('connection_policy');
    } else {
      scheduleRetry(policy?.retryAfterMs ?? 0, 'connection_error');
    }
  });

  // 모든 서버 이벤트 리스너를 등록한 뒤 최초 연결을 시작한다.
  beginAttempt(false);

  return {
    socket,
    /** 이 연결의 콜백, 예약과 transport를 모두 정리한다. */
    dispose() {
      // 중복 정리는 콜백이나 연결 종료를 반복하지 않는다.
      if (disposed) return;
      disposed = true;
      clearTimeout(retryTimer);
      retryTimer = undefined;
      clearWait();
      handlers.onInterrupted?.();
      socket.removeAllListeners();
      closeTransport();
    },
  };
}
