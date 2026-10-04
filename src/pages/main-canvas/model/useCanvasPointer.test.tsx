import { act, renderHook } from '@testing-library/react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useCanvasDrawing, type CanvasDrawingTransport } from './useCanvasDrawing';
import { useCanvasPointer } from './useCanvasPointer';
import type { CanvasMode } from './useCanvasMode';

function setup(brush = defaultBrushSettings, transport?: CanvasDrawingTransport) {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50 } as DOMRect);
  canvas.setPointerCapture = vi.fn();
  canvas.releasePointerCapture = vi.fn();
  canvas.hasPointerCapture = () => true;
  const canvasRef = { current: canvas };
  const initialView = { scale: 0.1, offsetX: 16, offsetY: 16 };
  const hook = renderHook(
    ({ mode, view }: { mode: CanvasMode; view: typeof initialView }) => {
      const model = useCanvasDrawing(brush, mode, 10_000, 10_000, transport);
      const pointer = useCanvasPointer(canvasRef, view, mode, model, 10_000, 10_000);
      return { model, ...pointer };
    },
    { initialProps: { mode: 'live', view: initialView } }
  );
  function event(patch: Partial<ReactPointerEvent<HTMLCanvasElement>> = {}) {
    return {
      currentTarget: canvas,
      clientX: 148,
      clientY: 78,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      preventDefault() {},
      nativeEvent: {},
      ...patch,
    } as ReactPointerEvent<HTMLCanvasElement>;
  }
  return { ...hook, canvas, event, initialView };
}

describe('canvas pointer input', () => {
  it('converts viewport CSS positions to world coordinates without multiplying DPR', () => {
    const { result, event, canvas } = setup();
    act(() => result.current.handlers.onPointerDown(event()));
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    expect(result.current.cursor).toEqual({ x: 320, y: 120 });
    act(() => result.current.handlers.onPointerUp(event({ clientX: 158, clientY: 88 })));
    expect(result.current.model.drawing.liveStrokes[0].points).toEqual([
      { x: 320, y: 120 },
      { x: 420, y: 220 },
    ]);
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('rejects right clicks and secondary touches without starting strokes', () => {
    const { result, event } = setup();
    act(() => result.current.handlers.onPointerDown(event({ button: 2 })));
    act(() =>
      result.current.handlers.onPointerDown(event({ pointerType: 'touch', isPrimary: false }))
    );
    expect(result.current.model.drawing.activeStroke).toBeNull();
    expect(result.current.model.drawing.liveStrokes).toHaveLength(0);
  });

  it('does not let another pointer move or end a captured stroke', () => {
    const { result, event } = setup();
    act(() => result.current.handlers.onPointerDown(event()));
    act(() => result.current.handlers.onPointerMove(event({ pointerId: 2, clientX: 300 })));
    act(() => result.current.handlers.onPointerUp(event({ pointerId: 2 })));
    expect(result.current.model.drawing.activeStroke?.points).toEqual([{ x: 320, y: 120 }]);
    expect(result.current.cursor).toEqual({ x: 320, y: 120 });
  });

  it.each(['cancel', 'lost', 'blur'])('discards an interrupted stroke on %s', interruption => {
    const { result, event } = setup();
    act(() => result.current.handlers.onPointerDown(event()));
    act(() => {
      if (interruption === 'cancel') result.current.handlers.onPointerCancel(event());
      else if (interruption === 'lost') result.current.handlers.onLostPointerCapture(event());
      else window.dispatchEvent(new Event('blur'));
    });
    expect(result.current.model.drawing.activeStroke).toBeNull();
    expect(result.current.model.drawing.liveStrokes).toHaveLength(0);
    expect(result.current.cursor).toBeNull();
  });

  it.each(['cancel', 'blur'] as const)(
    'stops stationary Airbrush sampling when pointer input ends by %s',
    interruption => {
      vi.useFakeTimers();
      const transport = {
        start: vi.fn(() => true),
        move: vi.fn(),
        finish: vi.fn(),
        cancel: vi.fn(),
      };
      const { result, event, unmount } = setup(
        { ...defaultBrushSettings, brushType: 'airbrush' },
        transport
      );
      act(() => result.current.handlers.onPointerDown(event({ timeStamp: 1000 })));
      act(() => vi.advanceTimersByTime(50));
      expect(transport.move).toHaveBeenCalledOnce();

      act(() => {
        if (interruption === 'cancel') result.current.handlers.onPointerCancel(event());
        else window.dispatchEvent(new Event('blur'));
      });
      act(() => vi.advanceTimersByTime(500));

      expect(transport.move).toHaveBeenCalledOnce();
      expect(result.current.model.drawing.activeStroke).toBeNull();
      unmount();
      vi.useRealTimers();
    }
  );

  it('releases capture on mode change without completing the interrupted stroke', () => {
    const { result, event, canvas, rerender, initialView } = setup();
    act(() => result.current.handlers.onPointerDown(event()));
    rerender({ mode: 'practice', view: initialView });
    expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1);
    act(() => result.current.handlers.onPointerUp(event()));
    expect(result.current.model.drawing.liveStrokes).toHaveLength(0);
    expect(result.current.model.drawing.practiceStroke).toBeNull();
  });

  it('hides a stale cursor when resize changes the view transform', () => {
    const { result, event, rerender } = setup();
    act(() => result.current.handlers.onPointerMove(event()));
    expect(result.current.cursor).toEqual({ x: 320, y: 120 });
    rerender({ mode: 'live', view: { scale: 0.05, offsetX: 40, offsetY: 20 } });
    expect(result.current.cursor).toBeNull();
  });

  it('keeps outside drag coordinates for clipping and hides the cursor outside the paper', () => {
    const { result, event } = setup();
    act(() => result.current.handlers.onPointerDown(event()));
    act(() => result.current.handlers.onPointerMove(event({ clientX: 90, clientY: 78 })));
    expect(result.current.cursor).toBeNull();
    act(() => result.current.handlers.onPointerUp(event({ clientX: 90, clientY: 78 })));
    expect(result.current.model.drawing.liveStrokes[0].points[1].x).toBe(-260);
  });
});
