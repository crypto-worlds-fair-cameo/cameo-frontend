import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import type { CanvasMode } from './useCanvasMode';
import type { StrokePoint, StrokePreview } from '../api/canvasProtocol';
import type { CanvasSnapshotBase } from './canvasSnapshot';

export interface CanvasStroke {
  brush: BrushSettings;
  points: StrokePoint[];
  clientStrokeId?: string;
  seed?: number;
  angle?: number;
  opacity?: number;
}

export interface CanvasDrawing {
  liveStrokes: CanvasStroke[];
  practiceStroke: CanvasStroke | null;
  activeStroke: CanvasStroke | null;
  serverChunks?: StrokePreview[];
  optimisticStrokes?: { stroke: CanvasStroke; acknowledgedPoints: number }[];
  snapshotBase?: CanvasSnapshotBase | null;
  epoch?: string;
  userId?: string;
  resetVersion?: number;
}

export interface CanvasDrawingTransport {
  start(stroke: CanvasStroke): boolean;
  move(clientStrokeId: string, points: StrokePoint[]): void;
  finish(clientStrokeId: string): void;
  cancel(clientStrokeId: string): void;
}

const AIRBRUSH_SAMPLE_INTERVAL_MS = 50;

/** 원본 좌표의 획을 페이지 안에 보관하고, 실제 획과 교체 가능한 연습 획을 분리한다. */
export function useCanvasDrawing(
  brush: BrushSettings,
  mode: CanvasMode,
  worldWidth: number,
  worldHeight: number,
  transport?: CanvasDrawingTransport
) {
  const transportRef = useRef(transport);
  useLayoutEffect(() => {
    transportRef.current = transport;
  }, [transport]);
  const drawingRef = useRef<CanvasDrawing>({
    liveStrokes: [],
    practiceStroke: null,
    activeStroke: null,
  });
  const activeRef = useRef<{
    pointerId: number;
    mode: CanvasMode;
    startedAt: number;
    clockStartedAt: number;
  } | null>(null);
  const airbrushTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [inputVersion, setInputVersion] = useState(0);
  const previousMode = useRef(mode);
  const [revision, setRevision] = useState(0);
  const [drawing, setDrawing] = useState<CanvasDrawing>({
    liveStrokes: [],
    practiceStroke: null,
    activeStroke: null,
  });

  /** 입력 중 점 목록은 독립된 배열로 복사해 이미 렌더된 상태를 나중에 변경하지 않는다. */
  const publish = useCallback(() => {
    const source = drawingRef.current;
    const activeStroke = source.activeStroke;
    setDrawing({
      liveStrokes: [...source.liveStrokes],
      practiceStroke: source.practiceStroke,
      activeStroke: activeStroke ? { ...activeStroke, points: [...activeStroke.points] } : null,
    });
    setRevision(value => value + 1);
  }, []);

  /** 획 데이터는 ref에 모으고, 버전 변경으로 화면용 렌더러에 다시 그리기를 알린다. */
  function invalidate() {
    publish();
  }

  /** Airbrush의 시간 표본을 만드는 타이머를 끝내 이전 입력이 새 획에 좌표를 추가하지 않게 한다. */
  const stopAirbrushSampling = useCallback(() => {
    clearInterval(airbrushTimerRef.current);
    airbrushTimerRef.current = undefined;
  }, []);

  useEffect(() => stopAirbrushSampling, [stopAirbrushSampling]);

  useLayoutEffect(() => {
    // 모드가 바뀌면 진행 중인 획을 취소하고, 실제 모드로 돌아갈 때 연습 획을 지운다.
    if (previousMode.current === mode) return;
    previousMode.current = mode;
    stopAirbrushSampling();
    const active = drawingRef.current.activeStroke;
    if (activeRef.current?.mode === 'live' && active?.clientStrokeId) {
      transportRef.current?.cancel(active.clientStrokeId);
    }
    activeRef.current = null;
    drawingRef.current.activeStroke = null;
    if (mode === 'live') drawingRef.current.practiceStroke = null;
    publish();
  }, [mode, publish, stopAirbrushSampling]);

  /** 고정 위치에서도 경과 시각을 좌표로 남겨 Airbrush 분사를 화면과 전송에 계속 반영한다. */
  function startAirbrushSampling(pointerId: number) {
    stopAirbrushSampling();
    airbrushTimerRef.current = setInterval(() => {
      const active = activeRef.current;
      const stroke = drawingRef.current.activeStroke;
      if (active?.pointerId !== pointerId || stroke?.brush.brushType !== 'airbrush') {
        stopAirbrushSampling();
        return;
      }
      const last = stroke.points[stroke.points.length - 1];
      const elapsed = Math.max(0, performance.now() - active.clockStartedAt);
      moveStroke(pointerId, { x: last.x, y: last.y, t: active.startedAt + elapsed });
    }, AIRBRUSH_SAMPLE_INTERVAL_MS);
  }

  /** 도화지 안에서만 새 획을 시작하며, 누른 시점의 브러쉬 설정을 복사한다. */
  function startStroke(pointerId: number, point: StrokePoint): boolean {
    // 다른 획이 진행 중이거나 유효한 도화지 좌표가 아니면 기존 그림을 유지한다.
    if (
      activeRef.current ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.y < 0 ||
      point.x > worldWidth ||
      point.y > worldHeight ||
      (transport && (point.x >= worldWidth || point.y >= worldHeight))
    )
      return false;

    const startedAt = point.t ?? performance.now();
    const stroke: CanvasStroke = { brush: { ...brush }, points: [{ x: point.x, y: point.y }] };
    // 동기화용 획은 누른 시점에 ID·각도·seed를 고정하고 Airbrush 시각을 0부터 보관한다.
    if (transport) {
      stroke.clientStrokeId = crypto.randomUUID();
      if (brush.brushType === 'flat') stroke.angle = 0;
      if (brush.brushType === 'airbrush') {
        stroke.seed = crypto.getRandomValues(new Uint32Array(1))[0];
        stroke.points[0].t = 0;
      }
      if (mode === 'live' && !transport.start(stroke)) return false;
    }
    activeRef.current = { pointerId, mode, startedAt, clockStartedAt: performance.now() };
    // 유효한 연습을 시작할 때만 이전 연습 획을 지운다. 실제 획은 그대로 둔다.
    if (mode === 'practice') drawingRef.current.practiceStroke = null;
    drawingRef.current.activeStroke = stroke;
    if (stroke.brush.brushType === 'airbrush') startAirbrushSampling(pointerId);
    invalidate();
    return true;
  }

  /** 시작한 포인터의 이동만 원본 점 목록에 추가한다. 경계 밖의 선은 렌더러가 잘라낸다. */
  function moveStroke(pointerId: number, input: StrokePoint | StrokePoint[]) {
    const stroke = drawingRef.current.activeStroke;
    // 다른 포인터의 점은 진행 중인 획에 섞지 않는다.
    if (activeRef.current?.pointerId !== pointerId || !stroke) return;
    const points = Array.isArray(input) ? input : [input];
    const added: StrokePoint[] = [];
    let changed = false;
    for (const point of points) {
      // 잘못된 좌표와 중복 점은 버리고, 합쳐진 입력의 유효한 중간 점은 모두 보관한다.
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const last = stroke.points[stroke.points.length - 1];
      // 서버는 도화지 내부 좌표만 받으므로 캡처된 바깥 입력도 경계 안으로 제한한다.
      const next: StrokePoint = transport
        ? {
            x: Math.max(0, Math.min(worldWidth - 0.000001, point.x)),
            y: Math.max(0, Math.min(worldHeight - 0.000001, point.y)),
          }
        : { x: point.x, y: point.y };
      if (transport && stroke.brush.brushType === 'airbrush') {
        next.t = Math.max(
          last.t ?? 0,
          Math.min(
            3_600_000,
            Math.round((point.t ?? performance.now()) - activeRef.current!.startedAt)
          )
        );
      }
      if (last.x === next.x && last.y === next.y && last.t === next.t) continue;
      stroke.points.push(next);
      added.push(next);
      changed = true;
    }
    // 한 포인터 이벤트의 점들을 모두 모은 뒤 스냅샷을 한 번만 복사한다.
    if (changed) {
      if (activeRef.current?.mode === 'live' && stroke.clientStrokeId) {
        transport?.move(stroke.clientStrokeId, added);
      }
      invalidate();
    }
  }

  /** 정상 종료한 획은 실제 그림에 누적하거나 연습 획 하나로 보관한다. */
  function finishStroke(pointerId: number, point: StrokePoint) {
    // 시작하지 않은 포인터의 종료는 현재 획을 끝내지 않는다.
    if (activeRef.current?.pointerId !== pointerId) return;
    stopAirbrushSampling();
    moveStroke(pointerId, point);
    const stroke = drawingRef.current.activeStroke;
    // 마지막 점을 처리하다 메모리 한도 등으로 입력이 중단됐다면 완료나 확인창을 만들지 않는다.
    if (!activeRef.current || !stroke) return;
    if (activeRef.current.mode === 'live') {
      if (transport && stroke.clientStrokeId) transport.finish(stroke.clientStrokeId);
      else drawingRef.current.liveStrokes.push(stroke);
    } else {
      drawingRef.current.practiceStroke = stroke;
    }
    activeRef.current = null;
    drawingRef.current.activeStroke = null;
    invalidate();
  }

  /** 입력 중단은 미완료 획만 버린다. 완료한 실제 획은 유지한다. */
  const cancelStroke = useCallback(
    (pointerId?: number) => {
      // 전체 취소 또는 시작한 포인터의 취소만 허용하며, 추가 손가락의 취소는 무시한다.
      if (
        !activeRef.current ||
        (pointerId !== undefined && activeRef.current.pointerId !== pointerId)
      ) {
        return;
      }
      stopAirbrushSampling();
      const stroke = drawingRef.current.activeStroke;
      if (activeRef.current.mode === 'live' && stroke?.clientStrokeId) {
        transportRef.current?.cancel(stroke.clientStrokeId);
      }
      activeRef.current = null;
      drawingRef.current.activeStroke = null;
      publish();
    },
    [publish, stopAirbrushSampling]
  );

  /** 메모리 세대나 로그인 주체가 바뀌면 로컬 획과 커서를 함께 초기화한다. */
  const resetDrawing = useCallback(() => {
    stopAirbrushSampling();
    activeRef.current = null;
    drawingRef.current = { liveStrokes: [], practiceStroke: null, activeStroke: null };
    setInputVersion(value => value + 1);
    publish();
  }, [publish, stopAirbrushSampling]);

  /** 연결 중단은 실제 입력과 캡처만 끝내고, 서버 그림과 로컬 연습 획은 유지한다. */
  const interruptLiveStroke = useCallback(() => {
    if (activeRef.current?.mode !== 'live') return;
    stopAirbrushSampling();
    activeRef.current = null;
    drawingRef.current.activeStroke = null;
    setInputVersion(value => value + 1);
    publish();
  }, [publish, stopAirbrushSampling]);

  return {
    drawing,
    revision,
    startStroke,
    moveStroke,
    finishStroke,
    cancelStroke,
    resetDrawing,
    interruptLiveStroke,
    inputVersion,
    cursorBrush: drawing.activeStroke?.brush,
  };
}

export type CanvasDrawingModel = ReturnType<typeof useCanvasDrawing>;
