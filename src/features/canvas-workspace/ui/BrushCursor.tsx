import { useId } from 'react';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { worldToScreen, type CanvasPoint, type CanvasView } from '../lib/canvasTransform';

/** 실제 획과 같은 원본 크기에 배율을 적용하고, 대비 테두리로 브러쉬 위치를 표시한다. */
export function BrushCursor({
  point,
  brush,
  view,
}: {
  point: CanvasPoint;
  brush: BrushSettings;
  view: CanvasView;
}) {
  const gradientId = useId();
  const { x, y } = worldToScreen(point, view);
  const size = brush.brushSize * view.scale;
  const flat = brush.brushType === 'flat';
  const fill = brush.brushType === 'airbrush' ? `url(#${gradientId})` : brush.color;
  const shape = flat ? <rect width="100" height="100" /> : <circle cx="50" cy="50" r="50" />;

  return (
    <svg
      className="canvas-brush-cursor"
      data-brush-type={brush.brushType}
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ left: x, top: y }}
    >
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0" stopColor={brush.color} />
          <stop offset="1" stopColor={brush.color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill={fill}>{shape}</g>
      {/* 흰색·검은색 테두리는 색상에 관계없이 실제 브러쉬 위치를 표시한다. */}
      <g fill="none" stroke="white" strokeWidth="2" vectorEffect="non-scaling-stroke">
        {flat ? (
          <rect width="100" height="100" vectorEffect="non-scaling-stroke" />
        ) : (
          <circle cx="50" cy="50" r="50" vectorEffect="non-scaling-stroke" />
        )}
      </g>
      <g fill="none" stroke="black" strokeWidth="1">
        {flat ? (
          <rect width="100" height="100" vectorEffect="non-scaling-stroke" />
        ) : (
          <circle cx="50" cy="50" r="50" vectorEffect="non-scaling-stroke" />
        )}
      </g>
    </svg>
  );
}
