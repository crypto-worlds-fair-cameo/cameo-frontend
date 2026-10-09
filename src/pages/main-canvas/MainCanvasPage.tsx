import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useIsMobile } from '@/shared/lib/hooks/use-mobile';
import { Button } from '@/shared/ui/button';
import { ColorPalette } from '@/shared/ui/color-palette/ColorPalette';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { CanvasViewport } from '@/features/canvas-workspace';
import { CanvasStatsPanel } from './ui/CanvasStatsPanel';
import { useCanvasRealtime } from '@/features/canvas-workspace';
import { CanvasSyncStatus } from './ui/CanvasSyncStatus';
import { CanvasStrokeLimitDialog } from './ui/CanvasStrokeLimitDialog';
import { CanvasStrokeNotice } from './ui/CanvasStrokeNotice';
import { useCanvasMode } from '@/features/canvas-workspace';

/**
 * 메인 캔버스의 진입점. 도화지 크기를 정하고 페이지 내부 UI를 조립한다.
 *
 * 화면이 만들어지는 순서:
 * 1. app의 Layout이 헤더 아래에 캔버스 전용 작업 공간을 확보한다.
 * 2. 범용 왼쪽 영역에 도구 패널을 배치하고 CanvasViewport가 남은 작업 공간을 측정한다.
 * 3. 측정값으로 도화지 전체가 보이는 배율과 가운데 위치를 계산한다.
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
  return (
    <div className="main-canvas-layout cameo-light" data-mode={mode}>
      {/* 왼쪽 영역은 여러 패널을 담는 공간이며, 각 패널의 내부 배치는 해당 컴포넌트가 소유한다. */}
      <aside className="canvas-left-sidebar">
        <ColorPalette
          value={brushSettings}
          onValueChange={setBrushSettings}
          defaultOpen={!isMobile}
        />
      </aside>
      <CanvasViewport
        worldWidth={10_000}
        worldHeight={10_000}
        brushSettings={brushSettings}
        mode={mode}
        drawingModel={drawingModel}
      />
      {/* 오른쪽 영역은 독립 패널을 배치하는 공간이며, 각 패널이 자체 UI를 소유한다. */}
      <aside className="canvas-right-area">
        {/* 모드와 규칙을 먼저 표시해 모바일의 짧은 패널에서도 바로 읽을 수 있게 한다. */}
        <div className="canvas-mode-control">
          <Button
            variant={isPracticeMode ? 'primary' : 'secondary'}
            aria-pressed={isPracticeMode}
            onClick={toggleMode}
          >
            {t(isPracticeMode ? 'changeToDrawMode' : 'changeToPracticeMode')}
          </Button>
          <CanvasStrokeNotice mode={mode} />
        </div>
        <CanvasStatsPanel connection={connection} />
        <CanvasSyncStatus sync={sync} onRetry={retryRecovery} />
      </aside>
      <CanvasStrokeLimitDialog
        open={strokeNotice !== null}
        completed={strokeNotice === 'completed'}
        onOpenChange={onStrokeNoticeOpenChange}
      />
    </div>
  );
};

export default MainCanvasPage;
