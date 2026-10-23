import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSessionQuery } from '@/entities/session';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { createCanvasDrawingRenderer } from '../lib/createCanvasDrawingRenderer';
import { withMinimumBrush } from '../lib/withMinimumBrush';
import { useCanvasRealtime } from '../model/useCanvasRealtime';
import type { CanvasKey } from '../api/canvasProtocol';

/** 다른 사람이 그리는 동안에도 미리보기는 이 간격보다 자주 다시 그리지 않는다. */
const PREVIEW_REPAINT_MS = 250;
/** 큰 도화지를 줄여 보여도 가는 획이 사라지지 않게 그리는 최소 굵기(CSS px) */
const PREVIEW_MIN_LINE = 1;

/**
 * 도화지에 보기 전용으로 연결해 그림 전체를 상자 크기에 맞춰 보여 준다. 입력은 받지 않는다.
 * 들어올 때 나눠 받는 획 기록은 복구가 끝난 뒤 한 번에 그려, 흰 부분이 차오르는 중간 모습을 보이지 않는다.
 * 손님 연결을 거절하는 도화지는 requiresSession으로 로그인 전에는 연결하지 않는다.
 */
export function CanvasLivePreview({
  canvasKey,
  requiresSession = false,
  label,
  className,
}: {
  canvasKey: CanvasKey;
  requiresSession?: boolean;
  label: string;
  className?: string;
}) {
  const session = useSessionQuery().data;
  const realtime = useCanvasRealtime(defaultBrushSettings, 'live', {
    canvasKey,
    enabled: !requiresSession || Boolean(session),
    allowLiveInput: false,
  });
  const { width: worldWidth, height: worldHeight } = realtime.dimensions;
  const ready = realtime.sync.status === 'ready';
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createCanvasDrawingRenderer> | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);
  const [box, setBox] = useState({ width: 0, height: 0 });
  // 예약된 그리기는 예약 시점이 아니라 실행 시점의 그림과 크기를 읽는다.
  const latestRef = useRef({
    drawing: realtime.drawingModel.drawing,
    box,
    worldWidth,
    worldHeight,
  });

  useLayoutEffect(() => {
    latestRef.current = { drawing: realtime.drawingModel.drawing, box, worldWidth, worldHeight };
  });

  useEffect(() => {
    const element = boxRef.current;
    if (!element) return;
    const measure = () => setBox({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      rendererRef.current?.dispose();
      rendererRef.current = null;
    },
    []
  );

  // 복구 중에는 마지막으로 그린 그림을 그대로 두고, 준비된 그림만 일정 간격으로 묶어 다시 그린다.
  useEffect(() => {
    if (!ready || !box.width || !box.height || timerRef.current !== null) return;
    const delay = Math.max(0, lastPaintRef.current + PREVIEW_REPAINT_MS - performance.now());
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      lastPaintRef.current = performance.now();
      const { drawing, box, worldWidth, worldHeight } = latestRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.round(box.width * pixelRatio);
      const height = Math.round(box.height * pixelRatio);
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      // 도화지 비율을 유지한 채 상자 가운데에 맞춘다.
      const scale = Math.min(box.width / worldWidth, box.height / worldHeight);
      const view = {
        scale,
        offsetX: (box.width - worldWidth * scale) / 2,
        offsetY: (box.height - worldHeight * scale) / 2,
      };
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.setTransform(
        pixelRatio * scale,
        0,
        0,
        pixelRatio * scale,
        pixelRatio * view.offsetX,
        pixelRatio * view.offsetY
      );
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, worldWidth, worldHeight);
      rendererRef.current ??= createCanvasDrawingRenderer();
      rendererRef.current.render(
        context,
        withMinimumBrush(drawing, PREVIEW_MIN_LINE / scale),
        'live',
        { width, height, pixelRatio, view, worldWidth, worldHeight }
      );
    }, delay);
  }, [
    ready,
    realtime.drawingModel.drawing,
    realtime.drawingModel.revision,
    box.width,
    box.height,
    worldWidth,
    worldHeight,
  ]);

  return (
    <div ref={boxRef} className={className} role="img" aria-label={label} aria-busy={!ready}>
      <canvas ref={canvasRef} aria-hidden="true" />
    </div>
  );
}
