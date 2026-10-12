import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCameraView,
  screenToWorld,
  type CanvasCamera,
  type CanvasPoint,
  type CanvasRect,
} from '../lib/canvasTransform';

/** 도화지 전체(1배)부터 도화지 폭의 1/10이 보이는 10배까지 확대한다. (Figma: 1,000–10,000 px) */
export const CANVAS_MAX_ZOOM = 10;
/** 전체 보기(1배)의 1/4 크기까지 줄여 도화지를 멀리 보이게 한다. */
export const CANVAS_MIN_ZOOM = 0.25;
/** + / − 버튼 한 번의 배율 변화 */
export const CANVAS_ZOOM_STEP = 1.5;
/** 도화지 가장자리와 작업 공간 사이의 최소 여백(CSS px). 전체 보기와 같은 값이다. */
export const CANVAS_VIEW_PADDING = 16;
/** 휠·끌기·지도 이동이 이 시간 동안 없으면 화면 이동이 끝난 것으로 본다. */
export const CANVAS_NAVIGATION_IDLE_MS = 700;

interface CanvasFrame {
  width: number;
  height: number;
  /** 1배에서 도화지를 맞춰 넣을 작업 공간 안의 자리. null이면 작업 공간 전체다. */
  fitArea: CanvasRect | null;
}

export interface CanvasZoomController {
  /** 전체 보기 대비 배율. 1이면 도화지 전체가 꽉 차게, 1보다 작으면 더 작게 멀리 보인다. */
  zoom: number;
  minZoom: number;
  maxZoom: number;
  camera: CanvasCamera;
  /**
   * 휠 확대·끌어 옮기기·지도 이동 중이면 true. 마지막 이동 뒤 CANVAS_NAVIGATION_IDLE_MS가 지나면 false다.
   * +/− 버튼은 포함하지 않는다. 페이지가 이동 중에 도화지 외의 UI를 잠시 숨길 때 쓴다.
   */
  navigating: boolean;
  /** 도화지 틀에 보이는 도화지 영역(도화지 좌표). 작업 공간을 측정하기 전에는 null이다. */
  visibleRect: CanvasRect | null;
  worldWidth: number;
  worldHeight: number;
  /** 작업 공간이 측정한 화면 크기와 1배 도화지 자리를 알린다. CanvasViewport가 호출한다. */
  setFrame: (width: number, height: number, fitArea?: CanvasRect | null) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  /** 화면 좌표(작업 공간 기준)를 고정한 채 배율에 factor를 곱한다. 휠 확대에 쓴다. */
  zoomAt: (factor: number, screen: CanvasPoint) => void;
  /** 화면을 CSS 픽셀만큼 끌어 옮긴다. 끈 방향으로 도화지가 따라 움직인다. */
  panBy: (dx: number, dy: number) => void;
  /** 도화지 좌표를 전체 보기 자리의 가운데로 옮긴다. 미니맵에서 쓴다. */
  centerOn: (point: CanvasPoint) => void;
}

function clampZoom(zoom: number) {
  return Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, zoom));
}

/** 배율이 전체 보기(1배)를 지나치면 1배에서 한 번 멈춰, 버튼만으로도 전체 보기로 돌아올 수 있게 한다. */
function stepZoom(current: number, factor: number) {
  const next = clampZoom(current * factor);
  return (current < 1 && next > 1) || (current > 1 && next < 1) ? 1 : next;
}

/**
 * 페이지가 소유하는 확대 상태. CanvasViewport는 이 값으로 화면을 그리고,
 * 미니맵·확대 버튼·배율 표시는 같은 값을 읽고 바꾼다.
 */
export function useCanvasZoom(worldWidth: number, worldHeight: number): CanvasZoomController {
  const [camera, setCamera] = useState<CanvasCamera>({ zoom: 1, center: null });
  const [frame, setFrameState] = useState<CanvasFrame | null>(null);
  // 같은 프레임 안에 휠 이벤트가 여러 번 와도 최신 화면 크기로 계산하도록 ref에도 보관한다.
  const frameRef = useRef<CanvasFrame | null>(null);
  const [navigating, setNavigating] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** 이동이 이어지는 동안 종료 타이머를 다시 시작한다. */
  const markNavigating = useCallback(() => {
    setNavigating(true);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setNavigating(false), CANVAS_NAVIGATION_IDLE_MS);
  }, []);

  useEffect(() => () => clearTimeout(idleTimerRef.current), []);

  /** 측정한 작업 공간과 전체 보기 자리로 확대 배치를 계산한다. */
  const viewOf = useCallback(
    (current: CanvasFrame, next: CanvasCamera) =>
      getCameraView(
        current.width,
        current.height,
        worldWidth,
        worldHeight,
        CANVAS_VIEW_PADDING,
        next,
        current.fitArea
      ),
    [worldWidth, worldHeight]
  );

  /** 화면 크기에 맞춰 가운데 좌표를 제한해 저장한다. 제한을 넘긴 이동이 쌓이지 않게 한다. */
  const resolve = useCallback(
    (next: CanvasCamera): CanvasCamera => {
      const current = frameRef.current;
      if (!current) return next;
      const resolved = viewOf(current, next);
      return resolved ? { zoom: next.zoom, center: resolved.center } : next;
    },
    [viewOf]
  );

  const setFrame = useCallback((width: number, height: number, fitArea?: CanvasRect | null) => {
    const previous = frameRef.current;
    const area = fitArea ?? null;
    if (
      previous?.width === width &&
      previous.height === height &&
      previous.fitArea?.x === area?.x &&
      previous.fitArea?.y === area?.y &&
      previous.fitArea?.width === area?.width &&
      previous.fitArea?.height === area?.height
    )
      return;
    frameRef.current = { width, height, fitArea: area };
    setFrameState(frameRef.current);
  }, []);

  const zoomAt = useCallback(
    (factor: number, screen: CanvasPoint) => {
      markNavigating();
      setCamera(previous => {
        const current = frameRef.current;
        const zoom = stepZoom(previous.zoom, factor);
        if (!current || zoom === previous.zoom) return resolve({ ...previous, zoom });
        const before = viewOf(current, previous);
        if (!before) return { ...previous, zoom };
        // 커서 아래의 도화지 좌표가 확대 후에도 같은 화면 위치에 남도록 기준점(pivot)에 올 좌표를 다시 계산한다.
        const anchor = screenToWorld(screen, before.view);
        const scale = (before.view.scale / previous.zoom) * zoom;
        return resolve({
          zoom,
          center: {
            x: anchor.x - (screen.x - before.pivot.x) / scale,
            y: anchor.y - (screen.y - before.pivot.y) / scale,
          },
        });
      });
    },
    [markNavigating, resolve, viewOf]
  );

  const zoomBy = useCallback(
    (factor: number) =>
      setCamera(previous => resolve({ ...previous, zoom: stepZoom(previous.zoom, factor) })),
    [resolve]
  );

  const panBy = useCallback(
    (dx: number, dy: number) => {
      markNavigating();
      setCamera(previous => {
        const current = frameRef.current;
        if (!current) return previous;
        const before = viewOf(current, previous);
        if (!before) return previous;
        return resolve({
          zoom: previous.zoom,
          center: {
            x: before.center.x - dx / before.view.scale,
            y: before.center.y - dy / before.view.scale,
          },
        });
      });
    },
    [markNavigating, resolve, viewOf]
  );

  const centerOn = useCallback(
    (point: CanvasPoint) => {
      markNavigating();
      setCamera(previous => resolve({ zoom: previous.zoom, center: point }));
    },
    [markNavigating, resolve]
  );

  const visibleRect = useMemo(
    () => (frame ? (viewOf(frame, camera)?.visible ?? null) : null),
    [frame, camera, viewOf]
  );

  return {
    zoom: camera.zoom,
    minZoom: CANVAS_MIN_ZOOM,
    maxZoom: CANVAS_MAX_ZOOM,
    camera,
    navigating,
    visibleRect,
    worldWidth,
    worldHeight,
    setFrame,
    zoomIn: useCallback(() => zoomBy(CANVAS_ZOOM_STEP), [zoomBy]),
    zoomOut: useCallback(() => zoomBy(1 / CANVAS_ZOOM_STEP), [zoomBy]),
    zoomAt,
    panBy,
    centerOn,
  };
}
