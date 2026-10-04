import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import type { CanvasView } from '../lib/canvasTransform';
import { createCanvasDrawingRenderer } from '../lib/createCanvasDrawingRenderer';
import { useCanvasPointer } from '../model/useCanvasPointer';
import type { CanvasDrawingModel } from '../model/useCanvasDrawing';
import type { CanvasMode } from '../model/useCanvasMode';
import { BrushCursor } from './BrushCursor';

interface DrawingCanvasProps {
  viewportWidth: number;
  viewportHeight: number;
  pixelRatio: number;
  worldWidth: number;
  worldHeight: number;
  view: CanvasView;
  brushSettings: BrushSettings;
  mode: CanvasMode;
  drawingModel: CanvasDrawingModel;
}

// 측정된 화면 크기와 view를 받아 Canvas 2D에 표시한다. DOM 크기 관찰은 상위 훅이 맡는다.
export function DrawingCanvas({
  viewportWidth,
  viewportHeight,
  pixelRatio,
  worldWidth,
  worldHeight,
  view,
  brushSettings,
  mode,
  drawingModel,
}: DrawingCanvasProps) {
  const { t } = useTranslation('mainCanvas');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<typeof createCanvasDrawingRenderer> | null>(null);
  const { scale, offsetX, offsetY } = view;
  const { drawing, revision } = drawingModel;
  const { cursor, handlers, cancelInput } = useCanvasPointer(
    canvasRef,
    view,
    mode,
    drawingModel,
    worldWidth,
    worldHeight
  );
  const [failed, setFailed] = useState(false);
  const failedAttempt = useRef<number | null>(null);
  // 재시도 버튼이 값을 바꾸면 동일한 화면 설정으로도 초기화 effect를 다시 실행한다.
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    // 렌더링 실패 뒤에는 미완료 획을 취소한 상태로 사용자의 명시적인 재시도를 기다린다.
    if (failed && failedAttempt.current === attempt) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 실제 그리기는 브라우저의 다음 화면 갱신 시점에 맞춰 실행한다.
    const frame = requestAnimationFrame(() => {
      try {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas 2D context is unavailable');

        // CSS 크기에 기기 픽셀 비율을 곱해 고해상도 화면에서도 선명하게 표시한다.
        // 버퍼 크기가 바뀌면 픽셀이 초기화되므로 원본 좌표로 보관한 획을 아래에서 다시 그린다.
        const width = Math.round(viewportWidth * pixelRatio);
        const height = Math.round(viewportHeight * pixelRatio);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, width, height);
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

        // 렌더러는 완료한 실제 그림을 캐시하고, 진행 중·연습 획만 별도로 합성한다.
        rendererRef.current ??= createCanvasDrawingRenderer();
        rendererRef.current.render(context, drawing, mode, {
          width,
          height,
          pixelRatio,
          view: { scale, offsetX, offsetY },
          worldWidth,
          worldHeight,
        });
        context.strokeStyle = styles.getPropertyValue('--canvas-border').trim();
        context.lineWidth = 1 / scale; // 전체 보기 배율과 관계없이 경계는 화면에서 1 CSS 픽셀이다.
        context.strokeRect(0, 0, worldWidth, worldHeight);
        setFailed(false);
      } catch {
        // 컨텍스트 생성 또는 그리기가 실패하면 페이지 안에서 재시도 안내를 표시한다.
        cancelInput();
        failedAttempt.current = attempt;
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
    drawing,
    revision,
    mode,
    failed,
    cancelInput,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`drawing-canvas${cursor && !failed ? ' has-brush-cursor' : ''}`}
        role="img"
        aria-label={t('canvasLabel', { width: worldWidth, height: worldHeight })}
        aria-hidden={failed || undefined}
        {...(!failed ? handlers : {})}
      >
        {t('unsupported')}
      </canvas>
      {cursor && !failed && (
        <BrushCursor point={cursor} brush={drawingModel.cursorBrush ?? brushSettings} view={view} />
      )}
      {failed && (
        <div className="canvas-error" role="alert">
          <p>{t('initializationError')}</p>
          <Button
            size="sm"
            onClick={() => {
              setAttempt(previous => previous + 1);
            }}
          >
            {t('retry')}
          </Button>
        </div>
      )}
    </>
  );
}
