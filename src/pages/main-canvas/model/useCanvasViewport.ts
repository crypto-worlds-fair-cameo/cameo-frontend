import { useLayoutEffect, useRef, useState } from 'react';
import { getFittedView } from '../lib/canvasTransform';

/**
 * 컨테이너 크기와 화면 해상도를 관찰하고, 도화지를 전체 보기로 배치하는 값을 제공한다.
 * DOM 측정과 구독은 이 훅이 소유하고, 순수한 좌표 계산은 canvasTransform에 맡긴다.
 */
export function useCanvasViewport(worldWidth: number, worldHeight: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0, pixelRatio: 1 });

  // 첫 화면이 표시되기 전에 컨테이너 크기를 측정해 초기 배치를 결정한다.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      // width/height는 CSS 픽셀이다. 실제 canvas 버퍼의 픽셀 크기는 렌더러에서 별도로 계산한다.
      const { width, height } = container.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      // 같은 측정값으로 다시 렌더링하지 않도록 기존 상태를 유지한다.
      setViewport(previous =>
        previous.width === width && previous.height === height && previous.pixelRatio === pixelRatio
          ? previous
          : { width, height, pixelRatio }
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
    const observer = new ResizeObserver(measure);
    observer.observe(container);
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

  return {
    containerRef,
    viewport,
    // 도화지 가장자리와 작업 공간 사이에 CSS 픽셀 기준 16px의 최소 여백을 둔다.
    view: getFittedView(viewport.width, viewport.height, worldWidth, worldHeight, 16),
  };
}
