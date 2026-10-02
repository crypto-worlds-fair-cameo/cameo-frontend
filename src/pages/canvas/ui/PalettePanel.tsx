import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { project } from '../model/camera';
import {
  hexToRgb,
  strokeAlpha,
  strokeCap,
  strokeWidth,
  type Brush,
  type useCanvasStudio,
} from '../model/useCanvasStudio';

const PALETTE_HOME = { x: 56, y: 187 };
const FRAME_W = 1920;
const FRAME_H = 1080;

const frameScale = (node: HTMLElement) => {
  const frame = node.closest('.frame');
  if (!(frame instanceof HTMLElement)) return 1;
  const raw = Number(getComputedStyle(frame).getPropertyValue('--frame-scale'));
  return raw > 0 ? raw : frame.getBoundingClientRect().width / FRAME_W;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const isDragIgnore = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('button, input, label'));

type Studio = ReturnType<typeof useCanvasStudio>;

const SWATCHES = [
  ['#000000', '#4F4F4F', '#8E8E8E', '#D6D6D6', '#FFFFFF', '#7A4E2A', '#B5651D'],
  ['#ED4242', '#FF2D6F', '#FF4D8D', '#FF6A3D', '#FFC24B', '#0E7A4E', '#14F195'],
  ['#2CC3B0', '#4BA3FF', '#2A43D0', '#5D4EE2', '#9945FF', '#641ACB', '#C724B1'],
];

const CHANNELS = [
  { key: 'r', label: 'R', color: '#EE2233', max: '#FF0000' },
  { key: 'g', label: 'G', color: '#00CC00', max: '#00FF00' },
  { key: 'b', label: 'B', color: '#3366FF', max: '#0000FF' },
] as const;

const BRUSHES: { id: Brush; label: string; className?: string }[] = [
  { id: 'round', label: 'Round Brush' },
  { id: 'flat', label: 'Flat Brush' },
  { id: 'airbrush', label: 'Airbrush', className: 'brush-air' },
];

function ChannelSlider({
  label,
  color,
  max,
  value,
  onChange,
}: {
  label: string;
  color: string;
  max: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="gradient-slider">
      <span style={{ color }}>{label}</span>
      <label
        className="gradient-track"
        style={{ background: `linear-gradient(90deg, #262626 0%, ${max} 100%)` }}
      >
        <input
          type="range"
          min={0}
          max={255}
          aria-label={`${label} channel`}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
        <span
          className="gradient-thumb"
          style={{ left: `${(value / 255) * 100}%`, borderColor: color }}
        />
      </label>
      <span className="gradient-value">{value}</span>
    </div>
  );
}

function BrushPreview({ studio }: { studio: Studio }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [boxW, setBoxW] = useState(158);
  useEffect(() => {
    const fit = () => {
      setView({ w: window.innerWidth, h: window.innerHeight });
      setBoxW(boxRef.current?.getBoundingClientRect().width || 158);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const scale = project(0, 0, 0, studio.camera, view.w, view.h)?.scale ?? 0;
  const screenWidth = Math.max(1.2, strokeWidth(studio.brush, studio.brushSize) * scale);
  const width = screenWidth * (158 / Math.max(1, boxW));
  return (
    <div className="preview-box" ref={boxRef} aria-hidden="true">
      <svg viewBox="0 0 158 72" preserveAspectRatio="xMidYMid meet">
        <path
          d="M 14 40 C 50 16, 108 16, 144 40"
          fill="none"
          stroke={studio.color}
          strokeWidth={width}
          strokeOpacity={strokeAlpha(studio.brush, studio.opacity)}
          strokeLinecap={strokeCap(studio.brush)}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function PalettePanel({ studio }: { studio: Studio }) {
  const rgb = hexToRgb(studio.color);
  const nodeRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [open, setOpen] = useState(true);
  const [customOpen, setCustomOpen] = useState(true);
  const [pos, setPos] = useState(PALETTE_HOME);
  const [dragging, setDragging] = useState(false);

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <aside
      ref={nodeRef}
      className={[
        'palette',
        open ? '' : 'is-collapsed',
        customOpen ? '' : 'custom-closed',
        dragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={event => {
        if (event.button !== 0 || isDragIgnore(event.target)) return;
        const node = nodeRef.current;
        if (!node) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: pos.x,
          originY: pos.y,
        };
        node.setPointerCapture(event.pointerId);
        setDragging(true);
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        const node = nodeRef.current;
        if (!drag || !node || event.pointerId !== drag.pointerId) return;
        const scale = frameScale(node);
        setPos({
          x: clamp(
            drag.originX + (event.clientX - drag.startX) / scale,
            0,
            FRAME_W - node.offsetWidth
          ),
          y: clamp(
            drag.originY + (event.clientY - drag.startY) / scale,
            0,
            FRAME_H - node.offsetHeight
          ),
        });
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="panel-head">
        <h2>Color Palette</h2>
        <button
          type="button"
          className="panel-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse color palette' : 'Expand color palette'}
          onClick={() => setOpen(value => !value)}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2 4.5 6 8.5 10 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      <div className="panel-body">
        <div className="swatch-grid">
          {SWATCHES.flat().map(swatch => (
            <button
              key={swatch}
              type="button"
              className="swatch"
              data-light={swatch === '#FFFFFF' || undefined}
              aria-label={swatch}
              aria-pressed={studio.color.toUpperCase() === swatch}
              style={{ background: swatch }}
              onClick={() => studio.setColor(swatch)}
            />
          ))}
        </div>
        <button
          type="button"
          className="custom-row"
          aria-expanded={customOpen}
          onClick={() => setCustomOpen(value => !value)}
        >
          <span className="custom-dot" style={{ background: studio.color }} />
          Custom
          <i className="custom-chevron" />
        </button>
        <div className="custom-body">
          <div className="hex-field">{studio.color.toUpperCase()}</div>
          {CHANNELS.map(channel => (
            <ChannelSlider
              key={channel.key}
              label={channel.label}
              color={channel.color}
              max={channel.max}
              value={rgb[channel.key]}
              onChange={value => studio.setChannel(channel.key, value)}
            />
          ))}
        </div>
        <div className="palette-tools">
          <div className="palette-rule" />
          <div className="brush-tools">
            {BRUSHES.map(item => (
              <button
                key={item.id}
                type="button"
                className={item.className}
                aria-pressed={studio.brush === item.id}
                onClick={() => studio.setBrush(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="tool-label">Brush Size</p>
          <label className="plain-slider">
            <span className="plain-track">
              <span
                className="plain-fill"
                style={{ width: `${(studio.brushSize / 160) * 100}%`, background: '#171717' }}
              />
              <input
                type="range"
                min={4}
                max={160}
                aria-label="Brush size"
                value={studio.brushSize}
                onChange={event => studio.setBrushSize(Number(event.target.value))}
              />
              <span
                className="plain-thumb"
                style={{ left: `${(studio.brushSize / 160) * 100}%` }}
              />
            </span>
          </label>
          <p className="tool-label">Opacity {studio.opacity}%</p>
          <label className="plain-slider">
            <span className="plain-track">
              <span
                className="plain-fill"
                style={{ width: `${studio.opacity}%`, background: '#6B6B6B' }}
              />
              <input
                type="range"
                min={0}
                max={100}
                aria-label="Opacity"
                value={studio.opacity}
                onChange={event => studio.setOpacity(Number(event.target.value))}
              />
              <span className="plain-thumb" style={{ left: `${studio.opacity}%` }} />
            </span>
          </label>
          <p className="preview-label">Preview</p>
          <BrushPreview studio={studio} />
        </div>
      </div>
    </aside>
  );
}
