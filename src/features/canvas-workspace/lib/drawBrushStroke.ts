import type { CanvasPoint } from './canvasTransform';
import type { CanvasStroke } from '../model/useCanvasDrawing';

/** 획을 원본 좌표로 그린다. 화면 배율과 도화지 clipping은 호출자가 적용한다. */
export function drawBrushStroke(
  context: CanvasRenderingContext2D,
  stroke: CanvasStroke,
  pixelScale = 1,
  state?: BrushStrokeState,
  paint = true
) {
  // 공유 획은 청크 사이의 점·분사 순번을 이어 받아 같은 기본 도형을 재생한다.
  if (state) {
    drawSharedStroke(context, stroke, pixelScale, state, paint);
    return;
  }
  const { brush, points } = stroke;
  // 빈 획은 그릴 점이 없으므로 컨텍스트를 바꾸지 않는다.
  if (!points.length) return;
  const radius = brush.brushSize / 2;
  context.fillStyle = brush.color;
  context.strokeStyle = brush.color;
  context.lineWidth = brush.brushSize;
  context.lineCap = brush.brushType === 'flat' ? 'square' : 'round';
  context.lineJoin = brush.brushType === 'flat' ? 'bevel' : 'round';

  // 기기 픽셀보다 작은 에어브러쉬는 연속 경로의 안티앨리어싱으로 표시한다.
  // 보이는 크기의 에어브러쉬만 그라데이션을 찍고, 간격은 최소 0.5 기기 픽셀로 제한한다.
  if (brush.brushType === 'airbrush' && brush.brushSize * pixelScale >= 1) {
    const spacing = Math.max(brush.brushSize / 4, 0.5 / pixelScale);
    let untilNext = spacing;
    /** 그라데이션의 가장자리는 투명하게 만들어 원형 브러쉬와 다른 부드러운 윤곽을 표시한다. */
    function stamp(point: CanvasPoint) {
      const gradient = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius);
      gradient.addColorStop(0, brush.color);
      gradient.addColorStop(1, `${brush.color}00`);
      context.fillStyle = gradient;
      context.fillRect(point.x - radius, point.y - radius, brush.brushSize, brush.brushSize);
    }
    stamp(points[0]);
    for (let index = 1; index < points.length; index++) {
      const from = points[index - 1];
      const to = points[index];
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      // 중복 점은 거리와 간격을 소비하지 않는다.
      if (!length) continue;
      let distance = untilNext;
      while (distance <= length) {
        const ratio = distance / length;
        stamp({ x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio });
        distance += spacing;
      }
      untilNext = distance - length;
    }
    return;
  }

  // 이동 없는 클릭은 stroke가 표시하지 못하므로 브러쉬 크기의 원 또는 네모를 직접 그린다.
  if (points.length === 1) {
    const { x, y } = points[0];
    if (brush.brushType === 'flat') {
      context.fillRect(x - radius, y - radius, brush.brushSize, brush.brushSize);
    } else {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    return;
  }

  // 모든 점을 한 경로로 그려 선분 사이의 이음새를 만들지 않는다.
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.stroke();
}

export interface BrushStrokeState {
  lastPoint: (CanvasPoint & { t?: number }) | null;
  progress: number;
  sampleIndex: number;
}

/** 청크 경계와 무관한 마지막 점과 분사 순번을 새 획에 할당한다. */
export function createBrushStrokeState(): BrushStrokeState {
  return { lastPoint: null, progress: 0, sampleIndex: 0 };
}

/** 서버가 확인한 상태를 복사해 낙관적 미확인 구간이 서버 캐시를 바꾸지 않도록 한다. */
export function cloneBrushStrokeState(state: BrushStrokeState): BrushStrokeState {
  return { ...state, lastPoint: state.lastPoint ? { ...state.lastPoint } : null };
}

/** seed와 분사 순번만으로 난수를 만들어 프레임 및 청크 재생 순서의 영향을 없앤다. */
function sampleRandom(seed: number, index: number, salt: number) {
  let value = (seed ^ Math.imul(index + 1, 0x9e3779b1) ^ salt) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
}

/** 고정 각도의 사각 브러쉬를 두 점 사이에서 쓸어 만든 볼록 다각형으로 그린다. */
function drawFlatSegment(
  context: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  size: number,
  angle: number
) {
  const radians = (angle * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const radius = size / 2;
  const corners = [from, to].flatMap(point =>
    [
      [-radius, -radius],
      [radius, -radius],
      [radius, radius],
      [-radius, radius],
    ].map(([x, y]) => ({
      x: point.x + x * cosine - y * sine,
      y: point.y + x * sine + y * cosine,
    }))
  );
  corners.sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: CanvasPoint, b: CanvasPoint, c: CanvasPoint) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const lower: CanvasPoint[] = [];
  const upper: CanvasPoint[] = [];
  for (const point of corners) {
    // 안쪽 꼭짓점은 제거해 쓸어 지나간 외곽만 남긴다.
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
      lower.pop();
    lower.push(point);
  }
  for (const point of corners.reverse()) {
    // 반대 방향의 외곽도 같은 규칙으로 구성한다.
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
      upper.pop();
    upper.push(point);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  context.beginPath();
  context.moveTo(hull[0].x, hull[0].y);
  for (const point of hull.slice(1)) context.lineTo(point.x, point.y);
  context.closePath();
  context.fill();
}

/** 공유 획의 청크를 이어 그린다. paint=false는 픽셀 없이 확인된 접두 구간의 상태만 복원한다. */
function drawSharedStroke(
  context: CanvasRenderingContext2D,
  stroke: CanvasStroke,
  pixelScale: number,
  state: BrushStrokeState,
  paint: boolean
) {
  const { brush, points } = stroke;
  const size = brush.brushSize;
  const radius = size / 2;
  const previousAlpha = context.globalAlpha ?? 1;
  const spacing = Math.max(size / 4, 0.25);
  const stride = Math.max(1, Math.ceil(0.5 / (spacing * Math.max(pixelScale, 0.000001))));

  /** 정해진 분사 순번의 부드러운 점을 표시하며, 축소 화면에서는 순번을 유지한 채 일부만 표시한다. */
  function stamp(point: CanvasPoint, index: number) {
    // 상태 복원 또는 픽셀 밀도 사이의 분사는 계산만 하고 화면에는 찍지 않는다.
    if (!paint || index % stride !== 0) return;
    const seed = stroke.seed ?? 0;
    const direction = sampleRandom(seed, index, 0x68bc21eb) * Math.PI * 2;
    const distance = Math.sqrt(sampleRandom(seed, index, 0x02e5be93)) * radius * 0.15;
    const x = point.x + Math.cos(direction) * distance;
    const y = point.y + Math.sin(direction) * distance;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, brush.color);
    gradient.addColorStop(1, `${brush.color}00`);
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, size, size);
  }

  context.globalAlpha = previousAlpha * (stroke.opacity ?? 1);
  context.fillStyle = brush.color;
  context.strokeStyle = brush.color;
  context.lineWidth = size;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  try {
    for (const point of points) {
      const from = state.lastPoint;
      // 첫 점은 브러쉬 자국 하나를 남기고, 뒤 청크는 이 초기 자국을 반복하지 않는다.
      if (!from) {
        if (brush.brushType === 'airbrush') stamp(point, 0);
        else if (paint && brush.brushType === 'flat') {
          // 기본 각도는 사각형 그대로 표시하고, 지정 각도는 고정 외곽을 계산한다.
          if (!stroke.angle) context.fillRect(point.x - radius, point.y - radius, size, size);
          else drawFlatSegment(context, point, point, size, stroke.angle);
        } else if (paint) {
          context.beginPath();
          context.arc(point.x, point.y, radius, 0, Math.PI * 2);
          context.fill();
        }
        state.lastPoint = { ...point };
        continue;
      }
      const length = Math.hypot(point.x - from.x, point.y - from.y);
      const elapsed = Math.max(0, (point.t ?? 0) - (from.t ?? 0));
      // 청크 경계의 겹친 점은 자국과 분사 시간을 모두 소비하지 않는다.
      if (!length && !elapsed) continue;
      if (brush.brushType === 'airbrush') {
        const progress = Math.max(length / spacing, elapsed / 16);
        const first = Math.floor(state.progress) + 1;
        const end = state.progress + progress;
        const last = Math.floor(end + 1e-9);
        // 작은 배율에서도 숨긴 분사 개수는 한 번에 건너뛰어 긴 획의 연산량을 제한한다.
        const visibleFirst = Math.ceil(first / stride) * stride;
        if (paint && progress > 0) {
          for (let index = visibleFirst; index <= last; index += stride) {
            const ratio = Math.min(1, (index - state.progress) / progress);
            stamp(
              { x: from.x + (point.x - from.x) * ratio, y: from.y + (point.y - from.y) * ratio },
              index
            );
          }
        }
        state.progress = end;
        state.sampleIndex = last;
      } else if (paint && length) {
        // 각 선분을 같은 기본 도형으로 표시해 청크 분할이 불투명도와 겹침 순서를 바꾸지 않는다.
        if (brush.brushType === 'flat')
          drawFlatSegment(context, from, point, size, stroke.angle ?? 0);
        else {
          context.beginPath();
          context.moveTo(from.x, from.y);
          context.lineTo(point.x, point.y);
          context.stroke();
        }
      }
      state.lastPoint = { ...point };
    }
  } finally {
    // 그리기 실패도 호출자의 합성 불투명도를 바꾸지 않는다.
    context.globalAlpha = previousAlpha;
  }
}
