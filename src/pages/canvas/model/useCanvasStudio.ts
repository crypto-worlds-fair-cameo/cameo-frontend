import { useMemo, useRef, useState } from 'react';
import {
  CAMERA_HOME,
  cameraFor,
  clampPitch,
  clampSpan,
  wrapYaw,
  type CameraPose,
  type CameraView,
} from './camera';

export type Point = { x: number; y: number };
export type Brush = 'round' | 'flat' | 'airbrush';
export type Stroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  opacity: number;
  brush: Brush;
};

const DEFAULT_COLOR = '#ED4242';
export const WORLD = 10000;
export const VIEW = 771;

export const viewSpan = (zoom: number) => VIEW / (zoom / 100);

export const clampPan = (value: number, zoom: number) => {
  const max = Math.max(0, WORLD - viewSpan(zoom));
  return Math.min(max, Math.max(0, value));
};

const centeredPan = (zoom: number) => {
  const value = clampPan((WORLD - viewSpan(zoom)) / 2, zoom);
  return { x: value, y: value };
};

let strokeSeq = 0;
const nextId = () => `stroke-${(strokeSeq += 1)}`;

export const strokePath = (points: Point[]) =>
  points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

export const hexToRgb = (hex: string) => {
  const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex : DEFAULT_COLOR;
  return {
    r: parseInt(color.slice(1, 3), 16),
    g: parseInt(color.slice(3, 5), 16),
    b: parseInt(color.slice(5, 7), 16),
  };
};

export const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase();

export const strokeWidth = (brush: Brush, size: number) => (brush === 'flat' ? size * 0.45 : size);

export const strokeAlpha = (brush: Brush, opacity: number) =>
  brush === 'airbrush' ? (opacity / 100) * 0.55 : opacity / 100;

export const strokeCap = (brush: Brush) => (brush === 'flat' ? 'butt' : 'round');

export function useCanvasStudio() {
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [opacity, setOpacity] = useState(100);
  const [brushSize, setBrushSize] = useState(78);
  const [brush, setBrush] = useState<Brush>('round');
  const [zoom, setZoomState] = useState(100);
  const [pan, setPan] = useState(() => centeredPan(100));
  const [draft, setDraft] = useState<Stroke | null>(null);
  const [stroke, setStroke] = useState<Stroke | null>(null);
  const [practice, setPractice] = useState(false);
  const [practiceStrokes, setPracticeStrokes] = useState<Stroke[]>([]);
  const draftRef = useRef<Stroke | null>(null);
  const practiceRef = useRef(false);
  const practiceStrokesRef = useRef<Stroke[]>([]);
  const zoomRef = useRef(100);
  const panRef = useRef(centeredPan(100));
  const [camera, setCamera] = useState<CameraPose>(CAMERA_HOME);
  const cameraRef = useRef(CAMERA_HOME);

  const canDraw = useMemo(() => practice || stroke == null, [practice, stroke]);

  const setChannel = (channel: 'r' | 'g' | 'b', value: number) => {
    const current = hexToRgb(color);
    current[channel] = value;
    setColor(rgbToHex(current.r, current.g, current.b));
  };

  const beginStroke = (point: Point) => {
    if (draftRef.current) return;
    if (!practiceRef.current && stroke) return;
    const next = {
      id: nextId(),
      points: [point],
      color,
      width: brushSize,
      opacity: strokeAlpha(brush, opacity),
      brush,
    };
    draftRef.current = next;
    setDraft(next);
  };

  const extendStroke = (point: Point) => {
    const current = draftRef.current;
    if (!current) return;
    const next = { ...current, points: [...current.points, point] };
    draftRef.current = next;
    setDraft(next);
  };

  const endStroke = () => {
    const current = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!current || current.points.length < 2) return;
    if (practiceRef.current) {
      const next = [...practiceStrokesRef.current, current];
      practiceStrokesRef.current = next;
      setPracticeStrokes(next);
      return;
    }
    if (!stroke) setStroke(current);
  };

  const setPracticeMode = (on: boolean) => {
    draftRef.current = null;
    setDraft(null);
    practiceRef.current = on;
    setPractice(on);
  };

  const discardStroke = () => {
    draftRef.current = null;
    setDraft(null);
    setStroke(null);
  };

  const panBy = (dx: number, dy: number) => {
    const next = {
      x: clampPan(panRef.current.x + dx, zoomRef.current),
      y: clampPan(panRef.current.y + dy, zoomRef.current),
    };
    panRef.current = next;
    setPan(next);
  };

  const setZoom = (value: number) => {
    const nextZoom = Math.min(200, Math.max(25, value));
    const currentSpan = viewSpan(zoomRef.current);
    const nextSpan = viewSpan(nextZoom);
    const nextPan = {
      x: clampPan(panRef.current.x + currentSpan / 2 - nextSpan / 2, nextZoom),
      y: clampPan(panRef.current.y + currentSpan / 2 - nextSpan / 2, nextZoom),
    };
    zoomRef.current = nextZoom;
    panRef.current = nextPan;
    setZoomState(nextZoom);
    setPan(nextPan);
  };

  const recenter = () => {
    const next = centeredPan(zoomRef.current);
    panRef.current = next;
    setPan(next);
  };

  const orbitBy = (dyaw: number, dpitch: number) => {
    const next = {
      ...cameraRef.current,
      yaw: wrapYaw(cameraRef.current.yaw + dyaw),
      pitch: clampPitch(cameraRef.current.pitch + dpitch),
    };
    cameraRef.current = next;
    setCamera(next);
  };

  const zoomBy = (factor: number) => {
    const next = { ...cameraRef.current, span: clampSpan(cameraRef.current.span / factor) };
    cameraRef.current = next;
    setCamera(next);
  };

  const lookFrom = (view: CameraView) => {
    const snapped = cameraFor(view);
    const next = {
      ...snapped,
      span: view === 'home' ? snapped.span : cameraRef.current.span,
    };
    cameraRef.current = next;
    setCamera(next);
  };

  return {
    color,
    opacity,
    brushSize,
    zoom,
    pan,
    draft,
    stroke,
    practice,
    practiceStrokes,
    canDraw,
    setColor,
    setOpacity,
    setBrushSize,
    setZoom,
    setChannel,
    brush,
    setBrush,
    beginStroke,
    extendStroke,
    endStroke,
    discardStroke,
    setPracticeMode,
    panBy,
    recenter,
    camera,
    orbitBy,
    zoomBy,
    lookFrom,
  };
}
