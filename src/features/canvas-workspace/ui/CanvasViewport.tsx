import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useCanvasViewport } from '../model/useCanvasViewport';
import type { CanvasDrawingModel } from '../model/useCanvasDrawing';
import type { CanvasMode } from '../model/useCanvasMode';
import type { CanvasZoomController } from '../model/useCanvasZoom';
import { DrawingCanvas } from './DrawingCanvas';
import './canvas.css';

interface CanvasViewportProps {
  worldWidth: number;
  worldHeight: number;
  brushSettings: BrushSettings;
  mode: CanvasMode;
  drawingModel: CanvasDrawingModel;
  workspaceLabel?: string;
  /** 확대 상태. 주면 휠 확대와 화면 옮기기를 켜고, 없으면 도화지 전체 보기로 고정한다. */
  zoom?: CanvasZoomController;
  children?: ReactNode;
}

/** 휠 한 칸(약 100px)에 약 1.2배씩 확대·축소한다. 트랙패드의 작은 이동은 그만큼 부드럽게 바뀐다. */
const WHEEL_ZOOM_SPEED = 0.002;

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

// 작업 공간의 배치와 측정 결과를 렌더러에 연결한다. Canvas 2D 그리기는 DrawingCanvas가 맡는다.
export function CanvasViewport({
  worldWidth,
  worldHeight,
  brushSettings,
  mode,
  drawingModel,
  workspaceLabel,
  zoom,
  children,
}: CanvasViewportProps) {
  const { t } = useTranslation('mainCanvas');
  const { containerRef, fitAreaRef, viewport, view, frame } = useCanvasViewport(
    worldWidth,
    worldHeight,
    zoom?.camera
  );
  // 획은 페이지 모델에 보관해 공간이 잠시 측정 불가이거나 리사이즈되어도 그림을 유지한다.
  // 직접 등록한 휠·키 이벤트가 항상 최신 확대 상태를 쓰도록 ref로 전달한다.
  const zoomRef = useRef(zoom);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  });
  const hoveredRef = useRef(false);
  const panRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const zoomEnabled = Boolean(zoom);
  const setFrame = zoom?.setFrame;

  // 확대 상태가 화면 크기로 가운데 좌표를 제한할 수 있게 측정값을 알린다.
  useLayoutEffect(() => {
    if (viewport.width > 0 && viewport.height > 0)
      setFrame?.(viewport.width, viewport.height, viewport.fitArea);
  }, [setFrame, viewport.width, viewport.height, viewport.fitArea]);

  // React의 wheel 이벤트는 passive라 페이지 스크롤·브라우저 확대를 막을 수 없으므로 직접 등록한다.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !zoomEnabled) return;
    function onWheel(event: WheelEvent) {
      const controller = zoomRef.current;
      if (!controller || !container) return;
      event.preventDefault();
      const rect = container.getBoundingClientRect();
      const lineHeight = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
      const factor = Math.exp(-event.deltaY * lineHeight * WHEEL_ZOOM_SPEED);
      controller.zoomAt(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [containerRef, zoomEnabled]);

  // 스페이스바를 누르고 있는 동안 왼쪽 드래그는 그리기 대신 화면 옮기기가 된다.
  useEffect(() => {
    if (!zoomEnabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== 'Space' || isTypingTarget(event.target)) return;
      // 도화지 위에 있을 때만 페이지 스크롤·버튼 누름 대신 이동 준비로 쓴다.
      if (!hoveredRef.current && !panRef.current) return;
      event.preventDefault();
      setSpaceHeld(true);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code === 'Space') setSpaceHeld(false);
    }
    function onBlur() {
      setSpaceHeld(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [zoomEnabled]);

  /** 휠 버튼 드래그나 스페이스바+왼쪽 드래그는 도화지에 닿기 전에 가로채 화면 옮기기로 처리한다. */
  function onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
    if (!zoomEnabled || panRef.current || event.pointerType !== 'mouse') return;
    if (event.button !== 1 && !(event.button === 0 && spaceHeld)) return;
    event.preventDefault();
    event.stopPropagation();
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!dx && !dy) return;
    panRef.current = { ...pan, x: event.clientX, y: event.clientY };
    zoomRef.current?.panBy(dx, dy);
  }

  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    setPanning(false);
  }

  // 페이지가 도화지 위에 겹치는 표시(연습 도화지, 불러오는 중)를 도화지 틀에 맞춰 배치할 수 있게 위치를 알린다.
  const paperStyle = frame
    ? ({
        '--canvas-paper-x': `${frame.x}px`,
        '--canvas-paper-y': `${frame.y}px`,
        '--canvas-paper-width': `${frame.width}px`,
        '--canvas-paper-height': `${frame.height}px`,
      } as CSSProperties)
    : undefined;

  return (
    <div
      ref={containerRef}
      className="canvas-viewport cameo-light"
      role="region"
      aria-label={workspaceLabel ?? t('workspace')}
      aria-busy={!view}
      style={paperStyle}
      data-pan={panning ? 'active' : zoomEnabled && spaceHeld ? 'ready' : undefined}
      onPointerEnter={() => {
        hoveredRef.current = true;
      }}
      onPointerLeave={() => {
        hoveredRef.current = false;
      }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onLostPointerCapture={endPan}
      // 휠 버튼 클릭의 자동 스크롤·새 탭 열기를 막는다.
      onMouseDownCapture={event => {
        if (zoomEnabled && event.button === 1) event.preventDefault();
      }}
      onAuxClick={event => {
        if (zoomEnabled && event.button === 1) event.preventDefault();
      }}
    >
      {/* 1배 도화지 자리. 페이지 CSS가 inset으로 정하며 기본은 작업 공간 전체다. 측정에만 쓴다. */}
      <div ref={fitAreaRef} className="canvas-fit-area" aria-hidden="true" />
      {/* 측정 전에는 배율을 계산할 수 없으므로, 유효한 view가 생긴 뒤 canvas를 마운트한다. */}
      {view && frame ? (
        <DrawingCanvas
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          pixelRatio={viewport.pixelRatio}
          worldWidth={worldWidth}
          worldHeight={worldHeight}
          view={view}
          frame={frame}
          brushSettings={brushSettings}
          mode={mode}
          drawingModel={drawingModel}
        />
      ) : (
        <span className="sr-only" role="status">
          {t('preparing')}
        </span>
      )}
      {children}
    </div>
  );
}
