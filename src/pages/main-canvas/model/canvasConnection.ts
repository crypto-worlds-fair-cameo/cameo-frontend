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

/** 서버 이벤트를 화면의 연결 상태·연결 수·재시도 진행·안내 문구로 바꾼 결과다. */
export interface CanvasConnectionState {
  status: 'connecting' | 'ready' | 'reconnecting' | 'failed';
  // 준비 완료 전에 연결 수를 표시하지 않도록 null을 사용한다.
  connectionCount: number | null;
  // Socket.IO connect부터 disconnect까지의 상태다. 서버 준비 완료 여부와 구분한다.
  transportConnected: boolean;
  // 실제 시작한 재시도 수다. 준비 완료 수신 또는 수동 재시도에서 0으로 초기화한다.
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
 * 캔버스 소켓을 연결하고, 서버 이벤트에서 만든 화면 상태를 onChange에 전달한다.
 * 리스너 등록 후 최초 접속을 시작하며, connection:ready 이후에만 연결 수를 반영한다.
 * 네트워크 복구는 Socket.IO Manager가, 서버 종료·거절과 시간 초과는 별도 타이머가 맡는다.
 * 두 경로는 재시도 3회 한도를 공유한다. 호출자는 페이지 이탈 시 반환된 dispose를 호출해야 한다.
 */
export function openCanvasConnection(onChange: (state: CanvasConnectionState) => void) {
  // 아직 접속하지 않은 소켓을 만들고, 이벤트 처리와 재시도에 사용할 상태를 연결 수명 동안 보관한다.
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

  /** 현재 화면 상태에 변경분을 합쳐 페이지에 전달한다. */
  const update = (patch: Partial<CanvasConnectionState>) => {
    // 페이지를 떠난 뒤의 콜백은 이전 페이지의 상태를 바꾸지 않는다.
    if (disposed) return;
    state = { ...state, ...patch };
    onChange(state);
  };
  /** 별도 재접속 예약을 취소한다. Manager의 내부 예약은 reconnection(false)로 중단한다. */
  const clearRetry = () => {
    clearTimeout(retryTimer);
    retryTimer = undefined;
  };
  /** 접속·준비·종료 대기 기한을 취소하고, 이전 시도의 ready를 더 받지 않도록 한다. */
  const clearConnectionWait = () => {
    clearTimeout(attemptTimer);
    clearTimeout(readyTimer);
    clearTimeout(resetTimer);
    attemptTimer = readyTimer = resetTimer = undefined;
    awaitingReady = false;
  };
  /** 소켓을 Manager에서 분리하고 연결을 종료하되, 종료 이벤트로 새 재시도를 만들지 않는다. */
  const closeTransport = () => {
    // 로컬 정리 중 발생한 disconnect가 다시 재시도 분기로 들어가지 않게 한다.
    closingLocally = true;
    socket.disconnect();
    closingLocally = false;
  };
  /** 연결과 복구 예약을 중단하고, 수동 재시도 전까지 실패 상태와 사유를 유지한다. */
  const fail = (notice: CanvasConnectionState['notice']) => {
    // 이미 정리되거나 실패로 확정된 연결에는 종료 작업과 상태 알림을 반복하지 않는다.
    if (disposed || terminal) return;
    // 종료 중 발생한 이벤트도 복구를 시작하지 못하게 막은 뒤 타이머와 실제 연결을 정리한다.
    terminal = true;
    clearRetry();
    clearConnectionWait();
    socket.io.reconnection(false);
    closeTransport();
    update({ status: 'failed', connectionCount: null, transportConnected: false, notice });
  };

  /** 접속 시도 또는 자동 복구가 진행되지 않을 때 별도 재시도로 전환하는 10초 기한을 건다. */
  const armAttemptTimeout = () => {
    clearTimeout(attemptTimer);
    // 기본 통신·캔버스 접속·서버 ready를 기다리며, active=true여도 복구가 멈추면 기한에 따라 정리한다.
    attemptTimer = setTimeout(() => {
      // 만료 전에 페이지가 이탈하거나 실패가 확정됐으면 더 접속하지 않는다.
      if (disposed || terminal) return;
      // 응답 지연 사유를 화면에 전달하고, 자동 복구를 정리한 뒤 공통 한도로 다시 시도한다.
      update({ notice: 'attempt_timeout' });
      scheduleRetry(0);
    }, CANVAS_ATTEMPT_TIMEOUT_MS);
  };
  /** 새 시도의 화면 상태와 기한을 만들고, 접속을 진행할 수 있으면 true를 반환한다. */
  const beginAttempt = (isRetry: boolean) => {
    // 수명이 끝났거나 실패로 확정된 연결은 새 시도를 시작하지 않는다.
    if (disposed || terminal) return false;
    // 재시도 요청에서 한도를 이미 소진했으면 새 접속을 허용하지 않고 실패를 확정한다.
    if (isRetry && retriesUsed >= MAX_CANVAS_RETRIES) {
      fail('retry_limit');
      return false;
    }
    // 이전 시도의 예약과 종료 정책을 비워 새 응답을 받을 준비를 한다.
    clearRetry();
    clearConnectionWait();
    reset = null;
    // 최초 접속은 차감하지 않고, Manager 또는 별도 타이머가 시작하는 재시도만 차감한다.
    if (isRetry) retriesUsed += 1;
    // 최초 접속은 connecting, 재시도는 reconnecting으로 표시하며 이전 연결 수와 사유를 비운다.
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
  /** 자동 복구를 중단한 뒤, 서버 최소 지연과 공통 한도를 지켜 별도 재접속을 예약한다. */
  function scheduleRetry(minimumDelay: number) {
    // 페이지 이탈이나 확정된 실패 뒤에는 재접속 예약을 만들지 않는다.
    if (disposed || terminal) return;
    clearRetry();
    clearConnectionWait();
    // 두 재접속 경로가 겹치지 않도록 Manager의 자동 재연결을 중단하고 이전 소켓을 분리한다.
    socket.io.reconnection(false);
    closeTransport();
    update({ transportConnected: false, connectionCount: null });
    // 한도를 소진했으면 타이머를 만들지 않고 실패 안내를 남긴다.
    if (retriesUsed >= MAX_CANVAS_RETRIES) {
      fail('retry_limit');
      return;
    }
    // 기본 1·2·4초와 서버 retryAfterMs 중 더 긴 값을 택해 서버 최소 대기 시간을 지킨다.
    const baseDelay = Math.max(minimumDelay, 1000 * 2 ** retriesUsed);
    // 서버 최소 지연 이후에도 항상 분산한다. 긴 retryAfterMs에도 jitter가 사라지지 않는다.
    const delay = baseDelay + Math.floor(Math.random() * 1000);
    update({ status: 'reconnecting' });
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      // 예약 만료 시에도 수명과 한도를 재검사해 시도를 시작할 수 있는 경우에만 접속한다.
      if (!beginAttempt(true)) return;
      // 새 시도의 네트워크 장애는 다시 Manager가 복구할 수 있도록 자동 재연결을 켠다.
      socket.io.reconnection(true);
      socket.connect();
    }, delay);
  }
  /** 별도 접속 예약 없이 Manager의 복구를 기다리되, 한도와 진행 기한을 확인한다. */
  const waitForAutomaticRetry = () => {
    // 마지막 재시도까지 실패했으면 Manager가 다음 시도를 예약하지 않도록 중단한다.
    if (retriesUsed >= MAX_CANVAS_RETRIES) {
      fail('retry_limit');
      return;
    }
    // 실제 재시도 횟수는 reconnect_attempt에서 차감하고, 여기서는 복구 대기 상태와 기한만 만든다.
    update({ status: 'reconnecting' });
    armAttemptTimeout();
  };
  /** 종료 안내 후 연결이 끊기거나 오류·대기 만료가 발생하면 보관한 정책으로 중단 또는 재접속을 정한다. */
  const completeReset = (timedOut: boolean) => {
    // 종료 정책이 없으면 서버 종료에 대한 판단을 하지 않는다.
    if (!reset) return;
    const policy = reset;
    // 서버가 재시도를 금지했으면 종료 사유를 남기고, 허용했으면 최소 지연을 지켜 다시 연결한다.
    if (!policy.retryable) {
      fail(policy.reason);
    } else {
      // 실제 disconnect 대신 기한 만료로 정리할 때만 종료 지연 안내로 바꾼다.
      if (timedOut) update({ notice: 'reset_timeout' });
      scheduleRetry(policy.retryAfterMs);
    }
  };

  // Socket.IO 연결이 성립하면 준비 응답을 기다린다. 연결 성립만으로 캔버스 사용 준비를 확정하지 않는다.
  socket.on('connect', () => {
    // 이미 이탈·실패·종료 대기 중인 연결의 connect는 상태를 되살리지 않는다.
    if (disposed || terminal || reset) return;
    clearRetry();
    awaitingReady = true;
    // connect만으로 한도/전체 기한을 초기화하지 않는다. 서버 ready가 와야 성공이다.
    update({ transportConnected: true, connectionCount: null, notice: null });
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      // 이미 정리됐거나 준비 대기가 끝났으면 이전 시도의 기한 만료를 무시한다.
      if (disposed || terminal || !awaitingReady) return;
      // 준비 응답이 늦으면 연결을 정리하고 공통 한도 안에서 별도 재시도를 예약한다.
      update({ notice: 'ready_timeout' });
      scheduleRetry(0);
    }, CANVAS_READY_TIMEOUT_MS);
  });

  // 서버 준비 응답의 초기 연결 수를 화면에 반영하고, 성공한 연결의 재시도 한도를 초기화한다.
  socket.on('connection:ready', payload => {
    // 현재 소켓이 연결돼 준비 응답을 기다리는 동안에만 ready를 받으며, 종료 대기 중에는 무시한다.
    if (disposed || terminal || !socket.connected || !awaitingReady || reset) return;
    // 지원하지 않는 버전이나 잘못된 초기 연결 수면 재시도 대신 규격 오류로 중단한다.
    if (!isCanvasReady(payload)) {
      fail('protocol_error');
      return;
    }
    // 검증된 ready를 받았으므로 대기 기한을 취소하고, 이후 새 장애에는 다시 3회 복구를 허용한다.
    clearConnectionWait();
    retriesUsed = 0;
    update({
      status: 'ready',
      connectionCount: payload.presence.connectionCount,
      retryCount: 0,
      notice: null,
    });
  });

  // 서버에서 받은 최신 연결 수를 준비 완료 화면에 전달한다.
  socket.on('canvas:presence', payload => {
    // 준비 전·종료 대기·실패·페이지 이탈 중이거나 응답 형식이 잘못됐으면 연결 수를 갱신하지 않는다.
    if (disposed || terminal || state.status !== 'ready' || !isCanvasPresence(payload)) return;
    // 사용자 수가 아닌 탭·기기를 포함한 연결 수다. 최신 값으로 교체한다.
    update({ connectionCount: payload.connectionCount });
  });

  // 서버 종료 안내에서 사유와 재시도 정책을 보관하고, 실제 종료를 기다리는 상태로 바꾼다.
  socket.on('connection:reset', payload => {
    // 현재 연결에서 처음 받은 종료 안내만 사용하고, 중복 안내나 정리된 연결의 안내는 무시한다.
    if (disposed || terminal || reset || !socket.connected) return;
    // 재시도 여부와 지연을 판단할 수 없는 응답이면 규격 오류로 연결을 닫는다.
    if (!isCanvasReset(payload)) {
      fail('protocol_error');
      return;
    }
    // 자동 재연결과 이전 대기를 취소한다. 아직 disconnect 전이므로 연결 상태 자체는 유지한다.
    clearConnectionWait();
    clearRetry();
    reset = payload;
    socket.io.reconnection(false);
    // 재시도 허용 시 복구 대기, 금지 시 실패로 표시하지만 실제 종료 확인 전에는 수동 접속을 막는다.
    update({
      status: payload.retryable ? 'reconnecting' : 'failed',
      connectionCount: null,
      notice: payload.reason,
    });
    // 정상적으로는 실제 disconnect를 기다린다. 서버가 종료하지 않으면 5초 뒤 로컬 정리한다.
    resetTimer = setTimeout(() => {
      // 실제 종료나 페이지 이탈로 이미 정리된 경우에는 만료된 종료 안내를 처리하지 않는다.
      if (disposed || terminal) return;
      completeReset(true);
    }, CANVAS_RESET_TIMEOUT_MS);
  });

  // 실제 연결 종료를 확인하면 연결 수를 비우고, 서버 정책 또는 자동 복구 가능 여부로 다음 경로를 고른다.
  socket.on('disconnect', () => {
    // 의도적인 로컬 종료나 이미 끝난 연결은 새로운 재시도를 만들지 않는다.
    if (disposed || terminal || closingLocally) return;
    clearConnectionWait();
    clearRetry();
    update({ transportConnected: false, connectionCount: null });
    // 종료 안내가 있으면 네트워크 상태보다 서버의 재시도 정책을 먼저 적용한다.
    if (reset) {
      completeReset(false);
    } else if (socket.active) {
      // 네트워크 장애는 기존 Manager 복구만 허용한다. 시간 초과 시에만 소유권을 전환한다.
      waitForAutomaticRetry();
    } else {
      // active=false면 Manager가 자동 복구하지 않으므로 공통 한도 안에서 별도 재접속을 예약한다.
      update({ notice: 'connection_error' });
      scheduleRetry(0);
    }
  });

  // 접속 오류에서 서버 재시도 정책을 꺼내고, 규격 오류·종료 정책·네트워크 복구 순서로 판단한다.
  socket.on('connect_error', error => {
    // 이미 정리됐거나 로컬 종료 중인 연결의 오류는 화면과 재접속 예약에 반영하지 않는다.
    if (disposed || terminal || closingLocally) return;
    clearConnectionWait();
    clearRetry();
    update({ transportConnected: false, connectionCount: null });
    // 잘못된 정책은 null로 받아 일반 오류 경로를 사용하고, 올바른 정책은 서버 지연과 허용 여부를 적용한다.
    const policy = getErrorRetryPolicy(error);
    if (isSocketProtocolError(error)) {
      // 버전 불일치는 네트워크 재접속으로 해결하지 않으므로 즉시 실패를 확정한다.
      fail('protocol_error');
    } else if (reset) {
      // 종료 정책을 이미 받았다면 이번 오류보다 보관한 서버 종료 정책을 우선한다.
      completeReset(false);
    } else if (policy?.retryable === false) {
      // 서버가 이번 접속 오류의 재시도를 명시적으로 금지했으면 자동 복구를 중단한다.
      fail('connection_error');
    } else if (policy) {
      // 검증된 재시도 허용 정책이 있으면 Manager를 정리하고 서버 최소 지연 이후에 직접 접속한다.
      update({ notice: 'connection_error' });
      scheduleRetry(policy.retryAfterMs);
    } else if (socket.active) {
      // 서버 정책이 없고 자동 복구가 가능한 소켓이면 Manager를 기다리며 진행 기한만 감시한다.
      update({ notice: 'connection_error' });
      waitForAutomaticRetry();
    } else {
      // 자동 복구가 불가능한 일반 오류는 기본 지연과 공통 한도로 직접 재시도한다.
      update({ notice: 'connection_error' });
      scheduleRetry(0);
    }
  });

  /** Manager가 시작하는 재시도에도 별도 재시도와 같은 횟수·기한을 적용한다. */
  const onReconnectAttempt = () => {
    // 수명이 끝났거나 서버 종료 정책을 기다리는 동안에는 Manager의 시도를 반영하지 않는다.
    if (disposed || terminal || reset) return;
    // Manager가 실제 접속을 시작하기 직전에 공통 한도를 차감한다.
    // 한도 초과 시 reconnection(false)가 Manager의 후속 open도 중단한다.
    beginAttempt(true);
  };
  // Manager 자체 한도를 소진한 경우에도 연결을 정리하고 공통 실패 안내를 남긴다.
  const onReconnectFailed = () => fail('retry_limit');
  // 자동 복구 이벤트까지 모두 등록한 뒤 최초 접속을 시작해 빠른 서버 응답도 받을 수 있게 한다.
  socket.io.on('reconnect_attempt', onReconnectAttempt);
  socket.io.on('reconnect_failed', onReconnectFailed);
  beginAttempt(false);
  socket.connect();

  return {
    /** 실패 화면에서 새 최초 접속을 시작한다. 규격 오류와 살아 있는 연결에는 재접속하지 않는다. */
    retry() {
      // 페이지 이탈·연결 유지·실패 외 상태·규격 오류에서는 수동 재시도 요청을 무시한다.
      if (
        disposed ||
        socket.connected ||
        state.status !== 'failed' ||
        state.notice === 'protocol_error'
      )
        return;
      // 이전 예약과 Manager 연결을 정리한 뒤 실패 확정·서버 정책·재시도 횟수를 새로 시작한다.
      clearRetry();
      clearConnectionWait();
      socket.io.reconnection(false);
      closeTransport();
      terminal = false;
      reset = null;
      retriesUsed = 0;
      // 새 시도를 시작할 수 있는 경우에만 자동 복구를 켜고 실제 접속을 요청한다.
      if (!beginAttempt(false)) return;
      socket.io.reconnection(true);
      socket.connect();
    },
    /** 페이지 이탈 시 소켓·리스너·타이머를 정리한다. 여러 번 호출해도 정리를 반복하지 않는다. */
    dispose() {
      // 이미 이탈한 연결에 대한 두 번째 정리 요청은 무시한다.
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
