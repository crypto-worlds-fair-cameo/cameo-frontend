import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { strokeAlpha, strokeWidth, useCanvasStudio, viewSpan } from './useCanvasStudio';

it('uses the same stroke look for preview and drawing', () => {
  expect(strokeWidth('round', 78)).toBe(78);
  expect(strokeWidth('flat', 78)).toBeCloseTo(35.1);
  expect(strokeAlpha('round', 80)).toBeCloseTo(0.8);
  expect(strokeAlpha('airbrush', 80)).toBeCloseTo(0.44);
});

it('keeps only the first finished stroke', () => {
  const { result } = renderHook(() => useCanvasStudio());

  expect(result.current.color).toBe('#ED4242');
  expect(result.current.canDraw).toBe(true);

  act(() => {
    result.current.beginStroke({ x: 0, y: 0 });
    result.current.extendStroke({ x: 12, y: 8 });
    result.current.endStroke();
  });

  expect(result.current.stroke?.points).toHaveLength(2);
  expect(result.current.canDraw).toBe(false);

  act(() => result.current.beginStroke({ x: 4, y: 4 }));
  expect(result.current.draft).toBeNull();
});

it('pans along each axis and stays inside the 10000 canvas', () => {
  const { result } = renderHook(() => useCanvasStudio());
  const start = result.current.pan.y;

  act(() => result.current.panBy(120, 0));
  expect(result.current.pan.x).toBe(start + 120);
  expect(result.current.pan.y).toBe(start);

  act(() => result.current.panBy(0, -40));
  expect(result.current.pan.y).toBe(start - 40);

  act(() => result.current.panBy(-100000, 100000));
  expect(result.current.pan.x).toBe(0);
  expect(result.current.pan.y).toBe(10000 - viewSpan(100));
});

it('orbits the camera and snaps back to an axis', () => {
  const { result } = renderHook(() => useCanvasStudio());

  act(() => result.current.lookFrom('z'));
  act(() => result.current.orbitBy(15, 90));
  expect(result.current.camera.yaw).toBe(15);
  expect(result.current.camera.pitch).toBe(89);

  act(() => result.current.lookFrom('z'));
  expect(result.current.camera.yaw).toBe(0);
  expect(result.current.camera.pitch).toBe(28);

  act(() => result.current.zoomBy(20));
  expect(result.current.camera.span).toBe(1000);
  act(() => result.current.zoomBy(0.01));
  expect(result.current.camera.span).toBe(10000);
});

it('keeps the view center when zoom changes', () => {
  const { result } = renderHook(() => useCanvasStudio());

  act(() => result.current.panBy(200, -80));
  const centerX = result.current.pan.x + viewSpan(result.current.zoom) / 2;

  act(() => result.current.setZoom(200));
  expect(result.current.pan.x + viewSpan(200) / 2).toBeCloseTo(centerX);
  expect(result.current.zoom).toBe(200);
});
