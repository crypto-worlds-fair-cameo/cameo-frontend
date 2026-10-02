import {
  strokeCap,
  strokePath,
  strokeWidth,
  type Stroke,
  type useCanvasStudio,
} from '../model/useCanvasStudio';

type Studio = ReturnType<typeof useCanvasStudio>;

function DrawPath({ stroke }: { stroke: Stroke }) {
  return (
    <path
      d={strokePath(stroke.points)}
      fill="none"
      stroke={stroke.color}
      strokeWidth={strokeWidth(stroke.brush, stroke.width)}
      strokeOpacity={stroke.opacity}
      strokeLinecap={strokeCap(stroke.brush)}
      strokeLinejoin="round"
    />
  );
}

export function MiniMap({ studio }: { studio: Studio }) {
  return (
    <div className="minimap-frame" aria-hidden="true">
      <svg viewBox="-5000 -5000 10000 10000">
        <rect x={-5000} y={-5000} width={10000} height={10000} fill="#fff" />
        {studio.stroke && <DrawPath stroke={studio.stroke} />}
      </svg>
    </div>
  );
}
