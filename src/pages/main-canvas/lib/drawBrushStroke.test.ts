import { describe, expect, it, vi } from 'vitest';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { createBrushStrokeState, drawBrushStroke } from './drawBrushStroke';

function context() {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    closePath: vi.fn(),
    globalAlpha: 1,
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  };
}

describe('brush stroke rendering', () => {
  it('limits airbrush stamps to device pixel density when the brush is near one pixel wide', () => {
    const paint = context();
    drawBrushStroke(
      paint as unknown as CanvasRenderingContext2D,
      {
        brush: { ...defaultBrushSettings, brushType: 'airbrush', brushSize: 20 },
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
      },
      0.05
    );
    expect(paint.createRadialGradient).toHaveBeenCalledTimes(21);
  });

  it('renders subpixel airbrush strokes as continuous antialiased paths', () => {
    const paint = context();
    drawBrushStroke(
      paint as unknown as CanvasRenderingContext2D,
      {
        brush: { ...defaultBrushSettings, brushType: 'airbrush', brushSize: 1 },
        points: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
      },
      0.05
    );
    expect(paint.createRadialGradient).not.toHaveBeenCalled();
    expect(paint.moveTo).toHaveBeenCalledWith(0, 0);
    expect(paint.lineTo).toHaveBeenCalledWith(200, 0);
    expect(paint.stroke).toHaveBeenCalledOnce();
  });

  it('renders a tap as a round or flat mark at the original brush size', () => {
    const round = context();
    const flat = context();
    drawBrushStroke(round as unknown as CanvasRenderingContext2D, {
      brush: defaultBrushSettings,
      points: [{ x: 100, y: 200 }],
    });
    drawBrushStroke(flat as unknown as CanvasRenderingContext2D, {
      brush: { ...defaultBrushSettings, brushType: 'flat' },
      points: [{ x: 100, y: 200 }],
    });
    expect(round.arc).toHaveBeenCalledWith(100, 200, 6, 0, Math.PI * 2);
    expect(flat.fillRect).toHaveBeenCalledWith(94, 194, 12, 12);
  });

  it('joins all points in a single continuous path', () => {
    const paint = context();
    drawBrushStroke(paint as unknown as CanvasRenderingContext2D, {
      brush: defaultBrushSettings,
      points: [
        { x: 100, y: 200 },
        { x: 150, y: 250 },
        { x: 200, y: 300 },
      ],
    });
    expect(paint.moveTo).toHaveBeenCalledWith(100, 200);
    expect(paint.lineTo.mock.calls).toEqual([
      [150, 250],
      [200, 300],
    ]);
    expect(paint.stroke).toHaveBeenCalledOnce();
  });

  it('spaces airbrush marks by distance rather than pointer event frequency', () => {
    const sparse = context();
    const dense = context();
    const brush = { ...defaultBrushSettings, brushType: 'airbrush' as const, brushSize: 100 };
    drawBrushStroke(sparse as unknown as CanvasRenderingContext2D, {
      brush,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    drawBrushStroke(dense as unknown as CanvasRenderingContext2D, {
      brush,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 40, y: 0 },
        { x: 100, y: 0 },
      ],
    });
    expect(sparse.createRadialGradient.mock.calls).toEqual([
      [0, 0, 0, 0, 0, 50],
      [25, 0, 0, 25, 0, 50],
      [50, 0, 0, 50, 0, 50],
      [75, 0, 0, 75, 0, 50],
      [100, 0, 0, 100, 0, 50],
    ]);
    expect(dense.createRadialGradient.mock.calls).toEqual(sparse.createRadialGradient.mock.calls);
  });
});

describe('deterministic shared brush rendering', () => {
  const brush = { ...defaultBrushSettings, brushType: 'airbrush' as const, brushSize: 20 };
  const points = [
    { x: 10, y: 20, t: 0 },
    { x: 40, y: 30, t: 32 },
    { x: 40, y: 30, t: 96 },
    { x: 100, y: 60, t: 128 },
  ];

  it('reproduces seeded time-based spray across overlapping chunks and empty final chunks', () => {
    const whole = context();
    const split = context();
    drawBrushStroke(
      whole as unknown as CanvasRenderingContext2D,
      { brush, seed: 93, points },
      1,
      createBrushStrokeState()
    );
    const state = createBrushStrokeState();
    for (const chunk of [points.slice(0, 2), points.slice(1, 3), points.slice(2), []]) {
      drawBrushStroke(
        split as unknown as CanvasRenderingContext2D,
        { brush, seed: 93, points: chunk },
        1,
        state
      );
    }
    expect(split.createRadialGradient.mock.calls).toEqual(whole.createRadialGradient.mock.calls);
    expect(split.fillRect.mock.calls).toEqual(whole.fillRect.mock.calls);
    expect(state.lastPoint).toEqual(points[3]);
  });

  it('advances acknowledged spray without painting and reproduces only the remaining suffix', () => {
    const acknowledged = context();
    const tail = context();
    const state = createBrushStrokeState();
    drawBrushStroke(
      acknowledged as unknown as CanvasRenderingContext2D,
      { brush, seed: 93, points: points.slice(0, 2) },
      1,
      state
    );
    drawBrushStroke(
      tail as unknown as CanvasRenderingContext2D,
      { brush, seed: 93, points: points.slice(2) },
      1,
      state
    );
    const replay = context();
    const replayState = createBrushStrokeState();
    drawBrushStroke(
      replay as unknown as CanvasRenderingContext2D,
      { brush, seed: 93, points: points.slice(0, 2) },
      1,
      replayState,
      false
    );
    expect(replay.fillRect).not.toHaveBeenCalled();
    drawBrushStroke(
      replay as unknown as CanvasRenderingContext2D,
      { brush, seed: 93, points: points.slice(2) },
      1,
      replayState
    );
    expect(replay.createRadialGradient.mock.calls).toEqual(tail.createRadialGradient.mock.calls);
  });

  it('keeps the canonical sample ordinal at small scale without drawing every spray tick', () => {
    const paint = context();
    const state = createBrushStrokeState();
    drawBrushStroke(
      paint as unknown as CanvasRenderingContext2D,
      {
        brush: { ...brush, brushSize: 1 },
        seed: 4,
        points: [
          { x: 0, y: 0, t: 0 },
          { x: 10_000, y: 0, t: 1000 },
        ],
      },
      0.01,
      state
    );
    expect(state.sampleIndex).toBe(40_000);
    expect(paint.createRadialGradient.mock.calls.length).toBeLessThan(250);
  });

  it('restores remote opacity after a paint error', () => {
    const paint = context();
    paint.globalAlpha = 0.8;
    paint.fill.mockImplementation(() => {
      throw new Error('Paint failed');
    });
    expect(() =>
      drawBrushStroke(
        paint as unknown as CanvasRenderingContext2D,
        { brush: defaultBrushSettings, opacity: 0.25, points: [{ x: 0, y: 0 }] },
        1,
        createBrushStrokeState()
      )
    ).toThrow('Paint failed');
    expect(paint.globalAlpha).toBe(0.8);
  });

  it('uses the same fixed Flat angle when a direction change crosses a chunk boundary', () => {
    const whole = context();
    const split = context();
    const stroke = {
      brush: { ...defaultBrushSettings, brushType: 'flat' as const },
      angle: 35,
      points,
    };
    drawBrushStroke(
      whole as unknown as CanvasRenderingContext2D,
      stroke,
      1,
      createBrushStrokeState()
    );
    const state = createBrushStrokeState();
    drawBrushStroke(
      split as unknown as CanvasRenderingContext2D,
      { ...stroke, points: points.slice(0, 2) },
      1,
      state
    );
    drawBrushStroke(
      split as unknown as CanvasRenderingContext2D,
      { ...stroke, points: points.slice(1) },
      1,
      state
    );
    expect(split.moveTo.mock.calls).toEqual(whole.moveTo.mock.calls);
    expect(split.lineTo.mock.calls).toEqual(whole.lineTo.mock.calls);
  });
});
