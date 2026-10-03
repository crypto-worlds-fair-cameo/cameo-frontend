export interface CanvasPoint {
  x: number;
  y: number;
}

// 원본 좌표를 화면의 CSS 좌표로 바꾸는 값. 기기 해상도 보정은 DrawingCanvas에서 별도로 한다.
export interface CanvasView {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** 도화지 비율을 유지하면서 전체를 표시하고, 남는 공간의 가운데에 배치한다. */
export function getFittedView(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  padding: number
): CanvasView | null {
  const availableWidth = viewportWidth - padding * 2;
  const availableHeight = viewportHeight - padding * 2;
  // 최초 측정 전이나 공간이 너무 작은 경우에는 렌더러를 준비하지 않는다.
  if (
    ![availableWidth, availableHeight, worldWidth, worldHeight].every(
      value => Number.isFinite(value) && value > 0
    )
  ) {
    return null;
  }

  // 가로/세로 중 더 제한적인 배율을 선택해야 어느 방향으로도 도화지가 잘리지 않는다.
  const scale = Math.min(availableWidth / worldWidth, availableHeight / worldHeight);
  return {
    scale,
    offsetX: (viewportWidth - worldWidth * scale) / 2,
    offsetY: (viewportHeight - worldHeight * scale) / 2,
  };
}

/** 도화지 좌표를 작업 공간 내부의 CSS 좌표로 변환한다. */
export function worldToScreen(point: CanvasPoint, view: CanvasView): CanvasPoint {
  return {
    x: point.x * view.scale + view.offsetX,
    y: point.y * view.scale + view.offsetY,
  };
}

/**
 * 작업 공간 내부의 CSS 좌표에서 이동량과 배율을 역으로 적용해 도화지 좌표를 구한다.
 * 포인터 입력을 연결할 때는 clientX/clientY에서 작업 공간의 left/top을 먼저 빼고 전달한다.
 */
export function screenToWorld(point: CanvasPoint, view: CanvasView): CanvasPoint {
  return {
    x: (point.x - view.offsetX) / view.scale,
    y: (point.y - view.offsetY) / view.scale,
  };
}
