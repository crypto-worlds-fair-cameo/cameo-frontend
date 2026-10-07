import { describe, expect, it } from 'vitest';
import { getFittedView, screenToWorld, worldToScreen } from './canvasTransform';

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

  it('waits for measurable space rather than producing an invalid transform', () => {
    expect(getFittedView(0, 800, 10_000, 10_000, 16)).toBeNull();
    expect(getFittedView(320, 0, 10_000, 10_000, 16)).toBeNull();
    expect(getFittedView(20, 20, 10_000, 10_000, 16)).toBeNull();
  });
});
