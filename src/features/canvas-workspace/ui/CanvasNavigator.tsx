import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createCanvasDrawingRenderer } from '../lib/createCanvasDrawingRenderer';
import type { CanvasDrawing, CanvasDrawingModel, CanvasStroke } from '../model/useCanvasDrawing';
import type { CanvasZoomController } from '../model/useCanvasZoom';
import type { StrokePreview } from '../api/canvasProtocol';

/** 미니맵 한 변의 CSS 크기 (Figma 1920 기준 약 108px) */
const MAP_SIZE = 108;
/** 그림이 자주 바뀌어도 미니맵은 이 간격보다 자주 다시 그리지 않는다. */
const MAP_REPAINT_MS = 250;
/** 미니맵에서 가는 획도 보이도록 그리는 최소 굵기(미니맵 CSS px) */
const MAP_MIN_LINE = 1.5;

/**
 * 미니맵 배율에서는 대부분의 획이 1px보다 가늘어 사라지므로, 위치가 보이도록 최소 굵기로 키워 그린다.
 * 에어브러시의 흩뿌린 점은 지도 크기에서 보이지 않으므로 같은 경로의 둥근 선으로 바꿔 그린다.
 */
function withMinimumBrush(drawing: CanvasDrawing, minimum: number): CanvasDrawing {
  const widenChunk = (chunk: StrokePreview): StrokePreview =>
    chunk.brush.size >= minimum && chunk.brush.type !== 'airbrush'
      ? chunk
      : {
          ...chunk,
          brush: {
            ...chunk.brush,
            type: chunk.brush.type === 'airbrush' ? 'round' : chunk.brush.type,
            size: Math.max(minimum, chunk.brush.size),
          },
        };
  const widenStroke = (stroke: CanvasStroke): CanvasStroke =>
    stroke.brush.brushSize >= minimum && stroke.brush.brushType !== 'airbrush'
      ? stroke
      : {
          ...stroke,
          brush: {
            ...stroke.brush,
            brushType: stroke.brush.brushType === 'airbrush' ? 'round' : stroke.brush.brushType,
            brushSize: Math.max(minimum, stroke.brush.brushSize),
          },
        };
  return {
    ...drawing,
    serverChunks: drawing.serverChunks?.map(widenChunk),
    liveStrokes: drawing.liveStrokes.map(widenStroke),
    optimisticStrokes: drawing.optimisticStrokes?.map(entry => ({
      ...entry,
      stroke: widenStroke(entry.stroke),
    })),
    activeStroke: drawing.activeStroke && widenStroke(drawing.activeStroke),
    // 연습 획은 공유 도화지가 아니므로 지도에 표시하지 않는다.
    practiceStroke: null,
  };
}

/**
 * 왼쪽 아래 지도. 도화지 전체를 작게 보여 주고 지금 보고 있는 영역을 네모로 표시한다.
 * 지도를 누르거나 끌면 그 위치로 화면을 옮기고, 옆의 +/− 버튼으로 확대·축소한다.
 */
export function CanvasNavigator({
  zoom,
  drawingModel,
}: {
  zoom: CanvasZoomController;
  drawingModel: Pick<CanvasDrawingModel, 'drawing' | 'revision'>;
}) {
  const { t } = useTranslation('mainCanvas');
  const { worldWidth, worldHeight, visibleRect } = zoom;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createCanvasDrawingRenderer> | null>(null);
  const drawingRef = useRef(drawingModel.drawing);
  const timerRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);
  const dragRef = useRef<number | null>(null);
  const scale = MAP_SIZE / Math.max(worldWidth, worldHeight);
  const mapWidth = worldWidth * scale;
  const mapHeight = worldHeight * scale;

  useLayoutEffect(() => {
    drawingRef.current = drawingModel.drawing;
  });

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    []
  );

  // 그림이 바뀌면 일정 간격으로 묶어 다시 그린다. 예약된 그리기는 그때의 최신 그림을 읽는다.
  useEffect(() => {
    if (timerRef.current !== null) return;
    const delay = Math.max(0, lastPaintRef.current + MAP_REPAINT_MS - performance.now());
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      lastPaintRef.current = performance.now();
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.round(mapWidth * pixelRatio);
      const height = Math.round(mapHeight * pixelRatio);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const view = { scale, offsetX: 0, offsetY: 0 };
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.setTransform(pixelRatio * scale, 0, 0, pixelRatio * scale, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, worldWidth, worldHeight);
      rendererRef.current ??= createCanvasDrawingRenderer();
      rendererRef.current.render(
        context,
        withMinimumBrush(drawingRef.current, MAP_MIN_LINE / scale),
        'live',
        { width, height, pixelRatio, view, worldWidth, worldHeight }
      );
    }, delay);
  }, [
    drawingModel.drawing,
    drawingModel.revision,
    mapWidth,
    mapHeight,
    scale,
    worldWidth,
    worldHeight,
  ]);

  /** 지도 위 위치를 도화지 좌표로 바꿔 화면 가운데로 옮긴다. */
  function moveTo(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    zoom.centerOn({
      x: ((event.clientX - rect.left) / rect.width) * worldWidth,
      y: ((event.clientY - rect.top) / rect.height) * worldHeight,
    });
  }

  /** 화살표 키는 보이는 영역의 1/4씩 옮긴다. */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = visibleRect ? visibleRect.width / 4 : worldWidth / 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move || !visibleRect) return;
    event.preventDefault();
    zoom.centerOn({
      x: visibleRect.x + visibleRect.width / 2 + move[0],
      y: visibleRect.y + visibleRect.height / 2 + move[1],
    });
  }

  // 전체 보기에서는 보이는 영역이 지도 전체와 같으므로 네모를 숨긴다.
  const showViewport = zoom.zoom > 1.001 && visibleRect;

  return (
    <div className="canvas-navigator">
      <div className="canvas-navigator-row">
        <div
          className="canvas-navigator-map"
          style={{ width: mapWidth, height: mapHeight }}
          role="group"
          tabIndex={0}
          aria-label={t('zoom.map')}
          onKeyDown={onKeyDown}
          onPointerDown={event => {
            if (event.button !== 0) return;
            dragRef.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            moveTo(event);
          }}
          onPointerMove={event => {
            if (dragRef.current === event.pointerId) moveTo(event);
          }}
          onPointerUp={event => {
            if (dragRef.current === event.pointerId) dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" />
          {showViewport && (
            <span
              className="canvas-navigator-viewport"
              aria-hidden="true"
              style={{
                left: visibleRect.x * scale,
                top: visibleRect.y * scale,
                width: visibleRect.width * scale,
                height: visibleRect.height * scale,
              }}
            />
          )}
        </div>
        <div className="canvas-navigator-buttons">
          <button
            type="button"
            aria-label={t('zoom.in')}
            disabled={zoom.zoom >= zoom.maxZoom}
            onClick={zoom.zoomIn}
          >
            <Plus aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('zoom.out')}
            disabled={zoom.zoom <= zoom.minZoom}
            onClick={zoom.zoomOut}
          >
            <Minus aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="canvas-navigator-size">
        {t('zoom.mapSize', { width: worldWidth, height: worldHeight })}
      </p>
    </div>
  );
}
