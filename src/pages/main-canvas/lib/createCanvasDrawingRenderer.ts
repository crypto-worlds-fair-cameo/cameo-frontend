import type { CanvasView } from './canvasTransform';
import {
  cloneBrushStrokeState,
  createBrushStrokeState,
  drawBrushStroke,
  type BrushStrokeState,
} from './drawBrushStroke';
import type { CanvasDrawing, CanvasStroke } from '../model/useCanvasDrawing';
import type { CanvasMode } from '../model/useCanvasMode';
import type { StrokePreview } from '../api/canvasProtocol';

interface RenderSettings {
  width: number;
  height: number;
  pixelRatio: number;
  view: CanvasView;
  worldWidth: number;
  worldHeight: number;
}

/** 청크가 닿는 기기 픽셀만 합성한다. 이전 끝점과 브러시 가장자리도 경계에 포함한다. */
function chunkBounds(
  stroke: CanvasStroke,
  previous: BrushStrokeState['lastPoint'],
  settings: RenderSettings
) {
  if (!stroke.points.length) return null;
  const { pixelRatio, view, width, height } = settings;
  const spread =
    stroke.brush.brushType === 'flat'
      ? Math.SQRT2
      : stroke.brush.brushType === 'airbrush'
        ? 1.15
        : 1;
  const padding = (stroke.brush.brushSize / 2) * spread * pixelRatio * view.scale + 2;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of previous ? [previous, ...stroke.points] : stroke.points) {
    const x = (point.x * view.scale + view.offsetX) * pixelRatio;
    const y = (point.y * view.scale + view.offsetY) * pixelRatio;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  const x = Math.max(0, Math.floor(left - padding));
  const y = Math.max(0, Math.floor(top - padding));
  const edgeX = Math.min(width, Math.ceil(right + padding));
  const edgeY = Math.min(height, Math.ceil(bottom + padding));
  return edgeX > x && edgeY > y ? { x, y, width: edgeX - x, height: edgeY - y } : null;
}

/** 사용자와 획 ID를 함께 사용해 다른 사용자의 같은 획 ID를 분리한다. */
function strokeKey(userId: string, clientStrokeId: string) {
  return JSON.stringify([userId, clientStrokeId]);
}

/** 서버 브러쉬 필드를 페이지의 그리기 모델로 옮기며 wire 불투명도를 유지한다. */
function chunkStroke(chunk: StrokePreview): CanvasStroke {
  return {
    clientStrokeId: chunk.clientStrokeId,
    brush: {
      brushType: chunk.brush.type,
      brushSize: chunk.brush.size,
      color: chunk.brush.color,
    },
    angle: chunk.brush.angle,
    seed: chunk.brush.seed,
    opacity: chunk.brush.opacity,
    points: chunk.points,
  };
}

/** 화면 크기의 서버 픽셀 캐시를 유지하고 미확인 로컬 구간만 그 위에 합성한다. */
export function createCanvasDrawingRenderer() {
  let liveLayer: HTMLCanvasElement | null = null;
  let chunkLayer: HTMLCanvasElement | null = null;
  let liveKey = '';
  let liveCount = 0;
  let serverCount = 0;
  let lastSequence = '';
  const states = new Map<string, BrushStrokeState>();

  /** 원본 좌표를 기기 픽셀로 변환한다. 기존 변환은 교체해 중첩하지 않는다. */
  function transform(context: CanvasRenderingContext2D, { pixelRatio, view }: RenderSettings) {
    context.setTransform(
      pixelRatio * view.scale,
      0,
      0,
      pixelRatio * view.scale,
      pixelRatio * view.offsetX,
      pixelRatio * view.offsetY
    );
  }

  /** 캡처된 드래그가 도화지 밖으로 나가도 픽셀은 원본 경계 안에만 남긴다. */
  function clip(context: CanvasRenderingContext2D, { worldWidth, worldHeight }: RenderSettings) {
    context.beginPath();
    context.rect(0, 0, worldWidth, worldHeight);
    context.clip();
  }

  /** 서버 청크는 전역 순서대로 추가하고, 화면 변경과 epoch 교체 때만 전체 캐시를 재생한다. */
  function updateLayer(drawing: CanvasDrawing, settings: RenderSettings) {
    const chunks = drawing.serverChunks ?? [];
    const { width, height, pixelRatio, view, worldWidth, worldHeight } = settings;
    const key = [
      width,
      height,
      pixelRatio,
      view.scale,
      view.offsetX,
      view.offsetY,
      worldWidth,
      worldHeight,
      drawing.epoch ?? '',
      drawing.resetVersion ?? 0,
    ].join(':');
    const changed =
      key !== liveKey || chunks.length !== serverCount || drawing.liveStrokes.length !== liveCount;
    // 포인터 이동만 발생하면 서버와 완료 획의 픽셀을 다시 그리지 않는다.
    if (!changed) return;

    // 평소에는 새 청크만 정렬하며, 과거 순서가 삽입되면 기존 픽셀도 다시 재생한다.
    const additions = chunks.slice(serverCount);
    const rebuild =
      key !== liveKey ||
      chunks.length < serverCount ||
      drawing.liveStrokes.length < liveCount ||
      (serverCount > 0 &&
        (chunks[serverCount - 1]?.sequence !== lastSequence ||
          additions.some(chunk => BigInt(chunk.sequence) <= BigInt(lastSequence))));
    // sequence는 64비트 문자열이므로 Number 변환 없이 비교한다.
    const ordered = (rebuild ? [...chunks] : additions).sort((a, b) => {
      const left = BigInt(a.sequence);
      const right = BigInt(b.sequence);
      return left < right ? -1 : left > right ? 1 : 0;
    });
    liveLayer ??= document.createElement('canvas');
    const layerContext = liveLayer.getContext('2d');
    if (!layerContext) throw new Error('Live layer context is unavailable');
    liveKey = ''; // 실패한 부분 캐시는 다음 시도에서 처음부터 복원한다.
    // 버퍼 크기 변경은 Canvas의 저장 스택도 지우므로 save보다 먼저 적용한다.
    if (rebuild) {
      if (liveLayer.width !== width) liveLayer.width = width;
      if (liveLayer.height !== height) liveLayer.height = height;
    }
    layerContext.save();
    try {
      // 화면 변경과 과거 sequence 삽입은 캐시와 획별 분사 상태를 함께 초기화한다.
      if (rebuild) {
        layerContext.setTransform(1, 0, 0, 1, 0, 0);
        layerContext.clearRect(0, 0, width, height);
        serverCount = 0;
        liveCount = 0;
        states.clear();
      }
      for (const chunk of ordered) {
        const key = strokeKey(chunk.userId, chunk.clientStrokeId);
        const state = states.get(key) ?? createBrushStrokeState();
        const stroke = chunkStroke(chunk);
        const bounds = chunkBounds(stroke, state.lastPoint, settings);
        // 화면 밖 청크도 분사 순번과 끝점은 소비해 이후 보이는 구간을 같은 상태로 이어 쓴다.
        if (!bounds) {
          drawBrushStroke(layerContext, stroke, pixelRatio * view.scale, state, false);
          states.set(key, state);
          continue;
        }
        // 각 청크를 같은 투명 버퍼에서 완성한 뒤 합성해 전체 복구와 실시간 추가의 픽셀을 맞춘다.
        // Canvas가 화면 갱신 사이에 명령을 묶어 최적화해도 청크의 합성 경계는 바뀌지 않는다.
        if (!chunkLayer) {
          chunkLayer = document.createElement('canvas');
          chunkLayer.width = bounds.width;
          chunkLayer.height = bounds.height;
        } else {
          // 크기가 조금씩 다른 청크마다 픽셀 버퍼를 다시 할당하지 않고 필요한 경우만 키운다.
          if (chunkLayer.width < bounds.width) chunkLayer.width = bounds.width;
          if (chunkLayer.height < bounds.height) chunkLayer.height = bounds.height;
        }
        const chunkContext = chunkLayer.getContext('2d');
        if (!chunkContext) throw new Error('Chunk layer context is unavailable');
        chunkContext.setTransform(1, 0, 0, 1, 0, 0);
        chunkContext.clearRect(0, 0, bounds.width, bounds.height);
        chunkContext.save();
        try {
          transform(chunkContext, {
            ...settings,
            view: {
              ...view,
              offsetX: view.offsetX - bounds.x / pixelRatio,
              offsetY: view.offsetY - bounds.y / pixelRatio,
            },
          });
          clip(chunkContext, settings);
          drawBrushStroke(chunkContext, stroke, pixelRatio * view.scale, state);
        } finally {
          chunkContext.restore();
        }
        // 재사용 버퍼의 나머지 영역은 이전 청크의 픽셀이므로 현재 경계만 1:1로 복사한다.
        layerContext.drawImage(
          chunkLayer,
          0,
          0,
          bounds.width,
          bounds.height,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height
        );
        states.set(key, state);
      }
      // 기존 로컬 전용 모델의 완료 획도 화면 캐시를 계속 사용할 수 있다.
      transform(layerContext, settings);
      clip(layerContext, settings);
      for (const stroke of drawing.liveStrokes.slice(liveCount)) {
        drawBrushStroke(layerContext, stroke, pixelRatio * view.scale);
      }
      serverCount = chunks.length;
      liveCount = drawing.liveStrokes.length;
      lastSequence = ordered[ordered.length - 1]?.sequence ?? lastSequence;
      liveKey = key;
    } finally {
      layerContext.restore();
    }
  }

  /** 서버 픽셀과 미확인 로컬 획, 연습 획을 원본 좌표 경계 안에서 합성한다. */
  function render(
    context: CanvasRenderingContext2D,
    drawing: CanvasDrawing,
    mode: CanvasMode,
    settings: RenderSettings
  ) {
    const overlays: CanvasStroke[] = [];
    if (mode === 'practice' && drawing.practiceStroke) overlays.push(drawing.practiceStroke);
    if (drawing.activeStroke) overlays.push(drawing.activeStroke);
    const optimistic = drawing.optimisticStrokes ?? [];
    const hasCommitted = !!drawing.liveStrokes.length || !!drawing.serverChunks?.length;
    // 모든 획이 사라지면 이전 epoch의 캐시와 획별 상태를 버린다.
    if (!hasCommitted && !overlays.length && !optimistic.length) {
      liveKey = '';
      liveCount = 0;
      serverCount = 0;
      states.clear();
      return;
    }

    context.save();
    try {
      clip(context, settings);
      // 빈 서버 스냅샷도 epoch 변경에 따라 이전 획별 상태를 초기화한다.
      updateLayer(drawing, settings);
      if (hasCommitted && liveLayer) {
        context.save();
        try {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.drawImage(liveLayer, 0, 0);
        } finally {
          context.restore();
        }
      }
      for (const { stroke, acknowledgedPoints } of optimistic) {
        // 이미 확인된 획 전체는 서버 캐시에 있으므로 중복 합성하지 않는다.
        if (acknowledgedPoints >= stroke.points.length) continue;
        const stored =
          drawing.userId && stroke.clientStrokeId
            ? states.get(strokeKey(drawing.userId, stroke.clientStrokeId))
            : undefined;
        const state = stored ? cloneBrushStrokeState(stored) : createBrushStrokeState();
        // 서버 상태를 찾지 못하면 확인 접두 구간을 픽셀 없이 소비해 분사 순번을 복원한다.
        if (!stored && acknowledgedPoints > 0) {
          drawBrushStroke(
            context,
            { ...stroke, points: stroke.points.slice(0, acknowledgedPoints) },
            settings.pixelRatio * settings.view.scale,
            state,
            false
          );
        }
        drawBrushStroke(
          context,
          { ...stroke, points: stroke.points.slice(acknowledgedPoints) },
          settings.pixelRatio * settings.view.scale,
          state
        );
      }
      // 연습 및 로컬 전용 입력은 기존 모델과 공유 획 모델에 맞는 경로를 선택한다.
      for (const stroke of overlays) {
        drawBrushStroke(
          context,
          stroke,
          settings.pixelRatio * settings.view.scale,
          stroke.clientStrokeId ? createBrushStrokeState() : undefined
        );
      }
    } finally {
      context.restore();
    }
  }

  return { render };
}
