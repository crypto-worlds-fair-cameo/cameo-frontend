import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanvasViewport } from '../model/useCanvasViewport';
import { DrawingCanvas } from './DrawingCanvas';
import './canvas.css';

interface CanvasViewportProps {
  worldWidth: number;
  worldHeight: number;
  children?: ReactNode;
}

// 작업 공간의 배치와 측정 결과를 렌더러에 연결한다. Canvas 2D 그리기는 DrawingCanvas가 맡는다.
export function CanvasViewport({ worldWidth, worldHeight, children }: CanvasViewportProps) {
  const { t } = useTranslation('mainCanvas');
  const { containerRef, viewport, view } = useCanvasViewport(worldWidth, worldHeight);

  return (
    <div
      ref={containerRef}
      className="canvas-viewport cameo-light"
      role="region"
      aria-label={t('workspace')}
      aria-busy={!view}
    >
      {/* 측정 전에는 배율을 계산할 수 없으므로, 유효한 view가 생긴 뒤 canvas를 마운트한다. */}
      {view ? (
        <DrawingCanvas
          viewportWidth={viewport.width}
          viewportHeight={viewport.height}
          pixelRatio={viewport.pixelRatio}
          worldWidth={worldWidth}
          worldHeight={worldHeight}
          view={view}
        />
      ) : (
        <span className="sr-only" role="status">
          {t('preparing')}
        </span>
      )}
      {children}
    </div>
  );
}
