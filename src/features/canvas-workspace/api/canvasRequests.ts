import type { CanvasSocket } from './canvasSocket';
import {
  isRecord,
  isCanvasBootstrapPayload,
  isStrokePreview,
  isCanvasSyncPage,
  type AppendStrokeInput,
  type AppendStrokeResult,
  type BootstrapCanvasInput,
  type CanvasBootstrapPayload,
  type CanvasSyncPage,
  type SyncCanvasInput,
  MAIN_CANVAS_TARGET,
  type CanvasTarget,
} from './canvasProtocol';

export class CanvasRequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** ACK 시간 초과와 서버의 명시적인 거절을 구분해 재전송 정책에 전달한다. */
function readAck(response: unknown): unknown {
  if (!isRecord(response) || typeof response.ok !== 'boolean') {
    throw new CanvasRequestError('INVALID_RESPONSE', 'Canvas response is invalid.');
  }
  if (!response.ok) {
    if (
      !isRecord(response.error) ||
      typeof response.error.code !== 'string' ||
      typeof response.error.message !== 'string'
    ) {
      throw new CanvasRequestError('INVALID_RESPONSE', 'Canvas response is invalid.');
    }
    throw new CanvasRequestError(response.error.code, response.error.message);
  }
  return response.data;
}

/** 접속 중일 때만 전송해 Socket.IO의 오프라인 기본 버퍼를 사용하지 않는다. */
export async function appendStroke(
  socket: CanvasSocket,
  input: AppendStrokeInput,
  target: CanvasTarget = MAIN_CANVAS_TARGET
): Promise<AppendStrokeResult> {
  if (!socket.connected) throw new CanvasRequestError('DISCONNECTED', 'Canvas is disconnected.');
  let response: unknown;
  try {
    response = await socket.timeout(5000).emitWithAck('stroke:append', input);
  } catch {
    throw new CanvasRequestError('ACK_TIMEOUT', 'Canvas acknowledgement timed out.');
  }
  const data = readAck(response);
  if (
    !isRecord(data) ||
    typeof data.accepted !== 'boolean' ||
    !isStrokePreview(data.preview, target)
  ) {
    throw new CanvasRequestError('INVALID_RESPONSE', 'Canvas append response is invalid.');
  }
  return data as unknown as AppendStrokeResult;
}

/** 저장된 그림과 아직 저장되지 않은 좌표를 페이지로 읽고, 검증된 순서만 복구 모델에 넘긴다. */
export async function syncCanvas(
  socket: CanvasSocket,
  input: SyncCanvasInput,
  target: CanvasTarget = MAIN_CANVAS_TARGET
): Promise<CanvasSyncPage> {
  if (!socket.connected) throw new CanvasRequestError('DISCONNECTED', 'Canvas is disconnected.');
  let response: unknown;
  try {
    response = await socket.timeout(5000).emitWithAck('canvas:sync', input);
  } catch {
    throw new CanvasRequestError('ACK_TIMEOUT', 'Canvas acknowledgement timed out.');
  }
  const data = readAck(response);
  if (!isCanvasSyncPage(data, target))
    throw new CanvasRequestError('INVALID_RESPONSE', 'Canvas sync response is invalid.');
  return data;
}

/** snapshot 선호 여부와 렌더러 버전을 전달해 복구 시작 경계를 조회한다. */
export async function bootstrapCanvas(
  socket: CanvasSocket,
  input: BootstrapCanvasInput,
  target: CanvasTarget = MAIN_CANVAS_TARGET
): Promise<CanvasBootstrapPayload> {
  if (!socket.connected) throw new CanvasRequestError('DISCONNECTED', 'Canvas is disconnected.');
  let response: unknown;
  try {
    response = await socket.timeout(5000).emitWithAck('canvas:bootstrap', input);
  } catch {
    throw new CanvasRequestError('ACK_TIMEOUT', 'Canvas acknowledgement timed out.');
  }
  const data = readAck(response);
  if (!isCanvasBootstrapPayload(data, target))
    throw new CanvasRequestError('INVALID_RESPONSE', 'Canvas bootstrap response is invalid.');
  return data;
}
