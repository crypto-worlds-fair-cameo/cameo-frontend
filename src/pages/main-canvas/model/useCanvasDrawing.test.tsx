import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useCanvasDrawing, type CanvasStroke } from './useCanvasDrawing';
import type { CanvasMode } from './useCanvasMode';

function setup(mode: CanvasMode = 'live') {
  return renderHook(({ brush, mode }) => useCanvasDrawing(brush, mode, 10_000, 10_000), {
    initialProps: { brush: { ...defaultBrushSettings }, mode },
  });
}

describe('local canvas strokes', () => {
  it('keeps practice private and fixes live ID, brush, seed and relative times at pointer down', () => {
    const transport = {
      start: vi.fn((_stroke: CanvasStroke) => true),
      move: vi.fn(),
      finish: vi.fn(),
      cancel: vi.fn(),
    };
    const { result, rerender } = renderHook(
      ({ mode, color }) =>
        useCanvasDrawing(
          { ...defaultBrushSettings, brushType: 'airbrush', color },
          mode,
          10_000,
          10_000,
          transport
        ),
      { initialProps: { mode: 'practice' as CanvasMode, color: '#ED4242' } }
    );
    act(() => result.current.startStroke(1, { x: 100, y: 200, t: 500 }));
    act(() => result.current.finishStroke(1, { x: 110, y: 200, t: 550 }));
    expect(transport.start).not.toHaveBeenCalled();
    expect(transport.finish).not.toHaveBeenCalled();
    rerender({ mode: 'live', color: '#ED4242' });
    act(() => result.current.startStroke(1, { x: 100, y: 200, t: 1000 }));
    const started = transport.start.mock.calls[0][0];
    expect(started.clientStrokeId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isInteger(started.seed)).toBe(true);
    rerender({ mode: 'live', color: '#000000' });
    act(() =>
      result.current.moveStroke(1, [
        { x: -1, y: 10001, t: 1020 },
        { x: 20, y: 30, t: 1010 },
      ])
    );
    expect(result.current.drawing.activeStroke?.brush.color).toBe('#ED4242');
    expect(result.current.drawing.activeStroke?.points).toEqual([
      { x: 100, y: 200, t: 0 },
      { x: 0, y: 9999.999999, t: 20 },
      { x: 20, y: 30, t: 20 },
    ]);
    act(() => result.current.finishStroke(1, { x: 30, y: 40, t: 1030 }));
    expect(transport.finish).toHaveBeenCalledWith(started.clientStrokeId);
    expect(result.current.drawing.liveStrokes).toHaveLength(0);
  });

  it.each(['live', 'practice'] as const)(
    'adds deterministic Airbrush time samples while a stationary %s stroke is held',
    mode => {
      vi.useFakeTimers();
      const transport = {
        start: vi.fn((_stroke: CanvasStroke) => true),
        move: vi.fn(),
        finish: vi.fn(),
        cancel: vi.fn(),
      };
      const { result, unmount } = renderHook(() =>
        useCanvasDrawing(
          { ...defaultBrushSettings, brushType: 'airbrush' },
          mode,
          10_000,
          10_000,
          transport
        )
      );

      act(() => result.current.startStroke(1, { x: 100, y: 200, t: 1000 }));
      act(() => vi.advanceTimersByTime(150));

      expect(result.current.drawing.activeStroke?.points).toEqual([
        { x: 100, y: 200, t: 0 },
        { x: 100, y: 200, t: 50 },
        { x: 100, y: 200, t: 100 },
        { x: 100, y: 200, t: 150 },
      ]);
      expect(transport.move).toHaveBeenCalledTimes(mode === 'live' ? 3 : 0);
      act(() => result.current.finishStroke(1, { x: 100, y: 200, t: 1150 }));
      const finishedPoints =
        mode === 'live'
          ? transport.start.mock.calls[0][0].points.length
          : result.current.drawing.practiceStroke!.points.length;
      act(() => vi.advanceTimersByTime(500));
      expect(
        mode === 'live'
          ? transport.start.mock.calls[0][0].points.length
          : result.current.drawing.practiceStroke!.points.length
      ).toBe(finishedPoints);
      expect(transport.finish).toHaveBeenCalledTimes(mode === 'live' ? 1 : 0);
      unmount();
      vi.useRealTimers();
    }
  );

  it('stops stationary Airbrush samples when the live input is interrupted', () => {
    vi.useFakeTimers();
    const transport = {
      start: vi.fn((_stroke: CanvasStroke) => true),
      move: vi.fn(),
      finish: vi.fn(),
      cancel: vi.fn(),
    };
    const { result, unmount } = renderHook(() =>
      useCanvasDrawing(
        { ...defaultBrushSettings, brushType: 'airbrush' },
        'live',
        10_000,
        10_000,
        transport
      )
    );
    act(() => result.current.startStroke(1, { x: 100, y: 200, t: 1000 }));
    act(() => vi.advanceTimersByTime(50));
    expect(transport.move).toHaveBeenCalledOnce();

    act(() => result.current.interruptLiveStroke());
    act(() => vi.advanceTimersByTime(500));

    expect(transport.move).toHaveBeenCalledOnce();
    expect(result.current.drawing.activeStroke).toBeNull();
    unmount();
    vi.useRealTimers();
  });

  it('stops stationary Airbrush samples on mode changes, resets and unmount', () => {
    vi.useFakeTimers();
    const transport = {
      start: vi.fn((_stroke: CanvasStroke) => true),
      move: vi.fn(),
      finish: vi.fn(),
      cancel: vi.fn(),
    };
    const brush = { ...defaultBrushSettings, brushType: 'airbrush' as const };
    const { result, rerender, unmount } = renderHook(
      ({ mode }: { mode: CanvasMode }) => useCanvasDrawing(brush, mode, 10_000, 10_000, transport),
      { initialProps: { mode: 'live' as CanvasMode } }
    );
    act(() => result.current.startStroke(1, { x: 100, y: 200, t: 1000 }));
    act(() => vi.advanceTimersByTime(50));
    expect(transport.move).toHaveBeenCalledOnce();

    rerender({ mode: 'practice' });
    act(() => vi.advanceTimersByTime(500));
    expect(transport.move).toHaveBeenCalledOnce();

    rerender({ mode: 'live' });
    act(() => result.current.startStroke(2, { x: 200, y: 300, t: 2000 }));
    act(() => vi.advanceTimersByTime(50));
    expect(transport.move).toHaveBeenCalledTimes(2);
    act(() => result.current.resetDrawing());
    act(() => vi.advanceTimersByTime(500));
    expect(transport.move).toHaveBeenCalledTimes(2);

    act(() => result.current.startStroke(3, { x: 300, y: 400, t: 3000 }));
    act(() => vi.advanceTimersByTime(50));
    expect(transport.move).toHaveBeenCalledTimes(3);
    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(transport.move).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('does not start a live gesture when the transport rejects drawing', () => {
    const transport = {
      start: vi.fn(() => false),
      move: vi.fn(),
      finish: vi.fn(),
      cancel: vi.fn(),
    };
    const { result } = renderHook(() =>
      useCanvasDrawing(defaultBrushSettings, 'live', 10_000, 10_000, transport)
    );
    act(() => expect(result.current.startStroke(1, { x: 100, y: 200 })).toBe(false));
    expect(result.current.drawing.activeStroke).toBeNull();
  });

  it('publishes coalesced pointer points once without losing intermediate coordinates', () => {
    const { result } = setup();
    act(() => result.current.startStroke(1, { x: 100, y: 200 }));
    const revision = result.current.revision;
    act(() =>
      result.current.moveStroke(1, [
        { x: 110, y: 210 },
        { x: 120, y: 220 },
        { x: 120, y: 220 },
      ])
    );
    expect(result.current.drawing.activeStroke?.points).toEqual([
      { x: 100, y: 200 },
      { x: 110, y: 210 },
      { x: 120, y: 220 },
    ]);
    expect(result.current.revision).toBe(revision + 1);
  });

  it('keeps completed live strokes with the brush chosen at pointer down', () => {
    const { result, rerender } = setup();
    act(() => result.current.startStroke(1, { x: 100, y: 200 }));
    rerender({ brush: { ...defaultBrushSettings, color: '#000000' }, mode: 'live' });
    act(() => result.current.moveStroke(1, { x: 150, y: 250 }));
    act(() => result.current.finishStroke(1, { x: 200, y: 300 }));
    act(() => result.current.startStroke(1, { x: 400, y: 500 }));
    act(() => result.current.finishStroke(1, { x: 400, y: 500 }));

    expect(result.current.drawing.liveStrokes).toHaveLength(2);
    expect(result.current.drawing.liveStrokes[0]).toEqual({
      brush: defaultBrushSettings,
      points: [
        { x: 100, y: 200 },
        { x: 150, y: 250 },
        { x: 200, y: 300 },
      ],
    });
    expect(result.current.drawing.liveStrokes[1].brush.color).toBe('#000000');
    expect(result.current.drawing.liveStrokes[1].points).toHaveLength(1);
  });

  it('replaces the previous practice stroke when another valid stroke begins', () => {
    const { result } = setup('practice');
    act(() => result.current.startStroke(1, { x: 100, y: 200 }));
    act(() => result.current.finishStroke(1, { x: 150, y: 250 }));
    expect(result.current.drawing.practiceStroke?.points).toHaveLength(2);

    act(() => result.current.startStroke(2, { x: 400, y: 500 }));
    expect(result.current.drawing.practiceStroke).toBeNull();
    expect(result.current.drawing.activeStroke?.points).toEqual([{ x: 400, y: 500 }]);
    act(() => result.current.finishStroke(2, { x: 450, y: 550 }));

    expect(result.current.drawing.practiceStroke?.points).toEqual([
      { x: 400, y: 500 },
      { x: 450, y: 550 },
    ]);
    expect(result.current.drawing.liveStrokes).toHaveLength(0);
  });

  it('preserves live strokes across mode switches without promoting practice strokes', () => {
    const { result, rerender } = setup();
    act(() => result.current.startStroke(1, { x: 100, y: 200 }));
    act(() => result.current.finishStroke(1, { x: 150, y: 250 }));
    rerender({ brush: { ...defaultBrushSettings }, mode: 'practice' });
    act(() => result.current.startStroke(1, { x: 300, y: 400 }));
    act(() => result.current.finishStroke(1, { x: 350, y: 450 }));
    act(() => result.current.startStroke(1, { x: 600, y: 700 }));
    rerender({ brush: { ...defaultBrushSettings }, mode: 'live' });
    act(() => result.current.finishStroke(1, { x: 650, y: 750 }));

    expect(result.current.drawing.liveStrokes).toHaveLength(1);
    expect(result.current.drawing.practiceStroke).toBeNull();
    expect(result.current.drawing.activeStroke).toBeNull();
  });

  it('ignores other pointers and discards a cancelled stroke', () => {
    const { result } = setup();
    act(() => result.current.startStroke(1, { x: 100, y: 200 }));
    act(() => result.current.startStroke(2, { x: 300, y: 400 }));
    act(() => result.current.moveStroke(2, { x: 500, y: 600 }));
    act(() => result.current.finishStroke(2, { x: 700, y: 800 }));
    expect(result.current.drawing.activeStroke?.points).toEqual([{ x: 100, y: 200 }]);
    act(() => result.current.cancelStroke(2));
    expect(result.current.drawing.activeStroke).not.toBeNull();
    act(() => result.current.cancelStroke(1));
    expect(result.current.drawing.activeStroke).toBeNull();
    expect(result.current.drawing.liveStrokes).toHaveLength(0);
  });

  it('does not clear practice for starts outside the paper or invalid coordinates', () => {
    const { result } = setup('practice');
    act(() => result.current.startStroke(1, { x: 100, y: 200 }));
    act(() => result.current.finishStroke(1, { x: 100, y: 200 }));
    for (const point of [
      { x: -1, y: 1 },
      { x: 10_001, y: 1 },
      { x: NaN, y: 1 },
    ]) {
      act(() => expect(result.current.startStroke(2, point)).toBe(false));
    }
    expect(result.current.drawing.practiceStroke?.points).toEqual([{ x: 100, y: 200 }]);
    expect(result.current.drawing.activeStroke).toBeNull();
  });
});
