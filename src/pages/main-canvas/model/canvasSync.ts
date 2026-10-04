import type { CanvasSocket, CanvasReady } from '../api/canvasSocket';
import { appendStroke, syncCanvas, CanvasRequestError } from '../api/canvasRequests';
import {
  APPEND_BYTE_LIMIT,
  APPEND_POINT_LIMIT,
  isStrokePreview,
  type AppendStrokeInput,
  type StrokePreview,
  type SyncCanvasInput,
} from '../api/canvasProtocol';
import type { CanvasDrawingTransport, CanvasStroke } from './useCanvasDrawing';

export const MAX_LOCAL_STROKE_POINTS = 100_000;

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
  requests = { append: appendStroke, sync: syncCanvas },
  onLiveInputInterrupted: () => void = () => {},
  onStrokeLimitAttempt: () => void = () => {}
) {
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
  let recoveryJob: RecoveryJob | undefined;
  const pending = new Map<string, PendingStroke>();
  const queue: string[] = [];
  const buffers = new Map<string, Map<string, StrokePreview>>();
  // 사용 확정은 연결·그림 epoch와 별개로 보관해 재접속이나 계정 전환으로 횟수를 돌려주지 않는다.
  const usedAccounts = new Set<string>();

  /** 입력 배열을 복사해 진행 중인 입력이 과거의 화면 스냅샷을 바꾸지 않게 한다. */
  function publish(patch: Partial<CanvasSyncState> = {}) {
    if (disposed) return;
    const next = { ...state, ...patch };
    const strokeUsed = next.userId !== undefined && usedAccounts.has(next.userId);
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

  /** 현재 세대에서 연속된 방송만 적용하고, 누락된 순서 다음 좌표는 버퍼에 남긴다. */
  function applyBuffered() {
    if (!state.epoch) return;
    const buffer = buffers.get(state.epoch);
    if (!buffer) return;
    const applied: StrokePreview[] = [];
    let cursor = BigInt(state.lastAppliedSequence);
    while (buffer.has(String(cursor + 1n))) {
      const preview = buffer.get(String(++cursor))!;
      buffer.delete(preview.sequence);
      applied.push(preview);
      // 본인의 ACK도 같은 순서로 반영한 뒤 로컬 즉시 표시의 중복 부분을 제외한다.
      const item = pending.get(preview.clientStrokeId);
      if (item?.userId === preview.userId) {
        item.acknowledgedPoints +=
          preview.chunkIndex === 0 ? preview.points.length : Math.max(0, preview.points.length - 1);
        item.finalApplied ||= preview.isFinal;
        // 복구가 final을 먼저 찾아도 마지막 ACK를 받을 때까지 동일 요청의 재시도를 유지한다.
        if (item.finalApplied && item.finalAcknowledged && item.ended)
          pending.delete(preview.clientStrokeId);
      }
    }
    if (applied.length)
      publish({ previews: [...state.previews, ...applied], lastAppliedSequence: String(cursor) });
  }

  /** 방송·ACK·복구 페이지를 같은 입구에서 중복 제거한다. */
  function acceptPreview(payload: unknown) {
    if (disposed || !available) return;
    if (!isStrokePreview(payload)) {
      publish({
        status: 'failed',
        canDraw: false,
        error: { code: 'INVALID_RESPONSE', message: 'Canvas preview is invalid.' },
      });
      return;
    }
    const preview = payload;
    if (
      preview.epoch === state.epoch &&
      BigInt(preview.sequence) <= BigInt(state.lastAppliedSequence)
    )
      return;
    let buffer = buffers.get(preview.epoch);
    if (!buffer) {
      buffer = new Map();
      buffers.set(preview.epoch, buffer);
    }
    if (!buffer.has(preview.sequence)) buffer.set(preview.sequence, preview);
    applyBuffered();
    // 세대가 다르거나 순서가 비면 마지막으로 연속 반영한 순서부터 복구한다.
    if (
      preview.epoch !== state.epoch ||
      BigInt(preview.sequence) > BigInt(state.lastAppliedSequence) + 1n
    ) {
      void recover();
    }
  }

  /** 재시작으로 세대가 바뀌면 이전 그림·전송 대기·커서를 함께 지운다. */
  function resetEpoch(epoch: string) {
    if (state.epoch === epoch) return;
    clearPending();
    for (const key of buffers.keys()) if (key !== epoch) buffers.delete(key);
    publish({
      epoch,
      previews: [],
      lastAppliedSequence: '0',
      resetVersion: state.resetVersion + 1,
      retry: null,
      submissionStatus: 'idle',
      // 사용 제한 오류와 계정의 차감은 저장된 그림의 새 세대에서도 유지한다.
      error: ['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED'].includes(state.error?.code ?? '')
        ? state.error
        : null,
      canDraw: drawingAllowed,
    });
  }

  /** 현재 연결만 응답을 반영하게, 끊길 때 비동기 작업의 세대를 변경한다. */
  function interrupted() {
    if (disposed) return;
    generation++;
    available = false;
    socket = undefined;
    sending = false;
    retryingAppend = false;
    recovering = false;
    recoveryAgain = false;
    recoveryJob = undefined;
    // 끊기기 전의 미확인 묶음과 좌표는 보관하되 새 오프라인 입력은 같은 획에 섞지 않는다.
    for (const item of pending.values()) item.ended = true;
    onLiveInputInterrupted();
    clearTimeout(sendTimer);
    sendTimer = undefined;
    clearTimeout(recoveryTimer);
    recoveryTimer = undefined;
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

  /** 한 번에 복구 하나만 실행하고, 첫 페이지의 head를 고정해 조회 중 방송과 합친다. */
  async function recover() {
    if (disposed || !available || !socket) return;
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
            cursor: state.lastAppliedSequence,
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
        const page = await requests.sync(job.connection, input);
        if (!current(job.token)) return;
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
        for (const preview of page.previews) acceptPreview(preview);
        job.cursor = page.nextSequence;
        if (!page.hasMore) break;
      }
      recoveryJob = undefined;
      completed = true;
      publish({ status: 'ready' });
      flush();
    } catch (error) {
      if (!current(job.token)) return;
      const code = error instanceof CanvasRequestError ? error.code : 'ACK_TIMEOUT';
      if (['RATE_LIMITED', 'ACK_TIMEOUT', 'DISCONNECTED', 'REALTIME_UNAVAILABLE'].includes(code)) {
        // 일시 실패는 고정 head와 현재 cursor를 보관하고, 타이머 하나로 같은 페이지를 재시도한다.
        if (!recoveryTimer)
          recoveryTimer = setTimeout(() => {
            recoveryTimer = undefined;
            void recover();
          }, 1000);
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
        // 고정 head 조회가 끝난 뒤 대기 중이던 gap·poll 요청을 최신 cursor로 한 번만 실행한다.
        if (completed) {
          const again = recoveryAgain;
          recoveryAgain = false;
          if (again && state.status !== 'failed') void recover();
          else if (state.status === 'ready') void flush();
        }
      }
    }
  }

  /** 준비 응답 후 먼저 서버 세대를 확인하고, 같은 사용자·세대의 미확인 묶음만 이어 보낸다. */
  function ready(connection: CanvasSocket, payload: CanvasReady) {
    interrupted();
    socket = connection;
    available = true;
    const userId = payload.viewer.status === 'authenticated' ? payload.viewer.userId : undefined;
    const sameUser = state.userId === userId;
    if (!sameUser && pending.size) clearPending();
    drawingAllowed = payload.canDraw && userId !== undefined;
    const error =
      sameUser && ['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED'].includes(state.error?.code ?? '')
        ? state.error
        : null;
    publish({
      userId,
      canDraw: drawingAllowed && !error,
      error,
      submissionStatus: sameUser ? state.submissionStatus : 'idle',
    });
    void recover();
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
      const response = await requests.append(socket, request.input);
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
      // 마지막 성공 ACK만 전체 좌표의 저장 완료다. 복구의 final preview와 별도로 기록한다.
      if (request.input.isFinal) {
        item.finalAcknowledged = true;
        queue.shift();
      }
      acceptPreview(preview);
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
        // 획 제한이나 과거 획 거절도 계정의 사용 확정이므로 ready.canDraw로 다시 풀지 않는다.
        if (['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED'].includes(code))
          usedAccounts.add(item.userId);
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
    transport,
    /** 화면 이탈 뒤에는 타이머와 이전 연결의 응답이 상태를 갱신하지 않는다. */
    dispose() {
      interrupted();
      disposed = true;
      pending.clear();
      buffers.clear();
    },
  };
}
