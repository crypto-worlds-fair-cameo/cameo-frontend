import { useState } from 'react';
import { useIsMobile } from '@/shared/lib/hooks/use-mobile';
import { ColorPalette } from '@/shared/ui/color-palette/ColorPalette';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { CanvasViewport } from './ui/CanvasViewport';
import { CanvasStatsPanel } from './ui/CanvasStatsPanel';
import { useCanvasConnection } from './model/useCanvasConnection';

/**
 * 메인 캔버스의 진입점. 도화지 크기를 정하고 페이지 내부 UI를 조립한다.
 *
 * 화면이 만들어지는 순서:
 * 1. app의 Layout이 헤더 아래에 캔버스 전용 작업 공간을 확보한다.
 * 2. 범용 왼쪽 영역에 도구 패널을 배치하고 CanvasViewport가 남은 작업 공간을 측정한다.
 * 3. 측정값으로 도화지 전체가 보이는 배율과 가운데 위치를 계산한다.
 * 4. DrawingCanvas가 화면 해상도에 맞는 Canvas 2D에 빈 도화지를 표시한다.
 * 5. 페이지가 소켓 하나를 연결하고 ready/presence/reset을 오른쪽 Stats 패널에 전달한다.
 *    페이지를 떠나면 소켓과 타이머를 정리한다. 연결 끊김은 도화지를 지우지 않는다.
 * 6. 페이지가 브러시 설정을 소유하고 팔레트·미리보기에 연결한다. 실제 드로잉은 아직 연결하지 않는다.
 *
 * 10,000 × 10,000은 원본 도화지의 좌표 범위다. 실제 화면용 canvas의 픽셀 크기는
 * 작업 공간의 크기와 devicePixelRatio로 정하므로 원본 크기의 버퍼를 만들지 않는다.
 */
const MainCanvasPage = () => {
  const isMobile = useIsMobile();
  // 브러시 설정은 이 페이지에서 한 번만 생성한다. 시즌 페이지도 자체 설정을 같은 패널에 전달할 수 있다.
  const [brushSettings, setBrushSettings] = useState(defaultBrushSettings);
  // 이 페이지가 소켓 하나를 소유하고, 서버 이벤트로 갱신된 상태와 수동 재시도를 Stats 패널에 연결한다.
  const { connection, retry } = useCanvasConnection();
  return (
    <div className="main-canvas-layout cameo-light">
      {/* 왼쪽 영역은 여러 패널을 담는 공간이며, 각 패널의 내부 배치는 해당 컴포넌트가 소유한다. */}
      <aside className="canvas-left-sidebar">
        <ColorPalette
          value={brushSettings}
          onValueChange={setBrushSettings}
          defaultOpen={!isMobile}
        />
      </aside>
      <CanvasViewport worldWidth={10_000} worldHeight={10_000} />
      {/* 오른쪽 영역은 독립 패널을 배치하는 공간이며, 각 패널이 자체 UI를 소유한다. */}
      <aside className="canvas-right-area">
        <CanvasStatsPanel connection={connection} onRetry={retry} />
      </aside>
    </div>
  );
};

export default MainCanvasPage;
