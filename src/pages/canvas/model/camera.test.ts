import { expect, it } from 'vitest';
import { CAMERA_HOME, clampSpan, hitGround, project, STAGE_TOP, VIEW_FRAME } from './camera';

it('puts a ground point back where the camera projected it', () => {
  const projected = project(1200, 0, -640, CAMERA_HOME, 1400, 900);
  const hit = hitGround(projected!.x, projected!.y, CAMERA_HOME, 1400, 900);
  expect(hit?.x).toBeCloseTo(1200, 0);
  expect(hit?.z).toBeCloseTo(-640, 0);
});

it('fits the whole canvas into a 1000px frame when zoomed out', () => {
  const pose = { yaw: 0, pitch: 89, span: 10000 };
  const corners = [
    project(-5000, 0, -5000, pose, 1600, 1200),
    project(5000, 0, -5000, pose, 1600, 1200),
    project(5000, 0, 5000, pose, 1600, 1200),
    project(-5000, 0, 5000, pose, 1600, 1200),
  ];
  const xs = corners.map(point => point!.x);
  const ys = corners.map(point => point!.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  expect(width).toBeGreaterThan(600);
  expect(width).toBeLessThanOrEqual(VIEW_FRAME);
  expect(height).toBeLessThanOrEqual(VIEW_FRAME);
  expect(Math.min(...ys)).toBeGreaterThan(STAGE_TOP);
});

it('keeps the visible range between 1000px and 10000px', () => {
  expect(clampSpan(200)).toBe(1000);
  expect(clampSpan(24000)).toBe(10000);
  expect(clampSpan(4500)).toBe(4500);
});
