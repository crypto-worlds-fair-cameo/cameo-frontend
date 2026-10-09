import type { CanvasSocket, CanvasReady, SeasonStateEvent } from '../api/canvasSocket';
import {
  appendStroke,
  bootstrapCanvas,
  syncCanvas,
  CanvasRequestError,
} from '../api/canvasRequests';
import {
  APPEND_BYTE_LIMIT,
  APPEND_POINT_LIMIT,
  isStrokePreview,
  type AppendStrokeInput,
  type StrokePreview,
  type SyncCanvasInput,
  type CanvasKey,
  type CanvasTarget,
  MAIN_CANVAS_TARGET,
} from '../api/canvasProtocol';
import type { CanvasDrawingTransport, CanvasStroke } from './useCanvasDrawing';
import {
  CANVAS_RENDERER_VERSION,
  loadCanvasSnapshot,
  releaseCanvasSnapshot,
  type CanvasSnapshotBase,
} from './canvasSnapshot';

export const MAX_LOCAL_STROKE_POINTS = 100_000;
const RECOVERY_BUFFER_CHUNK_LIMIT = 512;
const RECOVERY_BUFFER_BYTE_LIMIT = 8 * 1024 * 1024;
const REPLAY_CHUNK_LIMIT = 20_000;
const REPLAY_BYTE_LIMIT = 80 * 1024 * 1024;
const BOOTSTRAP_RETRY_DELAYS = [1000, 2000, 4000, 8000, 16_000] as const;
const RECOVERY_RETRYABLE_CODES = [
  'RATE_LIMITED',
  'ACK_TIMEOUT',
  'DISCONNECTED',
  'CANVAS_CAPACITY_REACHED',
  'REALTIME_UNAVAILABLE',
  'SNAPSHOT_EPOCH_CHANGED',
  'CANVAS_REPLAY_CAPACITY_REACHED',
  'CANVAS_RECOVERY_OVERFLOW',
];

export function canRetryCanvasRecovery(code: string | undefined) {
  return code !== undefined && RECOVERY_RETRYABLE_CODES.includes(code);
}

export interface CanvasSyncState {
  status: 'waiting' | 'recovering' | 'ready' | 'failed';
  epoch?: string;
  lastAppliedSequence: string;
  previews: StrokePreview[];
  optimisticStrokes: { stroke: CanvasStroke; acknowledgedPoints: number }[];
  userId?: string;
  error: { code: string; message: string } | null;
  retry: { code: string; message: string } | null;
  submissionStatus: 'idle' | 'drawing' | 'saving' | 'saved' | 'failed';
  canDraw: boolean;
  strokeUsed: boolean;
  resetVersion: number;
  snapshotBase: CanvasSnapshotBase | null;
}

export const initialCanvasSync: CanvasSyncState = {
  status: 'waiting',
  lastAppliedSequence: '0',
  previews: [],
  optimisticStrokes: [],
  error: null,
  retry: null,
  submissionStatus: 'idle',
  canDraw: false,
  strokeUsed: false,
  resetVersion: 0,
  snapshotBase: null,
};

interface PendingStroke {
  stroke: CanvasStroke;
  userId: string;
  sentPoints: number;
  acknowledgedPoints: number;
  chunkIndex: number;
  ended: boolean;
  finalApplied: boolean;
  finalAcknowledged: boolean;
  confirmedAcks: Array<{
    epoch: string;
    sequence: string;
    throughPoint: number;
    isFinal: boolean;
  }>;
  request?: { input: AppendStrokeInput; throughPoint: number };
}

interface RecoveryJob {
  token: number;
  connection: CanvasSocket;
  epoch?: string;
  cursor: string;
  head?: string;
}

/** 연결 수명과 분리해 서버 세대·서버 순서·저장 ACK 대기 좌표의 수명을 관리한다. */
export function createCanvasSync(
  onChange: (state: CanvasSyncState) => void,
  onInputReset: () => void,
  requests: {
    append?: typeof appendStroke;
    sync?: typeof syncCanvas;
    bootstrap?: typeof bootstrapCanvas;
  } = {
    append: appendStroke,
    sync: syncCanvas,
    bootstrap: bootstrapCanvas,
  },
  onLiveInputInterrupted: () => void = () => {},
  onStrokeLimitAttempt: () => void = () => {},
  canvasKey: CanvasKey = 'main',
  snapshotEnabled = false
) {
  const requestHandlers = {
    append: requests.append ?? appendStroke,
    sync: requests.sync ?? syncCanvas,
    bootstrap: requests.bootstrap ?? bootstrapCanvas,
  };
  let target: CanvasTarget = { ...MAIN_CANVAS_TARGET, canvasKey };
  let terminalBoundary: { epoch: string; head: string } | undefined;
  let state: CanvasSyncState = { ...initialCanvasSync };
  let socket: CanvasSocket | undefined;
  let generation = 0;
  let disposed = false;
  let available = false;
  let drawingAllowed = false;
  let sending = false;
  let retryingAppend = false;
  let recovering = false;
  let recoveryAgain = false;
  let sendTimer: ReturnType<typeof setTimeout> | undefined;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
  let bootstrapRetryTimer: ReturnType<typeof setTimeout> | undefined;
  let bootstrapRetryAttempt = 0;
  let recoveryRetryAttempt = 0;
  let initializationRestartCount = 0;
  let recoveryOverflowCount = 0;
  let recoveryJob: RecoveryJob | undefined;
  let snapshotAbort: AbortController | undefined;
  let waitingForBase = false;
  let restartBootstrap = false;
  const pending = new Map<string, PendingStroke>();
  const queue: string[] = [];
  const buffers = new Map<string, Map<string, StrokePreview>>();
  const bufferBytes = new Map<string, number>();
  const overflowedBuffers = new Set<string>();
  let replayBytes = 0;
  // 사용 확정은 연결·그림 epoch와 별개로 보관해 재접속이나 계정 전환으로 횟수를 돌려주지 않는다.
  const usedAccounts = new Set<string>();
  const exhaustedAccounts = new Set<string>();
  const requestTimes = { append: [] as number[], sync: [] as number[], bootstrap: [] as number[] };
  const rateWaits = new Map<ReturnType<typeof setTimeout>, () => void>();

  /** 각 이벤트의 1초 제한을 지키고, ACK 전 동일 이벤트는 sending/recovering으로 직렬화한다. */
  function waitForRate(event: 'append' | 'sync' | 'bootstrap'): Promise<void> | undefined {
    const times = requestTimes[event];
    const maximum = event === 'append' ? 30 : 5;
    if (!disposed && available) {
      const now = Date.now();
      while (times.length && times[0] <= now - 1000) times.shift();
      if (times.length < maximum) {
        times.push(now);
        return;
      }
      return new Promise<void>(resolve => {
        const timer = setTimeout(
          () => {
            rateWaits.delete(timer);
            const next = waitForRate(event);
            if (next) void next.then(resolve);
            else resolve();
          },
          times[0] + 1001 - now
        );
        rateWaits.set(timer, resolve);
      });
    }
  }

  /** 입력 배열을 복사해 진행 중인 입력이 과거의 화면 스냅샷을 바꾸지 않게 한다. */
  function publish(patch: Partial<CanvasSyncState> = {}) {
    if (disposed) return;
    const next = { ...state, ...patch };
    // 시즌은 남은 획 수를 추측하지 않고 서버의 한도 거절 뒤에 새 입력을 닫는다.
    const strokeUsed =
      next.userId !== undefined &&
      (canvasKey === 'main' ? usedAccounts : exhaustedAccounts).has(next.userId);
    state = {
      ...next,
      strokeUsed,
      canDraw: next.canDraw && !strokeUsed,
      optimisticStrokes: [...pending.values()].map(item => ({
        stroke: { ...item.stroke, points: [...item.stroke.points] },
        acknowledgedPoints: item.acknowledgedPoints,
      })),
    };
    onChange(state);
  }

  /** 서버 좌표는 남기고, 사용자·서버 세대가 바뀔 때만 미확정 입력을 버린다. */
  function clearPending() {
    clearTimeout(sendTimer);
    sendTimer = undefined;
    retryingAppend = false;
    pending.clear();
    queue.length = 0;
    onInputReset();
  }

  /** 거절된 미확정 입력은 화면에서도 버리고, 서버가 받은 그림과 로컬 연습은 유지한다. */
  function stopTransmission(code: string, message: string) {
    clearTimeout(sendTimer);
    sendTimer = undefined;
    retryingAppend = false;
    pending.clear();
    queue.length = 0;
    onLiveInputInterrupted();
    publish({
      error: { code, message },
      retry: null,
      submissionStatus: 'failed',
      canDraw: false,
    });
  }

  /** 임시 획과 전송 대기에 같은 로컬 메모리 한도를 적용한다. */
  function rejectLocalCapacity() {
    stopTransmission('LOCAL_CAPACITY_REACHED', 'Too many points are waiting for acknowledgement.');
  }

  /** 진행 없는 버퍼 초과가 반복되면 현재 비동기 세대를 폐기하고 기존 화면에서 멈춘다. */
  function failRecoveryOverflow() {
    generation++;
    snapshotAbort?.abort();
    snapshotAbort = undefined;
    clearTimeout(sendTimer);
    sendTimer = undefined;
    clearTimeout(recoveryTimer);
    recoveryTimer = undefined;
    clearTimeout(bootstrapRetryTimer);
    bootstrapRetryTimer = undefined;
    for (const [timer, resolve] of rateWaits) {
      clearTimeout(timer);
      resolve();
    }
    rateWaits.clear();
    sending = false;
    retryingAppend = false;
    recovering = false;
    recoveryAgain = false;
    recoveryJob = undefined;
    waitingForBase = false;
    restartBootstrap = false;
    buffers.clear();
    bufferBytes.clear();
    overflowedBuffers.clear();
    for (const item of pending.values()) item.ended = true;
    onLiveInputInterrupted();
    publish({
      status: 'failed',
      canDraw: false,
      error: {
        code: 'CANVAS_RECOVERY_OVERFLOW',
        message:
          'Canvas updates are arriving faster than recovery. Retry to load a newer snapshot.',
      },
    });
  }

  function previewBytes(preview: StrokePreview) {
    return new TextEncoder().encode(JSON.stringify(preview)).byteLength;
  }

  function samePreview(left: StrokePreview, right: StrokePreview) {
    const brushFields = ['type', 'size', 'color', 'opacity', 'version', 'angle', 'seed'] as const;
    return (
      left.canvasKey === right.canvasKey &&
      left.epoch === right.epoch &&
      left.sequence === right.sequence &&
      left.userId === right.userId &&
      left.clientStrokeId === right.clientStrokeId &&
      left.chunkIndex === right.chunkIndex &&
      left.isFinal === right.isFinal &&
      brushFields.every(field => left.brush[field] === right.brush[field]) &&
      left.points.length === right.points.length &&
      left.points.every((point, index) => {
        const other = right.points[index];
        return point.x === other.x && point.y === other.y && point.t === other.t;
      })
    );
  }

  /** 검증된 ACK 중 현재 이미지·cursor에 포함된 구간만 optimistic 꼬리에서 제외한다. */
  function settleConfirmedAcks(id: string, item: PendingStroke, epoch: string, cursor: string) {
    let throughPoint = item.acknowledgedPoints;
    let finalApplied = item.finalApplied;
    for (const ack of item.confirmedAcks) {
      if (ack.epoch !== epoch || BigInt(ack.sequence) > BigInt(cursor)) continue;
      throughPoint = Math.max(throughPoint, ack.throughPoint);
      finalApplied ||= ack.isFinal;
    }
    item.acknowledgedPoints = throughPoint;
    item.finalApplied = finalApplied;
    const settled = item.finalApplied && item.finalAcknowledged && item.ended;
    if (settled) pending.delete(id);
    return settled;
  }

  /** 현재 세대에서 연속된 방송만 적용하고, 누락된 순서 다음 좌표는 버퍼에 남긴다. */
  function applyBuffered(
    through = terminalBoundary && terminalBoundary.epoch === state.epoch
      ? terminalBoundary.head
      : undefined
  ) {
    if (!state.epoch) return true;
    const buffer = buffers.get(state.epoch);
    if (!buffer) return true;
    const applied: StrokePreview[] = [];
    let appliedBytes = 0;
    let cursor = BigInt(state.lastAppliedSequence);
    while (buffer.has(String(cursor + 1n)) && (through === undefined || cursor < BigInt(through))) {
      const nextCursor = cursor + 1n;
      const preview = buffer.get(String(nextCursor))!;
      const bytes = previewBytes(preview);
      if (
        snapshotEnabled &&
        (state.previews.length + applied.length >= REPLAY_CHUNK_LIMIT ||
          replayBytes + appliedBytes + bytes > REPLAY_BYTE_LIMIT)
      ) {
        replayBytes += appliedBytes;
        publish({
          ...(applied.length
            ? {
                previews: [...state.previews, ...applied],
                lastAppliedSequence: String(cursor),
              }
            : {}),
          status: 'failed',
          canDraw: false,
          error: {
            code: 'CANVAS_REPLAY_CAPACITY_REACHED',
            message:
              'Canvas replay reached the local memory limit. Reload to fetch a newer snapshot.',
          },
        });
        return false;
      }
      cursor = nextCursor;
      buffer.delete(preview.sequence);
      bufferBytes.set(state.epoch, Math.max(0, (bufferBytes.get(state.epoch) ?? 0) - bytes));
      applied.push(preview);
      appliedBytes += bytes;
      // 본인의 ACK도 같은 순서로 반영한 뒤 로컬 즉시 표시의 중복 부분을 제외한다.
      const item = pending.get(preview.clientStrokeId);
      if (item?.userId === preview.userId) {
        const confirmed = item.confirmedAcks.find(
          ack => ack.epoch === preview.epoch && ack.sequence === preview.sequence
        );
        item.acknowledgedPoints = confirmed
          ? Math.max(item.acknowledgedPoints, confirmed.throughPoint)
          : item.acknowledgedPoints +
            (preview.chunkIndex === 0
              ? preview.points.length
              : Math.max(0, preview.points.length - 1));
        item.finalApplied ||= preview.isFinal;
        // 복구가 final을 먼저 찾아도 마지막 ACK를 받을 때까지 동일 요청의 재시도를 유지한다.
        if (item.finalApplied && item.finalAcknowledged && item.ended)
          pending.delete(preview.clientStrokeId);
      }
    }
    if (applied.length) {
      replayBytes += appliedBytes;
      recoveryOverflowCount = 0;
      publish({ previews: [...state.previews, ...applied], lastAppliedSequence: String(cursor) });
    }
    if (!buffer.size) {
      buffers.delete(state.epoch);
      bufferBytes.delete(state.epoch);
    }
    return true;
  }

  /** 방송·ACK·복구 페이지를 같은 입구에서 중복 제거한다. */
  function acceptPreview(payload: unknown, fromSync = false) {
    if (disposed || !available) return;
    if (
      ['CANVAS_REPLAY_CAPACITY_REACHED', 'CANVAS_RECOVERY_OVERFLOW'].includes(
        state.error?.code ?? ''
      )
    )
      return;
    if (!isStrokePreview(payload, target)) {
      publish({
        status: 'failed',
        canDraw: false,
        error: { code: 'INVALID_RESPONSE', message: 'Canvas preview is invalid.' },
      });
      return;
    }
    const preview = payload;
    // 최종 경계를 넘는 방송은 현재 그림에 포함하지 않는다. 경계 이하의 늦은 방송은 유지한다.
    if (
      terminalBoundary?.epoch === preview.epoch &&
      BigInt(preview.sequence) > BigInt(terminalBoundary.head)
    )
      return;
    if (
      preview.epoch === state.epoch &&
      BigInt(preview.sequence) <= BigInt(state.lastAppliedSequence)
    )
      return;
    if (overflowedBuffers.has(preview.epoch) && !fromSync) {
      recoveryAgain = true;
      if (!waitingForBase) void recover();
      return;
    }
    let buffer = buffers.get(preview.epoch);
    if (!buffer) {
      buffer = new Map();
      buffers.set(preview.epoch, buffer);
    }
    const existing = buffer.get(preview.sequence);
    if (existing && !samePreview(existing, preview)) {
      publish({
        status: 'failed',
        canDraw: false,
        error: { code: 'INVALID_RESPONSE', message: 'Canvas sequence contents do not match.' },
      });
      return;
    }
    if (!existing) {
      const bytes = (bufferBytes.get(preview.epoch) ?? 0) + previewBytes(preview);
      if (
        !fromSync &&
        (buffer.size >= RECOVERY_BUFFER_CHUNK_LIMIT || bytes > RECOVERY_BUFFER_BYTE_LIMIT)
      ) {
        buffer.clear();
        bufferBytes.delete(preview.epoch);
        recoveryOverflowCount++;
        if (recoveryOverflowCount >= 3) {
          failRecoveryOverflow();
          return;
        }
        overflowedBuffers.add(preview.epoch);
        recoveryAgain = true;
        if (!waitingForBase) void recover();
        return;
      }
      buffer.set(preview.sequence, preview);
      bufferBytes.set(preview.epoch, bytes);
    }
    // 복구 중 실시간 방송은 고정 head 페이지 적용이 끝날 때까지 버퍼에 남긴다.
    if (!waitingForBase && (!recovering || fromSync)) {
      const applied = applyBuffered(fromSync ? recoveryJob?.head : undefined);
      if (!applied) {
        if (fromSync)
          throw new CanvasRequestError(
            'CANVAS_REPLAY_CAPACITY_REACHED',
            'Canvas replay reached the local memory limit. Reload to fetch a newer snapshot.'
          );
        return;
      }
    }
    // 세대가 다르거나 순서가 비면 마지막으로 연속 반영한 순서부터 복구한다.
    if (
      !waitingForBase &&
      !fromSync &&
      (preview.epoch !== state.epoch ||
        BigInt(preview.sequence) > BigInt(state.lastAppliedSequence) + 1n)
    ) {
      void recover();
    }
  }

  /** 재시작으로 세대가 바뀌면 이전 그림·전송 대기·커서를 함께 지운다. */
  function resetEpoch(epoch: string) {
    if (state.epoch === epoch) return;
    clearPending();
    for (const key of buffers.keys()) if (key !== epoch) buffers.delete(key);
    for (const key of bufferBytes.keys()) if (key !== epoch) bufferBytes.delete(key);
    for (const key of overflowedBuffers) if (key !== epoch) overflowedBuffers.delete(key);
    const previousBase = state.snapshotBase;
    replayBytes = 0;
    recoveryOverflowCount = 0;
    publish({
      epoch,
      previews: [],
      lastAppliedSequence: '0',
      snapshotBase: null,
      resetVersion: state.resetVersion + 1,
      retry: null,
      submissionStatus: 'idle',
      // 사용 제한 오류와 계정의 차감은 저장된 그림의 새 세대에서도 유지한다.
      error: (canvasKey === 'main'
        ? ['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED']
        : ['STROKE_LIMIT_REACHED']
      ).includes(state.error?.code ?? '')
        ? state.error
        : null,
      canDraw: drawingAllowed,
    });
    retireSnapshot(previousBase);
  }

  function retireSnapshot(snapshot: CanvasSnapshotBase | null) {
    if (!snapshot) return;
    if (typeof requestAnimationFrame !== 'function') {
      releaseCanvasSnapshot(snapshot);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => releaseCanvasSnapshot(snapshot)));
  }

  /** 검증이 끝난 이미지·이어그리기 상태·cursor를 한 상태 변경으로 교체한다. */
  function installRecoveryBase(epoch: string, cursor: string, base: CanvasSnapshotBase | null) {
    const epochChanged = state.epoch !== epoch;
    const cursorAdvanced = epochChanged || BigInt(cursor) > BigInt(state.lastAppliedSequence);
    if (epochChanged) clearPending();
    for (const key of buffers.keys()) {
      if (key !== epoch) buffers.delete(key);
    }
    for (const key of bufferBytes.keys()) {
      if (key !== epoch) bufferBytes.delete(key);
    }
    for (const key of overflowedBuffers) {
      if (key !== epoch) overflowedBuffers.delete(key);
    }
    const buffer = buffers.get(epoch);
    if (buffer) {
      for (const [sequence] of buffer) {
        if (BigInt(sequence) <= BigInt(cursor)) buffer.delete(sequence);
      }
      const bytes = [...buffer.values()].reduce((sum, preview) => sum + previewBytes(preview), 0);
      if (buffer.size) bufferBytes.set(epoch, bytes);
      else {
        buffers.delete(epoch);
        bufferBytes.delete(epoch);
      }
    }
    const previousBase = state.snapshotBase;
    replayBytes = 0;
    if (cursorAdvanced) recoveryOverflowCount = 0;
    // ACK가 먼저 성공하고 방송이 gap에 머문 경우에도 새 이미지가 포함한 구간은 다시 덧그리지 않는다.
    let finalPendingSettled = false;
    for (const [id, item] of pending) {
      const settled = settleConfirmedAcks(id, item, epoch, cursor);
      finalPendingSettled = settled || finalPendingSettled;
    }
    publish({
      epoch,
      previews: [],
      lastAppliedSequence: cursor,
      snapshotBase: base,
      resetVersion: state.resetVersion + 1,
      retry: null,
      submissionStatus: epochChanged
        ? 'idle'
        : finalPendingSettled && pending.size === 0
          ? 'saved'
          : state.submissionStatus,
      error: (canvasKey === 'main'
        ? ['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED']
        : ['STROKE_LIMIT_REACHED']
      ).includes(state.error?.code ?? '')
        ? state.error
        : null,
      canDraw: false,
      status: 'recovering',
    });
    if (previousBase !== base) retireSnapshot(previousBase);
  }

  /** 현재 연결만 응답을 반영하게, 끊길 때 비동기 작업의 세대를 변경한다. */
  function interrupted() {
    if (disposed) return;
    generation++;
    snapshotAbort?.abort();
    snapshotAbort = undefined;
    waitingForBase = false;
    restartBootstrap = false;
    available = false;
    socket = undefined;
    sending = false;
    retryingAppend = false;
    recovering = false;
    recoveryAgain = false;
    recoveryJob = undefined;
    for (const [timer, resolve] of rateWaits) {
      clearTimeout(timer);
      resolve();
    }
    rateWaits.clear();
    requestTimes.append.length = requestTimes.sync.length = requestTimes.bootstrap.length = 0;
    // 끊기기 전의 미확인 묶음과 좌표는 보관하되 새 오프라인 입력은 같은 획에 섞지 않는다.
    for (const item of pending.values()) item.ended = true;
    onLiveInputInterrupted();
    clearTimeout(sendTimer);
    sendTimer = undefined;
    clearTimeout(recoveryTimer);
    recoveryTimer = undefined;
    clearTimeout(bootstrapRetryTimer);
    bootstrapRetryTimer = undefined;
    bootstrapRetryAttempt = 0;
    recoveryRetryAttempt = 0;
    initializationRestartCount = 0;
    recoveryOverflowCount = 0;
    clearInterval(pollTimer);
    pollTimer = undefined;
    publish({
      status: 'waiting',
      canDraw: false,
      retry: null,
      submissionStatus: pending.size ? 'saving' : state.submissionStatus,
    });
  }

  function current(token: number) {
    return !disposed && available && token === generation;
  }

  /** bootstrap 기준의 epoch·head·시작 순서를 고정하고 이후 페이지 복구를 시작한다. */
  async function initializeRecovery(connection: CanvasSocket, token: number) {
    if (!snapshotEnabled) {
      waitingForBase = false;
      recoveryJob = undefined;
      void recover();
      return;
    }
    waitingForBase = true;
    snapshotAbort?.abort();
    const controller = new AbortController();
    snapshotAbort = controller;

    async function requestBootstrap(preferSnapshot: boolean) {
      const rateWait = waitForRate('bootstrap');
      if (rateWait) await rateWait;
      if (!current(token) || connection !== socket) throw new DOMException('Aborted', 'AbortError');
      return requestHandlers.bootstrap(
        connection,
        { preferSnapshot, rendererVersion: CANVAS_RENDERER_VERSION },
        target
      );
    }

    let bootstrap = await requestBootstrap(true);
    if (!current(token) || connection !== socket) return;
    let base: CanvasSnapshotBase | null = null;
    if (bootstrap.snapshot) {
      try {
        base = await loadCanvasSnapshot(bootstrap.snapshot, target, controller.signal);
      } catch (error) {
        if (controller.signal.aborted || !current(token)) throw error;
        // 파일·해시·decode·호환 실패는 한 번만 N=0 bootstrap으로 되돌린다.
        bootstrap = await requestBootstrap(false);
      }
    }
    if (!current(token) || connection !== socket) {
      releaseCanvasSnapshot(base);
      return;
    }
    const baseSequence = base ? bootstrap.baseSequence : '0';
    installRecoveryBase(bootstrap.epoch, baseSequence, base);
    waitingForBase = false;
    snapshotAbort = undefined;
    recoveryAgain ||=
      Boolean(buffers.get(bootstrap.epoch)?.size) || overflowedBuffers.has(bootstrap.epoch);
    recoveryJob = {
      token,
      connection,
      epoch: bootstrap.epoch,
      cursor: baseSequence,
      head: bootstrap.headSequence,
    };
    void recover();
  }

  /** bootstrap의 일시 장애만 제한된 백오프로 재시도하며 계약 오류는 즉시 사용자에게 알린다. */
  function startRecoveryInitialization(connection: CanvasSocket, token: number) {
    clearTimeout(bootstrapRetryTimer);
    bootstrapRetryTimer = undefined;
    publish({ status: 'recovering', canDraw: false });
    void initializeRecovery(connection, token)
      .then(() => {
        if (current(token) && connection === socket) bootstrapRetryAttempt = 0;
      })
      .catch(error => {
        if (!current(token) || connection !== socket) return;
        snapshotAbort?.abort();
        snapshotAbort = undefined;
        const code = error instanceof CanvasRequestError ? error.code : 'ACK_TIMEOUT';
        if (
          [
            'RATE_LIMITED',
            'ACK_TIMEOUT',
            'DISCONNECTED',
            'CANVAS_CAPACITY_REACHED',
            'REALTIME_UNAVAILABLE',
          ].includes(code)
        ) {
          if (bootstrapRetryAttempt >= BOOTSTRAP_RETRY_DELAYS.length) {
            waitingForBase = false;
            publish({
              status: 'failed',
              canDraw: false,
              error: {
                code,
                message:
                  error instanceof Error ? error.message : 'Canvas bootstrap retry limit reached.',
              },
            });
            return;
          }
          const delay = BOOTSTRAP_RETRY_DELAYS[bootstrapRetryAttempt];
          bootstrapRetryAttempt++;
          bootstrapRetryTimer = setTimeout(() => {
            bootstrapRetryTimer = undefined;
            if (current(token) && connection === socket)
              startRecoveryInitialization(connection, token);
          }, delay);
          return;
        }
        waitingForBase = false;
        publish({
          status: 'failed',
          canDraw: false,
          error: {
            code,
            message: error instanceof Error ? error.message : 'Canvas bootstrap failed.',
          },
        });
      });
  }

  /** 한 번에 복구 하나만 실행하고, 첫 페이지의 head를 고정해 조회 중 방송과 합친다. */
  async function recover() {
    if (disposed || !available || !socket || waitingForBase || state.status === 'failed') return;
    // 진행 중인 복구와 재시도 대기 중에는 후속 요청만 기록해 같은 cursor 요청이 몰리지 않게 한다.
    if (recovering || recoveryTimer) {
      recoveryAgain = true;
      return;
    }
    recovering = true;
    const job =
      recoveryJob?.token === generation && recoveryJob.connection === socket
        ? recoveryJob
        : {
            token: generation,
            connection: socket,
            epoch: state.epoch,
            cursor:
              terminalBoundary && terminalBoundary.epoch !== state.epoch
                ? '0'
                : state.lastAppliedSequence,
            ...(terminalBoundary && terminalBoundary.epoch === state.epoch
              ? { head: terminalBoundary.head }
              : {}),
          };
    recoveryJob = job;
    let completed = false;
    if (state.status !== 'ready') publish({ status: 'recovering' });
    try {
      for (;;) {
        const input: SyncCanvasInput = {
          afterSequence: job.cursor,
          limit: 50,
          ...(job.epoch === undefined ? {} : { epoch: job.epoch }),
          ...(job.head === undefined ? {} : { throughSequence: job.head }),
        };
        const rateWait = waitForRate('sync');
        if (rateWait) await rateWait;
        if (!current(job.token)) return;
        const page = await requestHandlers.sync(job.connection, input, target);
        if (!current(job.token)) return;
        if (snapshotEnabled && (page.reset || page.epoch !== job.epoch)) {
          throw new CanvasRequestError(
            'SNAPSHOT_EPOCH_CHANGED',
            'Canvas runtime changed while restoring the snapshot.'
          );
        }
        const expectedCursor = page.reset ? 0n : BigInt(job.cursor);
        if (
          (!page.reset && page.epoch !== job.epoch) ||
          (page.previews.length
            ? BigInt(page.previews[0].sequence) !== expectedCursor + 1n
            : page.nextSequence !== String(expectedCursor)) ||
          (job.head !== undefined && !page.reset && page.headSequence !== job.head) ||
          (page.hasMore && BigInt(page.nextSequence) <= expectedCursor)
        ) {
          throw new CanvasRequestError('INVALID_RESPONSE', 'Canvas recovery sequence is invalid.');
        }
        if (page.epoch !== state.epoch) resetEpoch(page.epoch);
        // 페이지 성공 때마다 복구 작업 cursor를 갱신해 중간 실패 뒤에도 같은 head부터 이어 간다.
        job.epoch = page.epoch;
        job.head = page.headSequence;
        for (const preview of page.previews) acceptPreview(preview, true);
        const previousCursor = job.cursor;
        job.cursor = page.nextSequence;
        if (BigInt(job.cursor) > BigInt(previousCursor)) {
          recoveryRetryAttempt = 0;
          initializationRestartCount = 0;
          recoveryOverflowCount = 0;
        }
        if (!page.hasMore) break;
      }
      recoveryJob = undefined;
      completed = true;
      if (!applyBuffered())
        throw new CanvasRequestError(
          'CANVAS_REPLAY_CAPACITY_REACHED',
          'Canvas replay reached the local memory limit. Reload to fetch a newer snapshot.'
        );
      const needsFreshHead = recoveryAgain || overflowedBuffers.has(job.epoch ?? '');
      overflowedBuffers.delete(job.epoch ?? '');
      if (needsFreshHead) {
        recoveryAgain = true;
        publish({ status: 'recovering', canDraw: false });
      } else {
        recoveryRetryAttempt = 0;
        initializationRestartCount = 0;
        recoveryOverflowCount = 0;
        publish({ status: 'ready', canDraw: drawingAllowed && !state.error });
        flush();
      }
    } catch (error) {
      if (!current(job.token)) return;
      const code = error instanceof CanvasRequestError ? error.code : 'ACK_TIMEOUT';
      if (code === 'SNAPSHOT_EPOCH_CHANGED') {
        recoveryJob = undefined;
        recoveryAgain = false;
        if (initializationRestartCount >= 3) {
          waitingForBase = false;
          publish({
            status: 'failed',
            canDraw: false,
            error: { code, message: 'Canvas changed repeatedly while restoring the snapshot.' },
          });
        } else {
          initializationRestartCount++;
          waitingForBase = true;
          restartBootstrap = true;
          publish({ status: 'recovering', canDraw: false });
        }
      } else if (
        [
          'RATE_LIMITED',
          'ACK_TIMEOUT',
          'DISCONNECTED',
          'CANVAS_CAPACITY_REACHED',
          'REALTIME_UNAVAILABLE',
        ].includes(code)
      ) {
        // 기능 플래그가 꺼진 기존 복구는 기존 1초 재시도를 유지한다.
        if (!snapshotEnabled && !recoveryTimer) {
          recoveryTimer = setTimeout(() => {
            recoveryTimer = undefined;
            void recover();
          }, 1000);
        } else if (snapshotEnabled && recoveryRetryAttempt >= BOOTSTRAP_RETRY_DELAYS.length) {
          recoveryJob = undefined;
          recoveryAgain = false;
          publish({
            status: 'failed',
            canDraw: false,
            error: {
              code,
              message:
                error instanceof Error ? error.message : 'Canvas recovery retry limit reached.',
            },
          });
        } else if (snapshotEnabled && !recoveryTimer) {
          const delay = BOOTSTRAP_RETRY_DELAYS[recoveryRetryAttempt];
          recoveryRetryAttempt++;
          recoveryTimer = setTimeout(() => {
            recoveryTimer = undefined;
            void recover();
          }, delay);
        }
      } else {
        recoveryJob = undefined;
        recoveryAgain = false;
        publish({
          status: 'failed',
          canDraw: false,
          error: {
            code,
            message: error instanceof Error ? error.message : 'Canvas recovery failed.',
          },
        });
      }
    } finally {
      if (current(job.token)) {
        recovering = false;
        if (restartBootstrap && socket) {
          restartBootstrap = false;
          const token = generation;
          startRecoveryInitialization(socket, token);
        } else if (completed) {
          // 고정 head 조회가 끝난 뒤 대기 중이던 gap·poll 요청을 최신 cursor로 한 번만 실행한다.
          const again = recoveryAgain;
          recoveryAgain = false;
          if (again) void recover();
          else if (state.status === 'ready') void flush();
        }
      }
    }
  }

  /** 준비 응답 후 먼저 서버 세대를 확인하고, 같은 사용자·세대의 미확인 묶음만 이어 보낸다. */
  function ready(connection: CanvasSocket, payload: CanvasReady) {
    if (payload.canvasKey !== canvasKey) return;
    interrupted();
    socket = connection;
    available = true;
    const userId = payload.viewer.status === 'authenticated' ? payload.viewer.userId : undefined;
    const sameUser = state.userId === userId;
    if (!sameUser && pending.size) clearPending();
    if (payload.canvasKey !== 'main') {
      target = { canvasKey, width: payload.season.width, height: payload.season.height };
      // 재연결 ready는 종료 상태도 새 sync로 확인하며 이전 프로세스 head는 폐기한다.
      terminalBoundary = undefined;
    }
    drawingAllowed =
      payload.canDraw &&
      userId !== undefined &&
      (payload.canvasKey === 'main' || payload.season.status === 'active');
    const error =
      sameUser &&
      (canvasKey === 'main'
        ? ['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED']
        : ['STROKE_LIMIT_REACHED']
      ).includes(state.error?.code ?? '')
        ? state.error
        : null;
    publish({
      userId,
      canDraw: drawingAllowed && !error,
      error,
      submissionStatus: sameUser ? state.submissionStatus : 'idle',
    });
    const token = generation;
    startRecoveryInitialization(connection, token);
    // 마지막 방송만 유실돼도 5초 이내에 현재 cursor부터 보완한다.
    pollTimer = setInterval(() => {
      if (state.status !== 'failed') void recover();
    }, 5000);
  }

  /** 128점과 UTF-8 8KB를 함께 지키며 이전 묶음의 마지막 점을 경계에 넣는다. */
  function nextRequest(item: PendingStroke) {
    if (item.request) return item.request;
    const from = item.sentPoints;
    if (from === item.stroke.points.length && !item.ended) return;
    let throughPoint = Math.min(
      item.stroke.points.length,
      from + APPEND_POINT_LIMIT - (from ? 1 : 0)
    );
    const brush = item.stroke.brush;
    const input: AppendStrokeInput = {
      clientStrokeId: item.stroke.clientStrokeId!,
      brush: {
        type: brush.brushType,
        size: brush.brushSize,
        color: brush.color.toUpperCase(),
        opacity: 1,
        version: 1,
        ...(brush.brushType === 'flat' ? { angle: item.stroke.angle ?? 0 } : {}),
        ...(brush.brushType === 'airbrush' ? { seed: item.stroke.seed ?? 0 } : {}),
      },
      chunkIndex: item.chunkIndex,
      points: [],
      isFinal: false,
    };
    do {
      // 종료 시 새 점이 없다면 중복 경계점도 보내지 않고 빈 final 묶음을 보낸다.
      input.points =
        throughPoint === from
          ? []
          : item.stroke.points
              .slice(from ? from - 1 : 0, throughPoint)
              .map(point => ({ ...point }));
      input.isFinal = item.ended && throughPoint === item.stroke.points.length;
      if (new TextEncoder().encode(JSON.stringify(input)).byteLength <= APPEND_BYTE_LIMIT) break;
      throughPoint--;
    } while (throughPoint > from);
    item.request = { input, throughPoint };
    return item.request;
  }

  /** ACK 대기 중에는 좌표만 모으고, 마지막 미확인 묶음의 동일한 데이터만 재전송한다. */
  async function flush() {
    // 포인터 종료와 새 입력도 BUSY·시간 초과의 재시도 대기 시간을 앞당기지 않는다.
    if (retryingAppend) return;
    clearTimeout(sendTimer);
    sendTimer = undefined;
    if (
      disposed ||
      !available ||
      !socket ||
      sending ||
      recovering ||
      state.status !== 'ready' ||
      state.error
    )
      return;
    const id = queue[0];
    const item = pending.get(id);
    if (!item) {
      if (id) {
        queue.shift();
        void flush();
      }
      return;
    }
    const request = nextRequest(item);
    if (!request) return;
    sending = true;
    const token = generation;
    try {
      const rateWait = waitForRate('append');
      if (rateWait) await rateWait;
      if (!current(token)) return;
      const response = await requestHandlers.append(socket, request.input, target);
      if (!current(token)) return;
      // 같은 요청에 대한 ACK가 아니면 로컬 전송 cursor를 진행하지 않는다.
      const preview = response.preview;
      const brushKeys = ['type', 'size', 'color', 'opacity', 'version', 'angle', 'seed'] as const;
      if (
        preview.clientStrokeId !== id ||
        preview.userId !== item.userId ||
        preview.chunkIndex !== request.input.chunkIndex ||
        // DB의 JSON 객체 키 순서는 달라질 수 있으므로 전송한 각 필드의 값을 비교한다.
        brushKeys.some(key => preview.brush[key] !== request.input.brush[key]) ||
        preview.points.length !== request.input.points.length ||
        preview.points.some((point, index) => {
          const sent = request.input.points[index];
          return point.x !== sent.x || point.y !== sent.y || point.t !== sent.t;
        }) ||
        preview.isFinal !== request.input.isFinal
      ) {
        throw new CanvasRequestError(
          'INVALID_RESPONSE',
          'Canvas acknowledgement does not match the request.'
        );
      }
      // accepted=false인 중복 ACK도 서버 승인이다. 첫 묶음의 승인부터 계정의 새 획을 막는다.
      if (request.input.chunkIndex === 0) usedAccounts.add(item.userId);
      // 다른 메모리 세대의 픽셀은 복구로 확인하지만 이미 승인된 사용 횟수는 되돌리지 않는다.
      if (preview.epoch !== state.epoch) {
        publish();
        void recover();
        return;
      }
      item.sentPoints = request.throughPoint;
      item.chunkIndex++;
      item.request = undefined;
      // ACK가 방송 적용보다 먼저 끝날 수 있어 snapshot 경계와 대조할 checkpoint를 보관한다.
      item.confirmedAcks.push({
        epoch: preview.epoch,
        sequence: preview.sequence,
        throughPoint: request.throughPoint,
        isFinal: request.input.isFinal,
      });
      // 마지막 성공 ACK만 전체 좌표의 저장 완료다. 복구의 final preview와 별도로 기록한다.
      if (request.input.isFinal) {
        item.finalAcknowledged = true;
        queue.shift();
      }
      if (BigInt(preview.sequence) <= BigInt(state.lastAppliedSequence))
        settleConfirmedAcks(id, item, preview.epoch, state.lastAppliedSequence);
      else acceptPreview(preview);
      if (request.input.isFinal && item.finalApplied) pending.delete(id);
      publish({
        retry: null,
        submissionStatus: request.input.isFinal ? 'saved' : state.submissionStatus,
      });
    } catch (error) {
      if (!current(token)) return;
      const code = error instanceof CanvasRequestError ? error.code : 'ACK_TIMEOUT';
      if (
        [
          'ACK_TIMEOUT',
          'RATE_LIMITED',
          'DISCONNECTED',
          'STROKE_BUSY',
          'CANVAS_CAPACITY_REACHED',
          'REALTIME_UNAVAILABLE',
        ].includes(code)
      ) {
        // 저장 대기열 초과·일시 저장 장애도 요청 객체와 번호를 그대로 남겨 1초 후 재시도한다.
        publish({
          retry: {
            code,
            message: error instanceof Error ? error.message : 'Canvas retry pending.',
          },
        });
        clearTimeout(sendTimer);
        retryingAppend = true;
        sendTimer = setTimeout(() => {
          sendTimer = undefined;
          retryingAppend = false;
          void flush();
        }, 1000);
      } else {
        // 시즌의 이미 등록된 획 ID는 계정 전체 한도와 다르다. 그 요청을 끝내고 서버 그림을 복구한다.
        if (canvasKey !== 'main' && code === 'STROKE_ALREADY_USED') {
          clearPending();
          publish({
            status: 'recovering',
            error: null,
            retry: null,
            canDraw: false,
            submissionStatus: 'idle',
          });
          void recover();
          return;
        }
        // 획 제한이나 과거 획 거절도 계정의 사용 확정이므로 ready.canDraw로 다시 풀지 않는다.
        if (['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED'].includes(code))
          usedAccounts.add(item.userId);
        if (code === 'STROKE_LIMIT_REACHED') exhaustedAccounts.add(item.userId);
        // 영구 거절은 이전 확정 그림을 남긴 채 미확정 전송만 중단한다.
        stopTransmission(
          code,
          error instanceof Error ? error.message : 'Canvas submission failed.'
        );
        // 새로고침 후 사용 여부를 처음 확인한 거절은 그리기 시도에 대한 모달로 안내한다.
        if (code === 'STROKE_LIMIT_REACHED') onStrokeLimitAttempt();
      }
    } finally {
      if (current(token)) {
        sending = false;
        // 종료 묶음과 이미 가득 찬 묶음은 ACK 다음에 바로 처리한다.
        if (!sendTimer && !state.error && queue.length) {
          const next = pending.get(queue[0]);
          if (
            next?.ended ||
            (next && next.stroke.points.length - next.sentPoints >= APPEND_POINT_LIMIT)
          )
            void flush();
          else scheduleSend();
        }
      }
    }
  }

  function scheduleSend() {
    if (!sendTimer && available)
      sendTimer = setTimeout(() => {
        sendTimer = undefined;
        void flush();
      }, 50);
  }

  /** 초기 복구·인증·횟수 검사를 모두 통과한 계정만 새 획을 시작한다. */
  function canStartStroke() {
    // 이미 승인된 계정의 새 획 시도는 전송 전에 막고, 완료 직후와 구분해 알림을 요청한다.
    if (!disposed && state.strokeUsed) {
      onStrokeLimitAttempt();
      return false;
    }
    return (
      !disposed &&
      available &&
      state.status === 'ready' &&
      state.canDraw &&
      pending.size === 0 &&
      !state.error &&
      state.userId !== undefined
    );
  }

  /** 종료 입력을 끊고 승인된 부분 획을 이벤트의 head까지 복구한다. */
  function seasonState(event: SeasonStateEvent) {
    if (event.canvasKey !== canvasKey || disposed || !available) return;
    // active 이벤트에는 개인 권한이 없으므로 기존 false를 true로 바꾸지 않는다.
    if (event.status === 'active') return;
    drawingAllowed = false;
    terminalBoundary = { epoch: event.epoch, head: event.headSequence };
    clearPending();
    publish({ canDraw: false, submissionStatus: 'idle' });
    // 진행 중인 이전 head 조회가 끝나면 최종 head를 대상으로 다시 조회한다.
    recoveryAgain = recovering || Boolean(recoveryTimer);
    if (!recovering && !recoveryTimer) recoveryJob = undefined;
    void recover();
  }

  /** 새 세션에는 같은 사용자라도 이전 쿠키의 미확정 전송을 넘기지 않는다. */
  function resetSession() {
    interrupted();
    clearPending();
    publish({ userId: undefined, canDraw: false, error: null, submissionStatus: 'idle' });
  }

  /** 자동 복구 한도에 도달한 뒤 사용자가 현재 연결에서 새 기준을 다시 요청한다. */
  function retryRecovery() {
    if (!available || !socket || state.status !== 'failed') return;
    if (!canRetryCanvasRecovery(state.error?.code)) return;
    bootstrapRetryAttempt = 0;
    recoveryRetryAttempt = 0;
    initializationRestartCount = 0;
    recoveryOverflowCount = 0;
    recoveryJob = undefined;
    recoveryAgain = false;
    publish({ status: 'recovering', canDraw: false, error: null });
    if (snapshotEnabled) startRecoveryInitialization(socket, generation);
    else void recover();
  }

  const transport: CanvasDrawingTransport = {
    start(stroke) {
      // UUID가 없는 입력 또는 준비되지 않은 계정은 전송 대기에 넣지 않는다.
      if (!stroke.clientStrokeId || !canStartStroke()) return false;
      pending.set(stroke.clientStrokeId, {
        stroke: {
          ...stroke,
          brush: { ...stroke.brush },
          points: stroke.points.map(point => ({ ...point })),
        },
        userId: state.userId!,
        sentPoints: 0,
        acknowledgedPoints: 0,
        chunkIndex: 0,
        ended: false,
        finalApplied: false,
        finalAcknowledged: false,
        confirmedAcks: [],
      });
      queue.push(stroke.clientStrokeId);
      publish({ submissionStatus: 'drawing', retry: null });
      // 첫 좌표는 즉시 제출하고, 이후 좌표만 50ms 단위로 모은다.
      void flush();
      return true;
    },
    move(id, points) {
      const item = pending.get(id);
      if (!item || item.ended || !available || state.error) return;
      if (item.stroke.points.length + points.length > MAX_LOCAL_STROKE_POINTS) {
        rejectLocalCapacity();
        return;
      }
      item.stroke.points.push(...points.map(point => ({ ...point })));
      publish();
      scheduleSend();
    },
    finish(id) {
      const item = pending.get(id);
      if (!item) return;
      item.ended = true;
      publish({ submissionStatus: 'saving' });
      void flush();
    },
    cancel(id) {
      const item = pending.get(id);
      if (!item) return;
      // 미확인 요청은 이미 서버가 받았을 수 있다. 그 범위까지만 남기고 종료한다.
      const keep = item.request?.throughPoint ?? item.sentPoints;
      if (!keep) {
        pending.delete(id);
        const index = queue.indexOf(id);
        if (index >= 0) queue.splice(index, 1);
      } else {
        item.stroke.points = item.stroke.points.slice(0, keep);
        item.ended = true;
      }
      publish({ submissionStatus: keep ? 'saving' : 'idle' });
      void flush();
    },
  };

  return {
    canStartStroke,
    rejectLocalCapacity,
    ready,
    interrupted,
    acceptPreview,
    recover,
    seasonState,
    resetSession,
    retryRecovery,
    transport,
    /** 화면 이탈 뒤에는 타이머와 이전 연결의 응답이 상태를 갱신하지 않는다. */
    dispose() {
      interrupted();
      disposed = true;
      pending.clear();
      buffers.clear();
      bufferBytes.clear();
      overflowedBuffers.clear();
      // React가 이전 상태를 한 프레임 더 참조할 수 있으므로 현재 이미지도 렌더 이후에 해제한다.
      retireSnapshot(state.snapshotBase);
      state.snapshotBase = null;
    },
  };
}
