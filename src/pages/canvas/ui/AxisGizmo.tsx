import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { viewDirection, type CameraView } from '../model/camera';
import type { useCanvasStudio } from '../model/useCanvasStudio';

type Studio = ReturnType<typeof useCanvasStudio>;

const ORIGIN = 52;
const LENGTH = 34;
const AXES = [
  { id: 'x' as const, color: '#EE2233', vector: [1, 0, 0] },
  { id: 'y' as const, color: '#0E7A4E', vector: [0, 1, 0] },
  { id: 'z' as const, color: '#2A43D0', vector: [0, 0, 1] },
];

const arrowPoints = (x: number, y: number, tipX: number, tipY: number) => {
  const dx = tipX - x;
  const dy = tipY - y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;
  const px = -uy * 4.5;
  const py = ux * 4.5;
  const baseX = tipX - ux * 9;
  const baseY = tipY - uy * 9;
  return `${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`;
};

export function AxisGizmo({ studio }: { studio: Studio }) {
  const drag = useRef<{ x: number; y: number; moved: number; axis: CameraView | null } | null>(
    null
  );

  const onDown = (axis: CameraView | null) => (event: ReactPointerEvent<SVGElement>) => {
    event.stopPropagation();
    event.preventDefault();
    drag.current = { x: event.clientX, y: event.clientY, moved: 0, axis };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onMove = (event: ReactPointerEvent<SVGElement>) => {
    const current = drag.current;
    if (!current) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.moved += Math.abs(dx) + Math.abs(dy);
    current.x = event.clientX;
    current.y = event.clientY;
    studio.orbitBy(dx * 0.45, dy * 0.35);
  };

  const onUp = () => {
    const current = drag.current;
    drag.current = null;
    if (current && current.moved < 5 && current.axis) studio.lookFrom(current.axis);
  };

  const posed = AXES.map(axis => {
    const view = viewDirection(axis.vector[0], axis.vector[1], axis.vector[2], studio.camera);
    return {
      ...axis,
      view,
      tipX: ORIGIN + view.x * LENGTH,
      tipY: ORIGIN + view.y * LENGTH,
    };
  }).sort((a, b) => a.view.depth - b.view.depth);

  return (
    <svg className="axis-gizmo" viewBox="0 0 104 104" role="group" aria-label="Camera axes">
      <circle
        className="axis-orbit"
        cx={ORIGIN}
        cy={ORIGIN}
        r="46"
        onPointerDown={onDown(null)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onDoubleClick={() => studio.lookFrom('home')}
      />
      {posed.map(axis => (
        <g
          key={axis.id}
          className="axis-hit"
          role="button"
          aria-label={`Look along ${axis.id.toUpperCase()}`}
          onPointerDown={onDown(axis.id)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <line
            x1={ORIGIN}
            y1={ORIGIN}
            x2={axis.tipX}
            y2={axis.tipY}
            stroke="transparent"
            strokeWidth="16"
          />
          <line
            x1={ORIGIN}
            y1={ORIGIN}
            x2={ORIGIN - (axis.tipX - ORIGIN) * 0.28}
            y2={ORIGIN - (axis.tipY - ORIGIN) * 0.28}
            stroke={axis.color}
            strokeOpacity="0.28"
            strokeWidth="1.5"
          />
          <line
            x1={ORIGIN}
            y1={ORIGIN}
            x2={axis.tipX}
            y2={axis.tipY}
            stroke={axis.color}
            strokeWidth="2"
          />
          <polygon points={arrowPoints(ORIGIN, ORIGIN, axis.tipX, axis.tipY)} fill={axis.color} />
          <text
            x={axis.tipX + (axis.tipX - ORIGIN) * 0.18}
            y={axis.tipY + (axis.tipY - ORIGIN) * 0.18 + 4}
            fill={axis.color}
            fontFamily="Inter, sans-serif"
            fontSize="12"
            textAnchor="middle"
          >
            {axis.id.toUpperCase()}
          </text>
        </g>
      ))}
      <circle cx={ORIGIN} cy={ORIGIN} r="3" fill="#171717" pointerEvents="none" />
    </svg>
  );
}
