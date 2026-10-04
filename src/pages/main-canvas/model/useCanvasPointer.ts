import {
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import { screenToWorld, type CanvasPoint, type CanvasView } from '../lib/canvasTransform';
import type { CanvasDrawingModel } from './useCanvasDrawing';
import type { CanvasMode } from './useCanvasMode';

/** 화면 포인터를 원본 좌표로 바꾸고, 캡처로 한 번의 누름부터 종료까지를 같은 획에 연결한다. */
export function useCanvasPointer(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  view: CanvasView,
  mode: CanvasMode,
  model: CanvasDrawingModel,
  worldWidth: number,
  worldHeight: number
) {
  const viewKey = `${view.scale}:${view.offsetX}:${view.offsetY}`;
  const [position, setPosition] = useState<{
    point: CanvasPoint;
    mode: CanvasMode;
    viewKey: string;
    inputVersion: number;
  } | null>(null);
  const capturedPointer = useRef<number | null>(null);
  const { cancelStroke } = model;

  // 모드·배율·도화지 위치가 바뀌면 이전 원본 위치의 커서를 숨겨 물리적 포인터와 어긋나지 않게 한다.
  if (
    position &&
    (position.mode !== mode ||
      position.viewKey !== viewKey ||
      position.inputVersion !== model.inputVersion)
  )
    setPosition(null);

  /** 캡처 소유자를 먼저 비워 release가 발생시키는 lost 이벤트와 중복 종료하지 않는다. */
  const releaseCapture = useCallback(() => {
    const pointerId = capturedPointer.current;
    capturedPointer.current = null;
    const canvas = canvasRef.current;
    // 이미 자동 해제된 캡처는 다시 해제하지 않는다.
    if (pointerId !== null && canvas?.hasPointerCapture(pointerId)) {
      canvas.releasePointerCapture(pointerId);
    }
  }, [canvasRef]);

  /** 입력 또는 렌더링이 중단되면 미완료 획과 DOM 캡처·커서를 함께 초기화한다. */
  const cancelInput = useCallback(() => {
    cancelStroke();
    releaseCapture();
    setPosition(null);
  }, [cancelStroke, releaseCapture]);

  useLayoutEffect(() => {
    // 모드 변경으로 모델의 미완료 획이 취소되면 DOM의 포인터 캡처도 종료한다.
    releaseCapture();
  }, [mode, model.inputVersion, releaseCapture]);

  useEffect(() => {
    /** 창 포커스를 잃으면 종료 이벤트를 기다리지 않고 미완료 획을 취소한다. */
    function onBlur() {
      cancelInput();
    }
    window.addEventListener('blur', onBlur);
    return () => {
      // 렌더러가 측정 불가 등으로 해제되어도 완료한 그림은 상위 모델에 남는다.
      window.removeEventListener('blur', onBlur);
      cancelStroke();
      releaseCapture();
    };
  }, [cancelStroke, releaseCapture, cancelInput]);

  /** client 좌표에서 canvas 위치를 빼 CSS 좌표로 만들고, 배율·이동량을 역으로 적용한다. */
  function getPoint(event: { clientX: number; clientY: number; timeStamp?: number }) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      ...screenToWorld({ x: event.clientX - rect.left, y: event.clientY - rect.top }, view),
      t: event.timeStamp,
    };
  }

  /** 도화지 안에서는 원본 위치의 커서를 표시하고, 여백이나 경계 밖에서는 숨긴다. */
  function updateCursor(point: CanvasPoint) {
    const inside = point.x >= 0 && point.y >= 0 && point.x <= worldWidth && point.y <= worldHeight;
    setPosition(inside ? { point, mode, viewKey, inputVersion: model.inputVersion } : null);
  }

  /** 주 포인터의 왼쪽 버튼 입력만 시작하며, 도화지 밖 시작은 모델이 거절한다. */
  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== 0 || capturedPointer.current !== null) return;
    const point = getPoint(event);
    if (!model.startStroke(event.pointerId, point)) return;
    event.preventDefault();
    capturedPointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateCursor(point);
  }

  /** 이동은 같은 포인터의 획에만 추가하고, 입력이 합쳐졌다면 그 사이의 점도 보관한다. */
  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    // 다른 손가락과 캡처 소유자가 아닌 포인터는 그림과 커서를 바꾸지 않는다.
    if (
      !event.isPrimary ||
      (capturedPointer.current !== null && capturedPointer.current !== event.pointerId)
    )
      return;
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    const point = getPoint(event);
    model.moveStroke(event.pointerId, [...samples.map(getPoint), point]);
    updateCursor(point);
  }

  /** 눌렀던 포인터를 떼면 마지막 위치까지 반영하고 캡처를 종료한다. */
  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (capturedPointer.current !== event.pointerId) return;
    model.finishStroke(event.pointerId, getPoint(event));
    releaseCapture();
    // 터치는 hover가 없으므로 뗀 뒤 커서를 숨기고, 마우스·펜은 위치를 유지한다.
    if (event.pointerType === 'touch') setPosition(null);
  }

  /** 시스템 취소나 강제 캡처 해제는 정상 완료와 구분해 미완료 획을 버린다. */
  function onPointerCancel(event: PointerEvent<HTMLCanvasElement>) {
    if (capturedPointer.current !== event.pointerId) return;
    cancelInput();
  }

  return {
    cursor: position?.point ?? null,
    cancelInput,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      onPointerLeave: () => setPosition(null),
    },
  };
}
