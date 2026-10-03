import {
  createCanvasSocket,
  getErrorRetryPolicy,
  isCanvasPresence,
  isCanvasReady,
  isCanvasReset,
  isSocketProtocolError,
  type CanvasReset,
} from '../api/canvasSocket';
import {
  CANVAS_ATTEMPT_TIMEOUT_MS,
  CANVAS_READY_TIMEOUT_MS,
  CANVAS_RESET_TIMEOUT_MS,
  MAX_CANVAS_RETRIES,
} from '../config/canvasConnectionPolicy';

export interface CanvasConnectionState {
  status: 'connecting' | 'ready' | 'reconnecting' | 'failed';
  connectionCount: number | null;
  transportConnected: boolean;
  retryCount: number;
  notice:
    | CanvasReset['reason']
    | 'connection_error'
    | 'ready_timeout'
    | 'attempt_timeout'
    | 'reset_timeout'
    | 'retry_limit'
    | 'protocol_error'
    | null;
}

export const initialCanvasConnection: CanvasConnectionState = {
  status: 'connecting',
  connectionCount: null,
  transportConnected: false,
  retryCount: 0,
  notice: null,
};

/**
 * 페이지 마운트 → 리스너 등록 → 최초 접속 → connection:ready → presence 순서다.
 * 네트워크 복구는 Manager가 맡고, 서버 종료/거절 또는 시간 초과는 별도 타이머로 복구한다.
 * 두 경로는 재시도 3회 한도를 공유하며, 실패 상태는 수동 재시도 전까지 유지한다.
 */
export function openCanvasConnection(onChange: (state: CanvasConnectionState) => void) {
  const socket = createCanvasSocket();
  let state = initialCanvasConnection;
  let disposed = false;
  let terminal = false;
  let closingLocally = false;
  let awaitingReady = false;
  let reset: CanvasReset | null = null;
  let retriesUsed = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attemptTimer: ReturnType<typeof setTimeout> | undefined;
  let readyTimer: ReturnType<typeof setTimeout> | undefined;
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  const update = (patch: Partial<CanvasConnectionState>) => {
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  const clearRetry = () => {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  const clearConnectionWait = () => {
    clearTimeout(attemptTimer);
    clearTimeout(readyTimer);
    clearTimeout(resetTimer);
    attemptTimer = readyTimer = resetTimer = undefined;
    awaitingReady = false;
  };
  const closeTransport = () => {
    // 로컬 정리 중 발생한 disconnect가 다시 재시도 분기로 들어가지 않게 한다.
    closingLocally = true;
    socket.disconnect();
    closingLocally = false;
  };
  const fail = (notice: CanvasConnectionState['notice']) => {
    if (disposed || terminal) return;
    terminal = true;
    clearRetry();
    clearConnectionWait();
    socket.io.reconnection(false);
    closeTransport();
    update({ status: 'failed', connectionCount: null, transportConnected: false, notice });
  };

  const armAttemptTimeout = () => {
    clearTimeout(attemptTimer);
    // Engine 연결뿐 아니라 namespace 응답과 application ready까지 기다리는 전체 기한이다.
    // active=true인데 Manager가 복구를 시작하지 않는 경우도 이 기한으로 빠져나온다.
    attemptTimer = setTimeout(() => {
      if (disposed || terminal) return;
      update({ notice: 'attempt_timeout' });
      scheduleRetry(0);
    }, CANVAS_ATTEMPT_TIMEOUT_MS);
  };
  const beginAttempt = (isRetry: boolean) => {
    if (disposed || terminal) return false;
    if (isRetry && retriesUsed >= MAX_CANVAS_RETRIES) {
      fail('retry_limit');
      return false;
    }
    clearRetry();
    clearConnectionWait();
    reset = null;
    if (isRetry) retriesUsed += 1;
    update({
      status: isRetry ? 'reconnecting' : 'connecting',
      connectionCount: null,
      transportConnected: false,
      retryCount: retriesUsed,
      notice: null,
    });
    armAttemptTimeout();
    return true;
  };
  function scheduleRetry(minimumDelay: number) {
    if (disposed || terminal) return;
    clearRetry();
    clearConnectionWait();
    // 별도 재시도 전에 Manager를 중단하고 이전 소켓을 분리한다. 두 타이머는 겹치지 않는다.
    socket.io.reconnection(false);
    closeTransport();
    update({ transportConnected: false, connectionCount: null });
    if (retriesUsed >= MAX_CANVAS_RETRIES) {
      fail('retry_limit');
      return;
    }
    const baseDelay = Math.max(minimumDelay, 1000 * 2 ** retriesUsed);
    // 서버 최소 지연 이후에도 항상 분산한다. 긴 retryAfterMs에도 jitter가 사라지지 않는다.
    const delay = baseDelay + Math.floor(Math.random() * 1000);
    update({ status: 'reconnecting' });
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (!beginAttempt(true)) return;
      socket.io.reconnection(true);
      socket.connect();
    }, delay);
  }
  const waitForAutomaticRetry = () => {
    if (retriesUsed >= MAX_CANVAS_RETRIES) {
      fail('retry_limit');
      return;
    }
    update({ status: 'reconnecting' });
    armAttemptTimeout();
  };
  const completeReset = (timedOut: boolean) => {
    if (!reset) return;
    const policy = reset;
    if (!policy.retryable) {
      fail(policy.reason);
    } else {
      if (timedOut) update({ notice: 'reset_timeout' });
      scheduleRetry(policy.retryAfterMs);
    }
  };

  socket.on('connect', () => {
    if (disposed || terminal || reset) return;
    clearRetry();
    awaitingReady = true;
    // connect만으로 한도/전체 기한을 초기화하지 않는다. 서버 ready가 와야 성공이다.
    update({ transportConnected: true, connectionCount: null, notice: null });
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      if (disposed || terminal || !awaitingReady) return;
      update({ notice: 'ready_timeout' });
      scheduleRetry(0);
    }, CANVAS_READY_TIMEOUT_MS);
  });

  socket.on('connection:ready', payload => {
    if (disposed || terminal || !socket.connected || !awaitingReady || reset) return;
    if (!isCanvasReady(payload)) {
      fail('protocol_error');
      return;
    }
    clearConnectionWait();
    retriesUsed = 0;
    update({
      status: 'ready',
      connectionCount: payload.presence.connectionCount,
      retryCount: 0,
      notice: null,
    });
  });

  socket.on('canvas:presence', payload => {
    if (disposed || terminal || state.status !== 'ready' || !isCanvasPresence(payload)) return;
    // 사용자 수가 아닌 탭·기기를 포함한 연결 수다. 최신 값으로 교체한다.
    update({ connectionCount: payload.connectionCount });
  });

  socket.on('connection:reset', payload => {
    if (disposed || terminal || reset || !socket.connected) return;
    if (!isCanvasReset(payload)) {
      fail('protocol_error');
      return;
    }
    clearConnectionWait();
    clearRetry();
    reset = payload;
    socket.io.reconnection(false);
    update({
      status: payload.retryable ? 'reconnecting' : 'failed',
      connectionCount: null,
      notice: payload.reason,
    });
    // 정상적으로는 실제 disconnect를 기다린다. 서버가 종료하지 않으면 5초 뒤 로컬 정리한다.
    resetTimer = setTimeout(() => {
      if (disposed || terminal) return;
      completeReset(true);
    }, CANVAS_RESET_TIMEOUT_MS);
  });

  socket.on('disconnect', () => {
    if (disposed || terminal || closingLocally) return;
    clearConnectionWait();
    clearRetry();
    update({ transportConnected: false, connectionCount: null });
    if (reset) {
      completeReset(false);
    } else if (socket.active) {
      // 네트워크 장애는 기존 Manager 복구만 허용한다. 시간 초과 시에만 소유권을 전환한다.
      waitForAutomaticRetry();
    } else {
      update({ notice: 'connection_error' });
      scheduleRetry(0);
    }
  });

  socket.on('connect_error', error => {
    if (disposed || terminal || closingLocally) return;
    clearConnectionWait();
    clearRetry();
    update({ transportConnected: false, connectionCount: null });
    const policy = getErrorRetryPolicy(error);
    if (isSocketProtocolError(error)) {
      fail('protocol_error');
    } else if (reset) {
      completeReset(false);
    } else if (policy?.retryable === false) {
      fail('connection_error');
    } else if (policy) {
      update({ notice: 'connection_error' });
      scheduleRetry(policy.retryAfterMs);
    } else if (socket.active) {
      update({ notice: 'connection_error' });
      waitForAutomaticRetry();
    } else {
      update({ notice: 'connection_error' });
      scheduleRetry(0);
    }
  });

  const onReconnectAttempt = () => {
    if (disposed || terminal || reset) return;
    // Manager가 실제 접속을 시작하기 직전에 공통 한도를 차감한다.
    // 한도 초과 시 reconnection(false)가 Manager의 후속 open도 중단한다.
    beginAttempt(true);
  };
  const onReconnectFailed = () => fail('retry_limit');
  socket.io.on('reconnect_attempt', onReconnectAttempt);
  socket.io.on('reconnect_failed', onReconnectFailed);
  beginAttempt(false);
  socket.connect();

  return {
    retry() {
      if (
        disposed ||
        socket.connected ||
        state.status !== 'failed' ||
        state.notice === 'protocol_error'
      )
        return;
      clearRetry();
      clearConnectionWait();
      socket.io.reconnection(false);
      closeTransport();
      terminal = false;
      reset = null;
      retriesUsed = 0;
      if (!beginAttempt(false)) return;
      socket.io.reconnection(true);
      socket.connect();
    },
    dispose() {
      if (disposed) return;
      // 페이지 이탈 이후 Manager와 모든 대기 타이머가 연결/상태를 되살리지 않게 한다.
      disposed = true;
      clearConnectionWait();
      clearRetry();
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
      socket.removeAllListeners();
      socket.io.reconnection(false);
      socket.disconnect();
    },
  };
}
