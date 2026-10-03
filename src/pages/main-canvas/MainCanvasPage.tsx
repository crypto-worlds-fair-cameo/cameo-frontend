import { CanvasViewport } from './ui/CanvasViewport';
import { CanvasConnectionStatus } from './ui/CanvasConnectionStatus';
import { useCanvasConnection } from './model/useCanvasConnection';

/**
 * 메인 캔버스의 진입점. 도화지 크기를 정하고 페이지 내부 UI를 조립한다.
 *
 * 화면이 만들어지는 순서:
 * 1. app의 Layout이 헤더 아래에 캔버스 전용 작업 공간을 확보한다.
 * 2. CanvasViewport가 작업 공간의 DOM을 만들고 useCanvasViewport로 크기를 측정한다.
 * 3. 측정값으로 도화지 전체가 보이는 배율과 가운데 위치를 계산한다.
 * 4. DrawingCanvas가 화면 해상도에 맞는 Canvas 2D에 빈 도화지를 표시한다.
 * 5. 페이지가 소켓 하나를 연결하고 ready/presence/reset을 연결 상태 UI에 전달한다.
 *    페이지를 떠나면 소켓과 타이머를 정리한다. 연결 끊김은 도화지를 지우지 않는다.
 *
 * 10,000 × 10,000은 원본 도화지의 좌표 범위다. 실제 화면용 canvas의 픽셀 크기는
 * 작업 공간의 크기와 devicePixelRatio로 정하므로 원본 크기의 버퍼를 만들지 않는다.
 */
const MainCanvasPage = () => {
  const { connection, retry } = useCanvasConnection();
  return (
    <CanvasViewport worldWidth={10_000} worldHeight={10_000}>
      <CanvasConnectionStatus connection={connection} onRetry={retry} />
    </CanvasViewport>
  );
};

export default MainCanvasPage;
