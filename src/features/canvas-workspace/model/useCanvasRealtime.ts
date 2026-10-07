import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useCanvasConnection } from './useCanvasConnection';
import { createCanvasSync, initialCanvasSync } from './canvasSync';
import { useCanvasDrawing, type CanvasDrawingTransport } from './useCanvasDrawing';
import type { CanvasMode } from './useCanvasMode';
import type { CanvasKey } from '../api/canvasProtocol';
import type { CanvasReady, SeasonStateEvent } from '../api/canvasSocket';

export interface CanvasRealtimeOptions {
  canvasKey?: CanvasKey;
  reconnectVersion?: number;
  sessionVersion?: number;
  enabled?: boolean;
  allowLiveInput?: boolean;
  onReady?: (ready: CanvasReady) => void;
  onSeasonState?: (event: SeasonStateEvent) => void;
  onError?: (code: string) => void;
}

/** 페이지의 연결과 그림 복구를 소유하고, 연습 입력은 전송 경로에 넣지 않는다. */
export function useCanvasRealtime(
  brush: BrushSettings,
  mode: CanvasMode,
  options: CanvasRealtimeOptions = {}
) {
  const canvasKey = options.canvasKey ?? 'main';
  const callbacksRef = useRef(options);
  useLayoutEffect(() => {
    callbacksRef.current = options;
  }, [options]);
  const [dimensions, setDimensions] = useState({ width: 10_000, height: 10_000 });
  const ownerRef = useRef<ReturnType<typeof createCanvasSync> | null>(null);
  const [sync, setSync] = useState(initialCanvasSync);
  const [strokeNotice, setStrokeNotice] = useState<'limit' | 'completed' | null>(null);
  const activeStrokeIdRef = useRef<string | null>(null);

  // 현재 동기화 소유자에게 입력을 바로 전달해 그리는 동안에도 다른 화면에 방송한다.
  const transport = useMemo<CanvasDrawingTransport>(
    () => ({
      start: stroke => {
        // 참가 중·세션 변경 직후에는 effect 정리 전이라도 이전 ready로 새 입력을 만들지 않는다.
        if (callbacksRef.current.allowLiveInput === false) return false;
        // 준비·권한·횟수 검사를 통과한 획만 시작하며 첫 좌표를 즉시 전송한다.
        if (!ownerRef.current?.transport.start(stroke)) return false;
        activeStrokeIdRef.current = stroke.clientStrokeId!;
        return true;
      },
      move: (id, points) => {
        // 새 좌표는 기존 ACK 대기에 모이고 약 50ms마다 순서대로 전송된다.
        ownerRef.current?.transport.move(id, points);
      },
      finish: id => {
        // 정상 포인터 종료에만 알림을 열며, 첫 ACK가 와도 그리는 도중에는 열지 않는다.
        if (activeStrokeIdRef.current !== id) return;
        activeStrokeIdRef.current = null;
        if (canvasKey === 'main') setStrokeNotice('completed');
        ownerRef.current?.transport.finish(id);
      },
      cancel: id => {
        // 취소는 완료 알림 없이 끝내고, 이미 보낸 좌표와 사용 횟수는 되돌리지 않는다.
        if (activeStrokeIdRef.current === id) activeStrokeIdRef.current = null;
        ownerRef.current?.transport.cancel(id);
      },
    }),
    [canvasKey]
  );
  const drawingModel = useCanvasDrawing(
    brush,
    mode,
    dimensions.width,
    dimensions.height,
    transport
  );
  const { resetDrawing, interruptLiveStroke } = drawingModel;

  /** 알림 닫기는 그림·전송·사용 횟수를 바꾸지 않는다. */
  function onStrokeNoticeOpenChange(open: boolean) {
    if (!open) setStrokeNotice(null);
  }

  useEffect(() => {
    let previousUserId: string | undefined;
    let previousErrorCode: string | undefined;
    // 소켓 effect보다 먼저 복구 소유자를 만들고, 정리된 소유자의 비동기 결과는 버린다.
    const owner = createCanvasSync(
      next => {
        if (ownerRef.current === owner) {
          setSync(next);
          // 계정 변경은 이전 알림을 닫는다. ACK 대기·재접속은 종료 알림을 다시 열지 않는다.
          if (previousUserId !== next.userId) setStrokeNotice(null);
          previousUserId = next.userId;
          // 영구 거절이면 완료 안내를 닫고 기존 오류 또는 획 제한 안내를 표시한다.
          if (next.error) {
            setStrokeNotice(current => (current === 'completed' ? null : current));
            if (previousErrorCode !== next.error.code)
              callbacksRef.current.onError?.(next.error.code);
          }
          previousErrorCode = next.error?.code;
        }
      },
      () => {
        // 계정이나 서버 세대가 바뀌면 진행 중인 로컬 입력을 함께 초기화한다.
        activeStrokeIdRef.current = null;
        resetDrawing();
      },
      undefined,
      () => {
        // 연결 중단은 로컬 입력을 끝낸다. 서버 승인과 미확인 묶음은 동기화 소유자가 유지한다.
        activeStrokeIdRef.current = null;
        interruptLiveStroke();
      },
      () => {
        // 이미 사용한 계정의 새 그리기 시도만 별도 제한 모달로 안내한다.
        if (ownerRef.current === owner) setStrokeNotice('limit');
      },
      canvasKey
    );
    ownerRef.current = owner;
    return () => {
      ownerRef.current = null;
      owner.dispose();
    };
  }, [resetDrawing, interruptLiveStroke, canvasKey]);

  useEffect(() => {
    // 로그인 변경과 같은 사용자 재로그인도 이전 소켓의 ACK 대기를 폐기한다.
    if (options.sessionVersion !== undefined) ownerRef.current?.resetSession();
  }, [options.sessionVersion]);

  const { connection } = useCanvasConnection(
    {
      onReady: (socket, ready) => {
        if (ready.canvasKey !== 'main')
          setDimensions({ width: ready.season.width, height: ready.season.height });
        ownerRef.current?.ready(socket, ready);
        callbacksRef.current.onReady?.(ready);
      },
      onInterrupted: () => ownerRef.current?.interrupted(),
      onPreview: preview => ownerRef.current?.acceptPreview(preview),
      onSeasonState: event => {
        ownerRef.current?.seasonState(event);
        callbacksRef.current.onSeasonState?.(event);
      },
    },
    canvasKey,
    options.reconnectVersion ?? 0,
    options.enabled ?? true
  );

  return {
    connection,
    sync,
    dimensions,
    strokeNotice,
    onStrokeNoticeOpenChange,
    drawingModel: {
      ...drawingModel,
      drawing: {
        ...drawingModel.drawing,
        liveStrokes: [],
        // 실제 입력은 서버 레이어와 미확인 꼬리에 이미 있으므로 전체 획을 중복 합성하지 않는다.
        activeStroke: mode === 'practice' ? drawingModel.drawing.activeStroke : null,
        serverChunks: sync.previews,
        optimisticStrokes: sync.optimisticStrokes,
        epoch: sync.epoch,
        userId: sync.userId,
        resetVersion: sync.resetVersion,
      },
    },
  };
}
