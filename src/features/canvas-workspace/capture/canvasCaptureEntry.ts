import type { StrokeBrush, StrokePreview } from '../api/canvasProtocol';
import {
  cloneBrushStrokeState,
  createBrushStrokeState,
  drawBrushStroke,
  type BrushStrokeState,
} from '../lib/drawBrushStroke';
import type { CanvasStroke } from '../model/useCanvasDrawing';

interface CaptureStroke {
  userId: string;
  clientStrokeId: string;
  lastChunkIndex: number;
  brush: StrokeBrush;
  state: BrushStrokeState;
}

interface ActiveStroke extends CaptureStroke {
  brushKey: string;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

let canvas: HTMLCanvasElement | null = null;
let context: CanvasRenderingContext2D | null = null;
let chunkLayer: HTMLCanvasElement | null = null;
let width = 0;
let height = 0;
let lastSequence = 0n;
const states = new Map<string, ActiveStroke>();
const CHUNK_TILE_SIZE = 2048;

function strokeKey(userId: string, clientStrokeId: string) {
  return JSON.stringify([userId, clientStrokeId]);
}

function brushKey(brush: StrokeBrush) {
  return JSON.stringify([
    brush.type,
    brush.size,
    brush.color.toUpperCase(),
    brush.opacity,
    brush.version,
    brush.angle ?? null,
    brush.seed ?? null,
  ]);
}

function chunkStroke(chunk: StrokePreview): CanvasStroke {
  return {
    clientStrokeId: chunk.clientStrokeId,
    brush: {
      brushType: chunk.brush.type,
      brushSize: chunk.brush.size,
      color: chunk.brush.color,
    },
    angle: chunk.brush.angle,
    seed: chunk.brush.seed,
    opacity: chunk.brush.opacity,
    points: chunk.points,
  };
}

function chunkBounds(stroke: CanvasStroke, previous: BrushStrokeState['lastPoint']): Bounds | null {
  if (!stroke.points.length) return null;
  const spread =
    stroke.brush.brushType === 'flat'
      ? Math.SQRT2
      : stroke.brush.brushType === 'airbrush'
        ? 1.15
        : 1;
  const padding = (stroke.brush.brushSize / 2) * spread + 2;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const point of previous ? [previous, ...stroke.points] : stroke.points) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }
  const x = Math.max(0, Math.floor(left - padding));
  const y = Math.max(0, Math.floor(top - padding));
  const edgeX = Math.min(width, Math.ceil(right + padding));
  const edgeY = Math.min(height, Math.ceil(bottom + padding));
  return edgeX > x && edgeY > y ? { x, y, width: edgeX - x, height: edgeY - y } : null;
}

function assertChunk(chunk: StrokePreview, active: ActiveStroke | undefined) {
  const sequence = BigInt(chunk.sequence);
  if (sequence !== lastSequence + 1n) throw new Error('Canvas capture sequence is not contiguous.');
  if (!chunk.userId || !chunk.clientStrokeId || !Number.isInteger(chunk.chunkIndex))
    throw new Error('Canvas capture stroke identity is invalid.');
  if (chunk.chunkIndex !== (active ? active.lastChunkIndex + 1 : 0))
    throw new Error('Canvas capture chunk index is not contiguous.');
  const currentBrushKey = brushKey(chunk.brush);
  if (active && active.brushKey !== currentBrushKey)
    throw new Error('Canvas capture brush changed within a stroke.');
  for (const point of chunk.points) {
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < 0 ||
      point.x >= width ||
      point.y < 0 ||
      point.y >= height
    )
      throw new Error('Canvas capture point is outside the canvas.');
  }
  return currentBrushKey;
}

function paintChunk(stroke: CanvasStroke, state: BrushStrokeState) {
  if (!context) throw new Error('Canvas capture is not initialized.');
  const bounds = chunkBounds(stroke, state.lastPoint);
  if (!bounds) {
    drawBrushStroke(context, stroke, 1, state, false);
    return;
  }
  chunkLayer ??= document.createElement('canvas');
  const initialState = cloneBrushStrokeState(state);
  let completedState: BrushStrokeState | undefined;
  for (let y = bounds.y; y < bounds.y + bounds.height; y += CHUNK_TILE_SIZE) {
    for (let x = bounds.x; x < bounds.x + bounds.width; x += CHUNK_TILE_SIZE) {
      const tileWidth = Math.min(CHUNK_TILE_SIZE, bounds.x + bounds.width - x);
      const tileHeight = Math.min(CHUNK_TILE_SIZE, bounds.y + bounds.height - y);
      if (chunkLayer.width < tileWidth) chunkLayer.width = tileWidth;
      if (chunkLayer.height < tileHeight) chunkLayer.height = tileHeight;
      const chunkContext = chunkLayer.getContext('2d');
      if (!chunkContext) throw new Error('Canvas capture chunk context is unavailable.');
      chunkContext.setTransform(1, 0, 0, 1, 0, 0);
      chunkContext.clearRect(0, 0, tileWidth, tileHeight);
      chunkContext.save();
      const tileState = cloneBrushStrokeState(initialState);
      try {
        chunkContext.beginPath();
        chunkContext.rect(0, 0, tileWidth, tileHeight);
        chunkContext.clip();
        chunkContext.translate(-x, -y);
        chunkContext.beginPath();
        chunkContext.rect(0, 0, width, height);
        chunkContext.clip();
        drawBrushStroke(chunkContext, stroke, 1, tileState);
      } finally {
        chunkContext.restore();
      }
      completedState ??= tileState;
      context.drawImage(chunkLayer, 0, 0, tileWidth, tileHeight, x, y, tileWidth, tileHeight);
    }
  }
  if (completedState) {
    state.lastPoint = completedState.lastPoint ? { ...completedState.lastPoint } : null;
    state.progress = completedState.progress;
    state.sampleIndex = completedState.sampleIndex;
  }
}

function initialize(nextWidth: number, nextHeight: number) {
  if (
    !Number.isSafeInteger(nextWidth) ||
    !Number.isSafeInteger(nextHeight) ||
    nextWidth < 1 ||
    nextHeight < 1 ||
    nextWidth > 10_000 ||
    nextHeight > 10_000
  )
    throw new Error('Canvas capture dimensions are invalid.');
  width = nextWidth;
  height = nextHeight;
  lastSequence = 0n;
  states.clear();
  canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas capture context is unavailable.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  chunkLayer = null;
}

function append(chunks: StrokePreview[]) {
  if (!canvas || !context) throw new Error('Canvas capture is not initialized.');
  for (const chunk of chunks) {
    const key = strokeKey(chunk.userId, chunk.clientStrokeId);
    const active = states.get(key);
    const brushKey = assertChunk(chunk, active);
    const state = active?.state ?? createBrushStrokeState();
    paintChunk(chunkStroke(chunk), state);
    lastSequence = BigInt(chunk.sequence);
    if (chunk.isFinal) states.delete(key);
    else {
      states.set(key, {
        userId: chunk.userId,
        clientStrokeId: chunk.clientStrokeId,
        lastChunkIndex: chunk.chunkIndex,
        brush: { ...chunk.brush },
        brushKey,
        state,
      });
    }
  }
}

async function finish(): Promise<{ imageBase64: string; strokes: CaptureStroke[] }> {
  if (!canvas || !context) throw new Error('Canvas capture is not initialized.');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas!.toBlob(
      value => (value ? resolve(value) : reject(new Error('PNG encoding failed.'))),
      'image/png'
    );
  });
  canvas.width = 0;
  canvas.height = 0;
  canvas = null;
  context = null;
  if (chunkLayer) {
    chunkLayer.width = 0;
    chunkLayer.height = 0;
    chunkLayer = null;
  }
  const decoded = await createImageBitmap(blob);
  try {
    if (decoded.width !== width || decoded.height !== height)
      throw new Error('Encoded PNG dimensions do not match the canvas.');
  } finally {
    decoded.close();
  }
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('PNG reading failed.'));
    reader.onload = () =>
      resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1));
    reader.readAsDataURL(blob);
  });
  const strokes = [...states.values()].map(({ brushKey: _brushKey, ...stroke }) => ({
    ...stroke,
    brush: { ...stroke.brush },
    state: cloneBrushStrokeState(stroke.state),
  }));
  return { imageBase64, strokes };
}

declare global {
  interface Window {
    cameoCapture: {
      initialize: typeof initialize;
      append: typeof append;
      finish: typeof finish;
    };
  }
}

window.cameoCapture = { initialize, append, finish };
