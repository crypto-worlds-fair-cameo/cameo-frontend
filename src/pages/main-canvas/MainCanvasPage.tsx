import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/shared/lib/hooks/use-mobile';
import { Button } from '@/shared/ui/button';
import { ColorPalette } from '@/shared/ui/color-palette/ColorPalette';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { CanvasNavigator, CanvasViewport, useCanvasZoom } from '@/features/canvas-workspace';
import { useFitToHeight } from './model/useFitToHeight';
import { CanvasStatsPanel } from './ui/CanvasStatsPanel';
import { useCanvasRealtime } from '@/features/canvas-workspace';
import { CanvasSyncStatus } from './ui/CanvasSyncStatus';
import { CanvasStrokeLimitDialog } from './ui/CanvasStrokeLimitDialog';
import { CanvasWalletRequiredDialog } from './ui/CanvasWalletRequiredDialog';
import { CanvasStrokeNotice } from './ui/CanvasStrokeNotice';
import { CanvasLoadingOverlay } from './ui/CanvasLoadingOverlay';
import { useCanvasMode } from '@/features/canvas-workspace';
import './ui/main-canvas.css';

const CANVAS_SIZE = 10_000;

/**
 * 메인 캔버스의 진입점. 도화지 크기를 정하고 페이지 내부 UI를 조립한다.
 *
 * 화면이 만들어지는 순서:
 * 1. app의 Layout이 헤더 아래에 캔버스 전용 작업 공간을 확보한다.
 * 2. 범용 왼쪽 영역에 도구 패널을 배치하고 CanvasViewport가 남은 작업 공간을 측정한다.
 * 3. 측정값으로 도화지 전체가 보이는 배율과 가운데 위치를 계산한다. 휠·+/−·지도로 최대 10배까지 확대하고,
 *    스페이스바+드래그 또는 휠 버튼 드래그로 화면을 옮긴다.
 * 4. DrawingCanvas가 화면 해상도에 맞는 Canvas 2D에 서버 순서의 그림을 표시한다.
 * 5. 페이지가 소켓 하나를 연결하고 연결 수와 그림 동기화 상태를 오른쪽 패널에 전달한다.
 *    페이지를 떠나면 소켓과 타이머를 정리한다. 연결 끊김은 도화지를 지우지 않는다.
 * 6. 실제 획은 그리는 동안 전송하고 포인터 종료 순간 사용 완료를 알린다. 연습 획은 로컬에만 유지한다.
 * 7. 페이지가 실제·연습 모드를 소유하고 모드 버튼에 선택 상태와 전환 동작을 연결한다.
 *
 * 10,000 × 10,000은 원본 도화지의 좌표 범위다. 실제 화면용 canvas의 픽셀 크기는
 * 작업 공간의 크기와 devicePixelRatio로 정하므로 원본 크기의 버퍼를 만들지 않는다.
 */
const MainCanvasPage = () => {
  const { t } = useTranslation('mainCanvas');
  const isMobile = useIsMobile();
  // 브러시 설정은 이 페이지에서 한 번만 생성한다. 시즌 페이지도 자체 설정을 같은 패널에 전달할 수 있다.
  const [brushSettings, setBrushSettings] = useState(defaultBrushSettings);
  // 모드는 페이지 수명 동안 유지하며, 연습 모드 선택 여부를 버튼과 작업 영역에 표시한다.
  const { mode, toggleMode } = useCanvasMode();
  const { connection, sync, retryRecovery, drawingModel, strokeNotice, onStrokeNoticeOpenChange } =
    useCanvasRealtime(brushSettings, mode);
  const isPracticeMode = mode === 'practice';
  // 낮은 화면에서는 팔레트만 줄인다. 미니맵은 디자인 치수를 유지하고, 그 높이만큼 팔레트 공간에서 뺀다.
  const leftColumnRef = useRef<HTMLElement>(null);
  const leftContentRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLDivElement>(null);
  useFitToHeight(leftColumnRef, leftContentRef, !isMobile, navigatorRef);
  // 확대 상태는 페이지가 소유하고 도화지·지도·배율 표시가 함께 읽는다.
  const zoom = useCanvasZoom(CANVAS_SIZE, CANVAS_SIZE);
  const [walletNoticeOpen, setWalletNoticeOpen] = useState(false);
  // 첫 그림을 받는 몇 초 동안만 도화지 위에 불러오는 중을 띄운다. 한 번 표시한 뒤의 재연결 복구는
  // 기존 그림을 덮지 않고 오른쪽 안내만 쓴다. 연습 중에는 연습 획을 가리지 않게 표시하지 않고,
  // 연결 재시도·실패 중에는 Stats의 연결 안내와 엇갈리지 않게 표시하지 않는다.
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  if (!firstLoadDone && (sync.status === 'ready' || sync.status === 'failed'))
    setFirstLoadDone(true);
  const showLoading =
    !firstLoadDone &&
    !isPracticeMode &&
    !sync.error &&
    connection.status !== 'reconnecting' &&
    connection.status !== 'failed';
  // 손님의 실제 획은 공통 엔진이 거절한다. 서버가 손님으로 확인한 상태에서
  // 도화지 안의 실제 획이 거절된 경우에만 지갑 연결 안내를 연다.
  const pageDrawingModel: typeof drawingModel = {
    ...drawingModel,
    startStroke: (pointerId, point) => {
      if (drawingModel.startStroke(pointerId, point)) return true;
      const insidePaper =
        point.x >= 0 && point.y >= 0 && point.x < CANVAS_SIZE && point.y < CANVAS_SIZE;
      if (
        mode === 'live' &&
        insidePaper &&
        sync.status === 'ready' &&
        sync.userId === undefined &&
        !sync.error
      )
        setWalletNoticeOpen(true);
      return false;
    },
  };
  return (
    <div
      className="main-canvas-layout main-canvas-page cameo-light"
      data-mode={mode}
      // 휠 확대·끌어 옮기기 중에는 CSS가 도화지 외의 UI(헤더·팔레트·통계·안내 바)를 잠시 숨긴다.
      data-navigating={zoom.navigating || undefined}
    >
      {/* 왼쪽 영역은 여러 패널을 담는 공간이며, 각 패널의 내부 배치는 해당 컴포넌트가 소유한다. */}
      <aside ref={leftColumnRef} className="canvas-left-sidebar">
        {/* 팔레트만 화면 높이에 맞춰 줄어든다. 지도는 그 아래 48px에 디자인 크기 그대로 둔다. */}
        <div ref={leftContentRef} className="main-canvas-left-fit">
          <ColorPalette
            value={brushSettings}
            onValueChange={setBrushSettings}
            defaultOpen={!isMobile}
          />
        </div>
        <div ref={navigatorRef}>
          <CanvasNavigator zoom={zoom} drawingModel={drawingModel} />
        </div>
      </aside>
      <CanvasViewport
        worldWidth={CANVAS_SIZE}
        worldHeight={CANVAS_SIZE}
        brushSettings={brushSettings}
        mode={mode}
        drawingModel={pageDrawingModel}
        // 휴대폰은 확대 도구를 숨기므로 휠 확대도 끄고 도화지 전체 보기로 고정한다.
        zoom={isMobile ? undefined : zoom}
      >
        {showLoading && <CanvasLoadingOverlay />}
      </CanvasViewport>
      {/* 오른쪽 영역은 독립 패널을 배치하는 공간이며, 각 패널이 자체 UI를 소유한다. */}
      <aside className="canvas-right-area">
        <CanvasStatsPanel connection={connection} />
        {/* 버튼 문구가 다음 동작(연습 시작·끝내기)을 나타내므로 눌림 상태는 따로 두지 않는다. */}
        <Button
          variant={isPracticeMode ? 'primary' : 'secondary'}
          className="canvas-mode-button"
          onClick={toggleMode}
        >
          {t(isPracticeMode ? 'exitPractice' : 'practiceMode')}
        </Button>
        {/* 도화지 위 표시와 같은 문구를 오른쪽에 한 번 더 띄우지 않는다. */}
        {!showLoading && <CanvasSyncStatus sync={sync} onRetry={retryRecovery} />}
      </aside>
      <CanvasStrokeNotice mode={mode} strokeUsed={sync.strokeUsed} />
      <CanvasStrokeLimitDialog
        open={strokeNotice === 'limit' || strokeNotice === 'completed'}
        completed={strokeNotice === 'completed'}
        onOpenChange={onStrokeNoticeOpenChange}
      />
      {/* 손님의 실제 획 시도는 헤더의 지갑 연결 버튼으로 안내한다. */}
      <CanvasWalletRequiredDialog open={walletNoticeOpen} onOpenChange={setWalletNoticeOpen} />
    </div>
  );
};

export default MainCanvasPage;
