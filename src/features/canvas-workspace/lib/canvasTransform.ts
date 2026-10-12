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

/**
 * 확대 상태. zoom은 전체 보기 대비 배율(1 = 도화지 전체, 1 미만 = 더 멀리), center는 전체 보기 자리의
 * 가운데(pivot)에 올 도화지 좌표다. center가 null이면 도화지 가운데를 본다.
 */
export interface CanvasCamera {
  zoom: number;
  center: CanvasPoint | null;
}

/** 작업 공간 안의 화면 사각형(CSS px) */
export interface CanvasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 한 방향의 도화지 배치(화면 px). 작업 공간보다 작으면 pivot 가운데에 두되 작업 공간 밖으로 나가지 않고,
 * 크면 요청한 도화지 좌표를 pivot에 맞추되 도화지 가장자리가 작업 공간 안으로 들어오지 않게 한다.
 */
function placeAxis(length: number, viewport: number, pivot: number, requested: number) {
  if (length <= viewport) {
    const start = Math.min(viewport - length, Math.max(0, pivot - length / 2));
    return { start, visibleStart: start, visibleLength: length, overflows: false };
  }
  const start = Math.min(0, Math.max(viewport - length, pivot - requested));
  return { start, visibleStart: 0, visibleLength: viewport, overflows: true };
}

/**
 * 확대 배치. fitArea는 1배(전체 보기)에서 도화지를 맞춰 넣을 작업 공간 안의 자리이며, 없으면 작업 공간 전체다.
 * 1배는 fitArea 안에 padding을 둔 전체 보기이고, 확대하면 도화지 자체가 커져 작업 공간 끝까지 채운다.
 * 작업 공간을 넘는 부분만 잘리고, 끌어 옮겨도 도화지 가장자리 밖은 보이지 않는다.
 * 1배보다 작으면 도화지가 전체 보기보다 작아져 fitArea 가운데에 놓인다. 배율 범위는 호출하는 쪽이 정한다.
 * frame은 화면에 보이는 도화지 부분, pivot은 fitArea 가운데(확대·이동의 기준점)다.
 */
export function getCameraView(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  padding: number,
  camera: CanvasCamera,
  fitArea?: CanvasRect | null
): {
  view: CanvasView;
  center: CanvasPoint;
  frame: CanvasRect;
  visible: CanvasRect;
  pivot: CanvasPoint;
} | null {
  const area = fitArea ?? { x: 0, y: 0, width: viewportWidth, height: viewportHeight };
  const fitted = getFittedView(area.width, area.height, worldWidth, worldHeight, padding);
  if (!fitted || !(viewportWidth > 0) || !(viewportHeight > 0)) return null;
  const zoom = Number.isFinite(camera.zoom) && camera.zoom > 0 ? camera.zoom : 1;
  const scale = fitted.scale * zoom;
  const pivot = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
  const requested = camera.center ?? { x: worldWidth / 2, y: worldHeight / 2 };
  const x = placeAxis(worldWidth * scale, viewportWidth, pivot.x, requested.x * scale);
  const y = placeAxis(worldHeight * scale, viewportHeight, pivot.y, requested.y * scale);
  return {
    view: { scale, offsetX: x.start, offsetY: y.start },
    // 전부 보이는 방향은 옮길 수 없으므로 도화지 가운데를 기준으로 기록한다.
    center: {
      x: x.overflows ? (pivot.x - x.start) / scale : worldWidth / 2,
      y: y.overflows ? (pivot.y - y.start) / scale : worldHeight / 2,
    },
    frame: {
      x: x.visibleStart,
      y: y.visibleStart,
      width: x.visibleLength,
      height: y.visibleLength,
    },
    visible: {
      x: (x.visibleStart - x.start) / scale,
      y: (y.visibleStart - y.start) / scale,
      width: x.visibleLength / scale,
      height: y.visibleLength / scale,
    },
    pivot,
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
