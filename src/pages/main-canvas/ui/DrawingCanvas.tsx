import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import type { CanvasView } from '../lib/canvasTransform';

interface DrawingCanvasProps {
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  worldWidth: number;
  worldHeight: number;
  view: CanvasView;
}

// 측정된 화면 크기와 view를 받아 Canvas 2D에 표시한다. DOM 크기 관찰은 상위 훅이 맡는다.
export function DrawingCanvas({
  viewportWidth,
  viewportHeight,
  pixelRatio,
  worldWidth,
  worldHeight,
  view: { scale, offsetX, offsetY },
}: DrawingCanvasProps) {
  const { t } = useTranslation('mainCanvas');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  // 재시도 버튼이 값을 바꾸면 동일한 화면 설정으로도 초기화 effect를 다시 실행한다.
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 실제 그리기는 브라우저의 다음 화면 갱신 시점에 맞춰 실행한다.
    const frame = requestAnimationFrame(() => {
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context is unavailable');

        // CSS 크기에 기기 픽셀 비율을 곱해 고해상도 화면에서도 선명하게 표시한다.
        // width/height 재설정은 기존 픽셀과 컨텍스트 설정을 초기화한다. 실제 그림을 연결할 때는
        // 그림 데이터/영역별 버퍼를 별도로 유지하고, 이 화면용 canvas에 다시 표시해야 한다.
        canvas.width = Math.round(viewportWidth * pixelRatio);
        canvas.height = Math.round(viewportHeight * pixelRatio);
        const styles = getComputedStyle(canvas);
        // 도화지 좌표에 배율·가운데 이동을 적용한 뒤 기기의 실제 픽셀 좌표로 변환한다.
        // setTransform은 이전 변환을 교체하므로 리사이즈해도 배율이 중첩되지 않는다.
        context.setTransform(
          pixelRatio * scale,
          0,
          0,
          pixelRatio * scale,
          pixelRatio * offsetX,
          pixelRatio * offsetY
        );
        // 작업 공간 배경은 CSS가, 원본 좌표 기준 도화지의 표면과 경계는 Canvas 2D가 그린다.
        context.fillStyle = styles.getPropertyValue('--canvas-paper').trim();
        context.fillRect(0, 0, worldWidth, worldHeight);
        context.strokeStyle = styles.getPropertyValue('--canvas-border').trim();
        context.lineWidth = 1 / scale; // 전체 보기 배율과 관계없이 경계는 화면에서 1 CSS 픽셀이다.
        context.strokeRect(0, 0, worldWidth, worldHeight);
        setFailed(false);
      } catch {
        // 컨텍스트 생성 또는 그리기가 실패하면 페이지 안에서 재시도 안내를 표시한다.
        setFailed(true);
      }
    });

    // 설정이 다시 바뀌거나 페이지를 떠나면 이전 설정으로 예약된 그리기를 취소한다.
    return () => cancelAnimationFrame(frame);
  }, [
    viewportWidth,
    viewportHeight,
    pixelRatio,
    worldWidth,
    worldHeight,
    scale,
    offsetX,
    offsetY,
    attempt,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        role="img"
        aria-label={t('blankCanvas', { width: worldWidth, height: worldHeight })}
        aria-hidden={failed || undefined}
      >
        {t('unsupported')}
      </canvas>
      {failed && (
        <div className="canvas-error" role="alert">
          <p>{t('initializationError')}</p>
          <Button size="sm" onClick={() => setAttempt(previous => previous + 1)}>
            {t('retry')}
          </Button>
        </div>
      )}
    </>
  );
}
