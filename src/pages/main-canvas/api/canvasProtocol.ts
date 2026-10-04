/** 서버 버전 1의 원본 좌표·브러시·ACK 계약이다. UI의 불투명도 설정과는 분리한다. */
export interface StrokePoint {
  x: number;
  y: number;
  t?: number;
}

export interface StrokeBrush {
  type: 'round' | 'flat' | 'airbrush';
  size: number;
  color: string;
  opacity: number;
  version: 1;
  angle?: number;
  seed?: number;
}

export interface AppendStrokeInput {
  clientStrokeId: string;
  brush: StrokeBrush;
  chunkIndex: number;
  points: StrokePoint[];
  isFinal: boolean;
}

export interface StrokePreview extends AppendStrokeInput {
  canvasKey: 'main';
  userId: string;
  epoch: string;
  sequence: string;
}

export interface AppendStrokeResult {
  /** false도 이미 승인된 동일 묶음의 성공 ACK이며, final 성공은 전체 획의 저장 완료다. */
  accepted: boolean;
  preview: StrokePreview;
}

export interface SyncCanvasInput {
  epoch?: string;
  afterSequence: string;
  throughSequence?: string;
  limit?: number;
}

export interface CanvasSyncPage {
  canvasKey: 'main';
  epoch: string;
  reset: boolean;
  previews: StrokePreview[];
  headSequence: string;
  nextSequence: string;
  hasMore: boolean;
}

export type CanvasAck<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
export type CanvasAckCallback<T> = (response: CanvasAck<T>) => void;

export const APPEND_POINT_LIMIT = 128;
export const APPEND_BYTE_LIMIT = 8192;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** bigint 순서를 문자열로 검사해 자바스크립트 숫자의 정밀도 손실을 피한다. */
export function isSequence(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(0|[1-9][0-9]{0,18})$/.test(value) &&
    BigInt(value) <= 9223372036854775807n
  );
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** 지원하는 브러시와 좌표 묶음만 렌더러에 전달한다. */
export function isStrokePreview(value: unknown): value is StrokePreview {
  if (
    !isRecord(value) ||
    value.canvasKey !== 'main' ||
    typeof value.epoch !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(value.epoch) ||
    !isSequence(value.sequence) ||
    value.sequence === '0' ||
    typeof value.userId !== 'string' ||
    !value.userId ||
    typeof value.clientStrokeId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(value.clientStrokeId) ||
    !Number.isInteger(value.chunkIndex) ||
    !finite(value.chunkIndex, 0, 1_000_000) ||
    typeof value.isFinal !== 'boolean' ||
    !isRecord(value.brush) ||
    !Array.isArray(value.points) ||
    value.points.length > APPEND_POINT_LIMIT ||
    (!value.isFinal && !value.points.length)
  )
    return false;
  const brush = value.brush;
  if (
    !['round', 'flat', 'airbrush'].includes(String(brush.type)) ||
    brush.version !== 1 ||
    !finite(brush.size, 1, 200) ||
    !finite(brush.opacity, 0.01, 1) ||
    typeof brush.color !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(brush.color) ||
    (brush.type === 'flat' && !finite(brush.angle, 0, 360)) ||
    (brush.type === 'airbrush' &&
      (!finite(brush.seed, 0, 4294967295) || !Number.isInteger(brush.seed)))
  )
    return false;
  let lastTime = -1;
  for (const point of value.points) {
    if (
      !isRecord(point) ||
      !finite(point.x, 0, 10000) ||
      point.x >= 10000 ||
      !finite(point.y, 0, 10000) ||
      point.y >= 10000
    )
      return false;
    if (brush.type === 'airbrush' || point.t !== undefined) {
      if (!finite(point.t, 0, 3_600_000) || point.t < lastTime) return false;
      lastTime = point.t;
    }
  }
  return true;
}

/** 복구 페이지 안의 순서가 연속이고 동일 세대인지 확인한다. */
export function isCanvasSyncPage(value: unknown): value is CanvasSyncPage {
  if (
    !isRecord(value) ||
    value.canvasKey !== 'main' ||
    typeof value.epoch !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(value.epoch) ||
    typeof value.reset !== 'boolean' ||
    typeof value.hasMore !== 'boolean' ||
    !isSequence(value.headSequence) ||
    !isSequence(value.nextSequence) ||
    !Array.isArray(value.previews) ||
    value.previews.length > 100 ||
    BigInt(value.nextSequence) > BigInt(value.headSequence)
  )
    return false;
  let previous: bigint | undefined;
  for (const preview of value.previews) {
    if (
      !isStrokePreview(preview) ||
      preview.epoch !== value.epoch ||
      (previous !== undefined && BigInt(preview.sequence) !== previous + 1n)
    )
      return false;
    previous = BigInt(preview.sequence);
  }
  return (
    (previous === undefined || previous === BigInt(value.nextSequence)) &&
    value.hasMore === BigInt(value.nextSequence) < BigInt(value.headSequence)
  );
}
