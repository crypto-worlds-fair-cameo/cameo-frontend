import { describe, expect, it } from 'vitest';
import { getCameraView, getFittedView, screenToWorld, worldToScreen } from './canvasTransform';

describe('canvas coordinates', () => {
  it('fits the entire square in landscape and portrait viewports', () => {
    for (const [width, height] of [
      [1440, 800],
      [320, 640],
    ]) {
      const view = getFittedView(width, height, 10_000, 10_000, 16)!;
      const topLeft = worldToScreen({ x: 0, y: 0 }, view);
      const bottomRight = worldToScreen({ x: 10_000, y: 10_000 }, view);

      expect(topLeft.x).toBeGreaterThanOrEqual(16);
      expect(topLeft.y).toBeGreaterThanOrEqual(16);
      expect(bottomRight.x).toBeLessThanOrEqual(width - 16);
      expect(bottomRight.y).toBeLessThanOrEqual(height - 16);
      expect((topLeft.x + bottomRight.x) / 2).toBeCloseTo(width / 2);
      expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo(height / 2);
    }
  });

  it('maps a screen position back to the same world coordinate after zoom and pan', () => {
    const view = { scale: 0.125, offsetX: -220, offsetY: 36 };
    const point = { x: 8123.5, y: 4567.25 };

    expect(screenToWorld(worldToScreen(point, view), view)).toEqual(point);
  });

  it('matches the fitted view at zoom 1 and keeps the paper centered', () => {
    const fitted = getFittedView(1440, 800, 10_000, 10_000, 16)!;
    const camera = getCameraView(1440, 800, 10_000, 10_000, 16, {
      zoom: 1,
      center: { x: 100, y: 9_000 },
    })!;

    expect(camera.view.scale).toBeCloseTo(fitted.scale);
    expect(camera.view.offsetX).toBeCloseTo(fitted.offsetX);
    expect(camera.view.offsetY).toBeCloseTo(fitted.offsetY);
    expect(camera.center).toEqual({ x: 5_000, y: 5_000 });
  });

  it('grows the paper when zoomed until it fills the whole workspace edge to edge', () => {
    const fitted = getFittedView(1440, 800, 10_000, 10_000, 16)!;
    const at = (zoom: number) =>
      getCameraView(1440, 800, 10_000, 10_000, 16, { zoom, center: null })!.frame;

    // 1배는 전체 보기의 도화지 자리와 같다.
    expect(at(1).x).toBeCloseTo(fitted.offsetX);
    expect(at(1).width).toBeCloseTo(10_000 * fitted.scale);
    // 1.5배면 도화지가 커진 만큼 틀도 넓어지고, 높이는 작업 공간을 넘어 끝까지 찬다.
    expect(at(1.5).width).toBeCloseTo(10_000 * fitted.scale * 1.5);
    expect(at(1.5).height).toBe(800);
    // 더 키우면 작업 공간 전체를 여백 없이 채우고 넘는 부분만 잘린다.
    expect(at(4)).toEqual({ x: 0, y: 0, width: 1440, height: 800 });
  });

  it('fits 1x into the given area and grows past it over the whole workspace', () => {
    // 양옆 282px 칸과 위·아래 여백을 뺀 자리에 1배 도화지를 둔다.
    const fitArea = { x: 282, y: 100, width: 876, height: 600 };
    const at = (zoom: number) =>
      getCameraView(1440, 800, 10_000, 10_000, 16, { zoom, center: null }, fitArea)!;

    const fit = at(1);
    expect(fit.view.scale).toBeCloseTo((600 - 32) / 10_000);
    expect(fit.frame.x + fit.frame.width / 2).toBeCloseTo(720);
    expect(fit.frame.y).toBeCloseTo(116);
    expect(fit.frame.height).toBeCloseTo(568);
    expect(fit.pivot).toEqual({ x: 720, y: 400 });
    // 확대하면 1배 자리를 벗어나 작업 공간 전체(양옆 칸 아래 포함)를 채운다.
    expect(at(3).frame).toEqual({ x: 0, y: 0, width: 1440, height: 800 });
  });

  it('shrinks the whole paper below the fitted size and keeps it centered when zoomed out', () => {
    const fitted = getFittedView(1440, 800, 10_000, 10_000, 16)!;
    const { view, center, frame, visible } = getCameraView(1440, 800, 10_000, 10_000, 16, {
      zoom: 0.5,
      center: { x: 100, y: 9_000 },
    })!;

    expect(view.scale).toBeCloseTo(fitted.scale / 2);
    expect(frame.width).toBeCloseTo(10_000 * fitted.scale * 0.5);
    expect(frame.x + frame.width / 2).toBeCloseTo(720);
    expect(frame.y + frame.height / 2).toBeCloseTo(400);
    // 도화지 전체가 보이므로 가운데를 옮길 수 없다.
    expect(center).toEqual({ x: 5_000, y: 5_000 });
    expect(visible).toEqual({ x: 0, y: 0, width: 10_000, height: 10_000 });
  });

  it('stops panning at the paper edge', () => {
    const { view, center, frame } = getCameraView(800, 800, 10_000, 10_000, 16, {
      zoom: 4,
      center: { x: -50_000, y: 50_000 },
    })!;

    // 왼쪽·아래 끝까지 밀어도 도화지 가장자리는 틀 가장자리에서 멈춘다.
    expect(worldToScreen({ x: 0, y: 0 }, view).x).toBeCloseTo(frame.x);
    expect(worldToScreen({ x: 10_000, y: 10_000 }, view).y).toBeCloseTo(frame.y + frame.height);
    expect(center.x).toBeGreaterThan(0);
    expect(center.y).toBeLessThan(10_000);
  });

  it('reports the part of the paper shown in the frame for the map', () => {
    const { view, visible } = getCameraView(800, 800, 10_000, 10_000, 16, {
      zoom: 2,
      center: { x: 2_500, y: 2_500 },
    })!;

    // 2배 확대면 작업 공간 800px만큼의 도화지가 왼쪽 위 모서리부터 보인다.
    expect(visible.x).toBeCloseTo(0);
    expect(visible.y).toBeCloseTo(0);
    expect(visible.width).toBeCloseTo(800 / view.scale);
    expect(visible.height).toBeCloseTo(800 / view.scale);
  });

  it('waits for measurable space rather than producing an invalid transform', () => {
    expect(getFittedView(0, 800, 10_000, 10_000, 16)).toBeNull();
    expect(getFittedView(320, 0, 10_000, 10_000, 16)).toBeNull();
    expect(getFittedView(20, 20, 10_000, 10_000, 16)).toBeNull();
  });
});
