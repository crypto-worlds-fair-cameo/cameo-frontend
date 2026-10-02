import { HALF, project, type CameraPose, type ScreenPoint } from '../model/camera';
import { strokeCap, strokeWidth, type Stroke } from '../model/useCanvasStudio';

type Scene = {
  camera: CameraPose;
  stroke: Stroke | null;
  draft: Stroke | null;
  practice?: boolean;
  practiceStrokes?: Stroke[];
};

const groundPoint = (pose: CameraPose, viewW: number, viewH: number, x: number, z: number) =>
  project(x, 0, z, pose, viewW, viewH);

const trace = (ctx: CanvasRenderingContext2D, points: Array<ScreenPoint | null>, close = false) => {
  const visible = points.filter((point): point is ScreenPoint => point != null);
  if (visible.length < 2) return false;
  ctx.beginPath();
  ctx.moveTo(visible[0].x, visible[0].y);
  for (const point of visible.slice(1)) ctx.lineTo(point.x, point.y);
  if (close) ctx.closePath();
  return true;
};

const drawStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  pose: CameraPose,
  viewW: number,
  viewH: number
) => {
  const width = strokeWidth(stroke.brush, stroke.width);
  const points = stroke.points
    .map(point => groundPoint(pose, viewW, viewH, point.x, point.y))
    .filter((point): point is ScreenPoint => point != null);
  if (points.length < 2) return;
  const scale = points.reduce((sum, point) => sum + point.scale, 0) / points.length;
  ctx.strokeStyle = stroke.color;
  ctx.globalAlpha = stroke.opacity;
  ctx.lineCap = strokeCap(stroke.brush);
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1.2, width * scale);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

export const paintSpace = (canvas: HTMLCanvasElement, scene: Scene) => {
  const viewW = canvas.clientWidth;
  const viewH = canvas.clientHeight;
  if (viewW < 2 || viewH < 2) return;
  const ratio = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width !== Math.floor(viewW * ratio) || canvas.height !== Math.floor(viewH * ratio)) {
    canvas.width = Math.floor(viewW * ratio);
    canvas.height = Math.floor(viewH * ratio);
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const sky = ctx.createRadialGradient(
    viewW / 2,
    viewH * 0.42,
    40,
    viewW / 2,
    viewH / 2,
    Math.max(viewW, viewH) * 0.72
  );
  sky.addColorStop(0, '#ffffff');
  sky.addColorStop(0.55, '#f4f7f9');
  sky.addColorStop(1, '#dfe7ec');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, viewH);

  const { camera } = scene;
  const corners = [
    groundPoint(camera, viewW, viewH, -HALF, -HALF),
    groundPoint(camera, viewW, viewH, HALF, -HALF),
    groundPoint(camera, viewW, viewH, HALF, HALF),
    groundPoint(camera, viewW, viewH, -HALF, HALF),
  ];
  if (trace(ctx, corners, true)) {
    ctx.fillStyle = scene.practice ? '#f7f7f7' : '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#8e8e8e';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (scene.practice) {
    for (const stroke of scene.practiceStrokes ?? []) {
      drawStroke(ctx, stroke, camera, viewW, viewH);
    }
  } else if (scene.stroke) {
    drawStroke(ctx, scene.stroke, camera, viewW, viewH);
  }
  if (scene.draft) drawStroke(ctx, scene.draft, camera, viewW, viewH);
};
