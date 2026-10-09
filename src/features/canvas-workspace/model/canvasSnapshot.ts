import rendererManifest from '../capture/manifest-source.json';
import {
  isRecord,
  type CanvasBootstrapSnapshot,
  type CanvasTarget,
  type StrokeBrush,
} from '../api/canvasProtocol';
import type { BrushStrokeState } from '../lib/drawBrushStroke';

const IMAGE_BYTE_LIMIT = 64 * 1024 * 1024;
const CONTINUATION_BYTE_LIMIT = 8 * 1024 * 1024;
const CONTINUATION_STROKE_LIMIT = 10_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CANVAS_RENDERER_VERSION = rendererManifest.rendererVersion;

export interface CanvasContinuationStroke {
  userId: string;
  clientStrokeId: string;
  lastChunkIndex: number;
  brush: StrokeBrush;
  state: BrushStrokeState;
}

export interface CanvasSnapshotBase {
  snapshotId: string;
  throughSequence: string;
  rendererVersion: string;
  image: ImageBitmap;
  strokes: CanvasContinuationStroke[];
}

function finite(value: unknown, minimum: number, maximum: number): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
  );
}

function isBrush(value: unknown): value is StrokeBrush {
  if (!isRecord(value)) return false;
  return (
    ['round', 'flat', 'airbrush'].includes(String(value.type)) &&
    value.version === 1 &&
    finite(value.size, 1, 200) &&
    finite(value.opacity, 0.01, 1) &&
    typeof value.color === 'string' &&
    /^#[0-9a-f]{6}$/i.test(value.color) &&
    (value.type !== 'flat' || finite(value.angle, 0, 360)) &&
    (value.type !== 'airbrush' ||
      (finite(value.seed, 0, 4294967295) && Number.isInteger(value.seed)))
  );
}

function isContinuationState(
  value: unknown,
  width: number,
  height: number
): value is BrushStrokeState {
  if (
    !isRecord(value) ||
    !finite(value.progress, 0, Number.MAX_SAFE_INTEGER) ||
    !Number.isInteger(value.sampleIndex) ||
    !finite(value.sampleIndex, 0, Number.MAX_SAFE_INTEGER)
  )
    return false;
  if (value.lastPoint === null) return true;
  if (!isRecord(value.lastPoint)) return false;
  return (
    finite(value.lastPoint.x, 0, width) &&
    value.lastPoint.x < width &&
    finite(value.lastPoint.y, 0, height) &&
    value.lastPoint.y < height &&
    (value.lastPoint.t === undefined || finite(value.lastPoint.t, 0, 3_600_000))
  );
}

function readContinuation(
  bytes: Uint8Array,
  snapshot: CanvasBootstrapSnapshot,
  target: CanvasTarget
): CanvasContinuationStroke[] {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Canvas continuation file is invalid JSON.');
  }
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    value.snapshotId !== snapshot.snapshotId ||
    value.canvasKey !== target.canvasKey ||
    value.throughSequence !== snapshot.throughSequence ||
    value.rendererVersion !== snapshot.rendererVersion ||
    !Array.isArray(value.strokes) ||
    value.strokes.length > CONTINUATION_STROKE_LIMIT
  )
    throw new Error('Canvas continuation metadata is invalid.');

  const keys = new Set<string>();
  const strokes: CanvasContinuationStroke[] = [];
  for (const item of value.strokes) {
    if (
      !isRecord(item) ||
      typeof item.userId !== 'string' ||
      !item.userId ||
      typeof item.clientStrokeId !== 'string' ||
      !UUID_PATTERN.test(item.clientStrokeId) ||
      !Number.isInteger(item.lastChunkIndex) ||
      !finite(item.lastChunkIndex, 0, 1_000_000) ||
      !isBrush(item.brush) ||
      !isContinuationState(item.state, target.width, target.height)
    )
      throw new Error('Canvas continuation stroke is invalid.');
    const key = JSON.stringify([item.userId, item.clientStrokeId]);
    if (keys.has(key)) throw new Error('Canvas continuation contains a duplicate stroke.');
    keys.add(key);
    strokes.push({
      userId: item.userId,
      clientStrokeId: item.clientStrokeId,
      lastChunkIndex: item.lastChunkIndex,
      brush: { ...item.brush },
      state: {
        ...item.state,
        lastPoint: item.state.lastPoint ? { ...item.state.lastPoint } : null,
      },
    });
  }
  return strokes;
}

function allowedSnapshotUrl(value: string) {
  const url = new URL(value, window.location.origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash)
    throw new Error('Canvas snapshot URL is invalid.');
  const configuredOrigins = [
    window.location.origin,
    import.meta.env.VITE_BACKEND_ORIGIN,
    import.meta.env.VITE_CANVAS_SNAPSHOT_ORIGIN,
  ]
    .filter(Boolean)
    .map(origin => new URL(origin).origin);
  if (!configuredOrigins.includes(url.origin))
    throw new Error('Canvas snapshot URL origin is not allowed.');
  return url.toString();
}

async function readLimited(response: Response, maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.ok) throw new Error(`Canvas snapshot download failed (${response.status}).`);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximum)
    throw new Error('Canvas snapshot file is too large.');
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximum) throw new Error('Canvas snapshot file is too large.');
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new Error('Canvas snapshot file is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function sha256(bytes: Uint8Array<ArrayBuffer>) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function download(url: string, maximum: number, signal: AbortSignal) {
  return readLimited(
    await fetch(allowedSnapshotUrl(url), { credentials: 'omit', signal }),
    maximum
  );
}

/** 공개된 PNG와 continuation을 모두 검증한 뒤 화면에 원자적으로 넘길 기준을 만든다. */
export async function loadCanvasSnapshot(
  snapshot: CanvasBootstrapSnapshot,
  target: CanvasTarget,
  parentSignal: AbortSignal
): Promise<CanvasSnapshotBase> {
  if (
    snapshot.rendererVersion !== CANVAS_RENDERER_VERSION ||
    snapshot.width !== target.width ||
    snapshot.height !== target.height
  )
    throw new Error('Canvas snapshot is incompatible with this renderer.');
  const controller = new AbortController();
  const abort = () => controller.abort(parentSignal.reason);
  if (parentSignal.aborted) abort();
  else parentSignal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort('snapshot timeout'), DOWNLOAD_TIMEOUT_MS);
  let image: ImageBitmap | undefined;
  try {
    const [imageBytes, continuationBytes] = await Promise.all([
      download(snapshot.imageUrl, IMAGE_BYTE_LIMIT, controller.signal),
      download(snapshot.continuationStateUrl, CONTINUATION_BYTE_LIMIT, controller.signal),
    ]);
    const [imageHash, continuationHash] = await Promise.all([
      sha256(imageBytes),
      sha256(continuationBytes),
    ]);
    if (imageHash !== snapshot.imageSha256 || continuationHash !== snapshot.continuationStateSha256)
      throw new Error('Canvas snapshot hash does not match.');
    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (pngSignature.some((byte, index) => imageBytes[index] !== byte))
      throw new Error('Canvas snapshot image is not a PNG.');
    const strokes = readContinuation(continuationBytes, snapshot, target);
    image = await createImageBitmap(new Blob([imageBytes], { type: 'image/png' }));
    if (image.width !== target.width || image.height !== target.height)
      throw new Error('Canvas snapshot image dimensions do not match.');
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return {
      snapshotId: snapshot.snapshotId,
      throughSequence: snapshot.throughSequence,
      rendererVersion: snapshot.rendererVersion,
      image,
      strokes,
    };
  } catch (error) {
    image?.close();
    controller.abort();
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal.removeEventListener('abort', abort);
  }
}

export function releaseCanvasSnapshot(snapshot: CanvasSnapshotBase | null | undefined) {
  snapshot?.image.close();
}

/** 첫 배포는 coarse pointer 모바일을 제외하고 검증 API를 지원하는 브라우저만 이미지 경로를 쓴다. */
export function canLoadCanvasSnapshot() {
  return (
    typeof window !== 'undefined' &&
    typeof createImageBitmap === 'function' &&
    typeof crypto !== 'undefined' &&
    typeof crypto.subtle?.digest === 'function' &&
    window.matchMedia?.('(pointer: coarse)').matches !== true
  );
}
