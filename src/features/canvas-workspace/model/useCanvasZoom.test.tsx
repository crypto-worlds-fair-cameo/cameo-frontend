import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getCameraView, screenToWorld } from '../lib/canvasTransform';
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  CANVAS_NAVIGATION_IDLE_MS,
  CANVAS_VIEW_PADDING,
  useCanvasZoom,
} from './useCanvasZoom';

const SIZE = 10_000;

function setup() {
  const hook = renderHook(() => useCanvasZoom(SIZE, SIZE));
  act(() => hook.result.current.setFrame(800, 600));
  return hook;
}

function viewOf(camera: ReturnType<typeof useCanvasZoom>['camera']) {
  return getCameraView(800, 600, SIZE, SIZE, CANVAS_VIEW_PADDING, camera)!.view;
}

describe('canvas zoom', () => {
  it('reports navigation while the wheel, drag or map moves the view, but not for the buttons', () => {
    vi.useFakeTimers();
    try {
      const { result } = setup();
      act(() => result.current.zoomIn());
      expect(result.current.navigating).toBe(false);

      act(() => result.current.zoomAt(1.2, { x: 300, y: 200 }));
      expect(result.current.navigating).toBe(true);
      // 이동이 이어지면 끝나는 시점도 미뤄진다.
      act(() => vi.advanceTimersByTime(CANVAS_NAVIGATION_IDLE_MS - 100));
      act(() => result.current.panBy(10, 0));
      act(() => vi.advanceTimersByTime(CANVAS_NAVIGATION_IDLE_MS - 100));
      expect(result.current.navigating).toBe(true);
      act(() => vi.advanceTimersByTime(100));
      expect(result.current.navigating).toBe(false);

      act(() => result.current.centerOn({ x: 1_000, y: 1_000 }));
      expect(result.current.navigating).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('starts with the whole paper and stays between the minimum and the maximum', () => {
    const { result } = setup();
    expect(result.current.zoom).toBe(1);
    expect(result.current.visibleRect).toEqual({ x: 0, y: 0, width: SIZE, height: SIZE });

    // 1배보다 더 줄여 도화지를 멀리 볼 수 있다.
    for (let i = 0; i < 20; i++) act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(CANVAS_MIN_ZOOM);
    expect(result.current.visibleRect).toEqual({ x: 0, y: 0, width: SIZE, height: SIZE });

    for (let i = 0; i < 20; i++) act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(CANVAS_MAX_ZOOM);
  });

  it('stops at the whole-paper view when the buttons cross 1x', () => {
    const { result } = setup();
    for (let i = 0; i < 20; i++) act(() => result.current.zoomOut());

    const seen: number[] = [];
    while (result.current.zoom < 1) {
      act(() => result.current.zoomIn());
      seen.push(result.current.zoom);
    }
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('keeps the paper point under the cursor in place while zooming with the wheel', () => {
    const { result } = setup();
    const cursor = { x: 300, y: 200 };
    const before = screenToWorld(cursor, viewOf(result.current.camera));

    act(() => result.current.zoomAt(3, cursor));

    expect(result.current.zoom).toBe(3);
    const after = screenToWorld(cursor, viewOf(result.current.camera));
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('pans with the drag and stops at the paper edge', () => {
    const { result } = setup();
    act(() => result.current.zoomAt(4, { x: 400, y: 300 }));
    const start = result.current.camera.center!;

    // 오른쪽으로 끌면 도화지가 따라 오른쪽으로 움직여 왼쪽 부분이 보인다.
    act(() => result.current.panBy(100, 0));
    expect(result.current.camera.center!.x).toBeLessThan(start.x);

    // 아무리 끌어도 도화지 왼쪽 끝이 여백보다 안쪽으로 들어오지 않고, 되돌릴 때 바로 움직인다.
    act(() => result.current.panBy(100_000, 0));
    expect(result.current.visibleRect!.x).toBe(0);
    const edge = result.current.camera.center!.x;
    act(() => result.current.panBy(-50, 0));
    expect(result.current.camera.center!.x).toBeGreaterThan(edge);
  });

  it('moves the view to a point picked on the map', () => {
    const { result } = setup();
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    act(() => result.current.centerOn({ x: 6_000, y: 3_000 }));
    expect(result.current.camera.center).toEqual({ x: 6_000, y: 3_000 });

    // 끝 쪽을 고르면 도화지 가장자리가 화면 안쪽으로 들어오지 않는 데까지만 옮긴다.
    act(() => result.current.centerOn({ x: 9_900, y: 3_000 }));
    expect(result.current.camera.center!.x).toBeLessThan(9_900);
    expect(result.current.visibleRect!.x + result.current.visibleRect!.width).toBe(SIZE);
  });
});
