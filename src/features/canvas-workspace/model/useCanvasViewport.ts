import { useLayoutEffect, useRef, useState } from 'react';
import { getCameraView, type CanvasCamera, type CanvasRect } from '../lib/canvasTransform';
import { CANVAS_VIEW_PADDING } from './useCanvasZoom';

interface ViewportSize {
  width: number;
  height: number;
  pixelRatio: number;
  /** 1배에서 도화지를 맞춰 넣을 자리(작업 공간 기준 CSS px). 크기가 없으면 작업 공간 전체를 쓴다. */
  fitArea: CanvasRect | null;
}

function sameRect(a: CanvasRect | null, b: CanvasRect | null) {
  return (
    a === b ||
    (a !== null &&
      b !== null &&
      a.x === b.x &&
      a.y === b.y &&
      a.width === b.width &&
      a.height === b.height)
  );
}

/**
 * 컨테이너 크기와 화면 해상도를 관찰하고, 도화지를 배치하는 값을 제공한다.
 * DOM 측정과 구독은 이 훅이 소유하고, 순수한 좌표 계산은 canvasTransform에 맡긴다.
 * fitAreaRef 요소가 있으면 그 자리를 1배 도화지 자리로 쓰고, 확대하면 작업 공간 전체로 커진다.
 */
export function useCanvasViewport(worldWidth: number, worldHeight: number, camera?: CanvasCamera) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitAreaRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<ViewportSize>({
    width: 0,
    height: 0,
    pixelRatio: 1,
    fitArea: null,
  });

  // 첫 화면이 표시되기 전에 컨테이너 크기를 측정해 초기 배치를 결정한다.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      // width/height는 CSS 픽셀이다. 실제 canvas 버퍼의 픽셀 크기는 렌더러에서 별도로 계산한다.
      const rect = container.getBoundingClientRect();
      const { width, height } = rect;
      const pixelRatio = window.devicePixelRatio || 1;
      const fitRect = fitAreaRef.current?.getBoundingClientRect();
      const fitArea =
        fitRect && fitRect.width > 0 && fitRect.height > 0
          ? {
              x: fitRect.left - rect.left,
              y: fitRect.top - rect.top,
              width: fitRect.width,
              height: fitRect.height,
            }
          : null;
      // 같은 측정값으로 다시 렌더링하지 않도록 기존 상태를 유지한다.
      setViewport(previous =>
        previous.width === width &&
        previous.height === height &&
        previous.pixelRatio === pixelRatio &&
        sameRect(previous.fitArea, fitArea)
          ? previous
          : { width, height, pixelRatio, fitArea }
      );
    };

    // 창 크기가 그대로여도 브라우저 확대나 모니터 이동으로 devicePixelRatio가 바뀔 수 있다.
    let resolutionQuery: MediaQueryList;
    const watchResolution = () => {
      resolutionQuery?.removeEventListener('change', onResolutionChange);
      resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener('change', onResolutionChange);
    };
    const onResolutionChange = () => {
      measure();
      // 쿼리가 이전 해상도를 기준으로 하므로 새 해상도로 다시 구독해야 다음 변경도 감지한다.
      watchResolution();
    };

    // ResizeObserver는 헤더 높이 등으로 컨테이너만 달라지는 경우도 감지한다.
    // 1배 자리는 화면 높이 비율로 바뀌므로 함께 관찰한다.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (fitAreaRef.current) observer.observe(fitAreaRef.current);
    window.addEventListener('resize', measure);
    watchResolution();
    measure(); // 관찰 이벤트를 기다리지 않고 최초 크기를 즉시 반영한다.

    return () => {
      // 페이지를 떠나면 DOM 관찰과 전역 이벤트 구독을 모두 해제한다.
      observer.disconnect();
      window.removeEventListener('resize', measure);
      resolutionQuery.removeEventListener('change', onResolutionChange);
    };
  }, []);

  // 도화지 가장자리와 1배 자리 사이에 CSS 픽셀 기준 16px의 최소 여백을 둔다.
  // 확대 상태가 없으면 1배(도화지 전체 보기)와 같다.
  const resolved = getCameraView(
    viewport.width,
    viewport.height,
    worldWidth,
    worldHeight,
    CANVAS_VIEW_PADDING,
    camera ?? FIT_CAMERA,
    viewport.fitArea
  );
  return {
    containerRef,
    fitAreaRef,
    viewport,
    view: resolved?.view ?? null,
    /** 도화지 틀: 화면에 보이는 도화지 부분. 확대하면 작업 공간 끝까지 커지며 그림은 이 안에만 표시한다. */
    frame: resolved?.frame ?? null,
  };
}

const FIT_CAMERA: CanvasCamera = { zoom: 1, center: null };
