import { describe, expect, it, vi } from 'vitest';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import type { CanvasDrawing } from '../model/useCanvasDrawing';
import type { StrokePreview } from '../api/canvasProtocol';
import { createCanvasDrawingRenderer } from './createCanvasDrawingRenderer';

function context() {
  const colors: string[] = [];
  const paint = {
    fillStyle: '',
    globalAlpha: 1,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    arc: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(() => colors.push(paint.fillStyle)),
    fill: vi.fn(() => colors.push(paint.fillStyle)),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    closePath: vi.fn(),
  };
  return { paint, colors, canvas: paint as unknown as CanvasRenderingContext2D };
}

function mockLayers() {
  const layer = context();
  const chunkLayer = context();
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  let count = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement
  ) {
    if (!contexts.has(this)) contexts.set(this, count++ === 0 ? layer.canvas : chunkLayer.canvas);
    return contexts.get(this)!;
  });
  return { layer, chunkLayer };
}

const settings = {
  width: 500,
  height: 300,
  pixelRatio: 1,
  view: { scale: 1, offsetX: 0, offsetY: 0 },
  worldWidth: 10_000,
  worldHeight: 10_000,
};

function chunk(
  sequence: string,
  userId: string,
  id: string,
  color: string,
  points: StrokePreview['points'],
  chunkIndex = 0
): StrokePreview {
  return {
    canvasKey: 'main',
    epoch: 'first',
    sequence,
    userId,
    clientStrokeId: id,
    brush: { type: 'round', size: 12, color, opacity: 1, version: 1 },
    points,
    chunkIndex,
    isFinal: false,
  };
}

function drawing(
  serverChunks: StrokePreview[],
  overrides: Partial<CanvasDrawing> = {}
): CanvasDrawing {
  return {
    liveStrokes: [],
    activeStroke: null,
    practiceStroke: null,
    epoch: 'first',
    resetVersion: 0,
    serverChunks,
    ...overrides,
  };
}

describe('authoritative canvas renderer', () => {
  it('replays interleaved chunks in global sequence order and appends only new chunks', () => {
    const { layer, chunkLayer } = mockLayers();
    const main = context();
    const renderer = createCanvasDrawingRenderer();
    const red = chunk('9007199254740993', 'a', 'same-id', '#ff0000', [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    const blue = chunk('9007199254740994', 'b', 'same-id', '#0000ff', [{ x: 5, y: 5 }]);
    const redTail = chunk(
      '9007199254740995',
      'a',
      'same-id',
      '#ff0000',
      [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      1
    );
    renderer.render(main.canvas, drawing([redTail, red, blue]), 'live', settings);
    expect(chunkLayer.colors).toEqual(['#ff0000', '#ff0000', '#0000ff', '#ff0000']);
    renderer.render(main.canvas, drawing([red, blue, redTail]), 'live', settings);
    expect(chunkLayer.colors).toHaveLength(4);
    const blueTail = chunk(
      '9007199254740996',
      'b',
      'same-id',
      '#0000ff',
      [
        { x: 5, y: 5 },
        { x: 30, y: 30 },
      ],
      1
    );
    renderer.render(main.canvas, drawing([red, blue, redTail, blueTail]), 'live', settings);
    expect(chunkLayer.colors).toEqual(['#ff0000', '#ff0000', '#0000ff', '#ff0000', '#0000ff']);
    expect(layer.paint.clearRect).toHaveBeenCalledOnce();
    // 청크별로 지운 버퍼를 한 번씩 합성하므로 전체 재생과 증분 재생이 같은 경계를 쓴다.
    expect(chunkLayer.paint.clearRect).toHaveBeenCalledTimes(4);
    expect(layer.paint.drawImage).toHaveBeenCalledTimes(4);
  });

  it('paints only the optimistic suffix and suppresses a fully acknowledged stroke', () => {
    const { chunkLayer } = mockLayers();
    const main = context();
    const renderer = createCanvasDrawingRenderer();
    const accepted = chunk('1', 'a', 'own', '#ED4242', [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    const stroke = {
      clientStrokeId: 'own',
      brush: defaultBrushSettings,
      points: [...accepted.points, { x: 20, y: 20 }],
    };
    renderer.render(
      main.canvas,
      drawing([accepted], { userId: 'a', optimisticStrokes: [{ stroke, acknowledgedPoints: 2 }] }),
      'live',
      settings
    );
    expect(main.paint.arc).not.toHaveBeenCalled();
    expect(main.paint.moveTo).toHaveBeenCalledWith(10, 10);
    expect(main.paint.lineTo).toHaveBeenCalledWith(20, 20);
    main.paint.stroke.mockClear();
    renderer.render(
      main.canvas,
      drawing([accepted], { userId: 'a', optimisticStrokes: [{ stroke, acknowledgedPoints: 3 }] }),
      'live',
      settings
    );
    expect(main.paint.stroke).not.toHaveBeenCalled();
    expect(chunkLayer.colors).toHaveLength(2);
  });

  it('composites only a chunk’s visible brush bounds and consumes offscreen points without painting', () => {
    const { layer, chunkLayer } = mockLayers();
    const main = context();
    const renderer = createCanvasDrawingRenderer();
    const visible = chunk('1', 'a', 'own', '#ED4242', [{ x: 100, y: 100 }]);
    renderer.render(main.canvas, drawing([visible]), 'live', settings);
    expect(layer.paint.drawImage.mock.calls[0]).toEqual([
      expect.any(HTMLCanvasElement),
      0,
      0,
      16,
      16,
      92,
      92,
      16,
      16,
    ]);
    const outside = chunk('2', 'b', 'outside', '#ED4242', [{ x: 9000, y: 9000 }]);
    renderer.render(main.canvas, drawing([visible, outside]), 'live', settings);
    expect(layer.paint.drawImage).toHaveBeenCalledOnce();
    expect(chunkLayer.paint.arc).toHaveBeenCalledOnce();
    // 화면 밖 끝점도 기억해 다음 묶음이 화면 안으로 들어오면 경계까지 이어 그린다.
    const entering = chunk('3', 'b', 'outside', '#ED4242', [{ x: 200, y: 200 }], 1);
    renderer.render(main.canvas, drawing([visible, outside, entering]), 'live', settings);
    expect(chunkLayer.paint.moveTo).toHaveBeenCalledWith(9000, 9000);
    expect(chunkLayer.paint.lineTo).toHaveBeenCalledWith(200, 200);
  });

  it('rebuilds pixels and stroke states for view, reset, and epoch changes', () => {
    const { layer, chunkLayer } = mockLayers();
    const main = context();
    const renderer = createCanvasDrawingRenderer();
    const accepted = chunk('1', 'a', 'own', '#ff0000', [{ x: 0, y: 0 }]);
    renderer.render(main.canvas, drawing([accepted]), 'live', settings);
    renderer.render(main.canvas, drawing([accepted]), 'live', {
      ...settings,
      view: { ...settings.view, scale: 2 },
    });
    renderer.render(main.canvas, drawing([accepted], { resetVersion: 1 }), 'live', settings);
    renderer.render(
      main.canvas,
      drawing([{ ...accepted, epoch: 'second' }], { epoch: 'second', resetVersion: 1 }),
      'live',
      settings
    );
    expect(chunkLayer.paint.arc).toHaveBeenCalledTimes(4);
    expect(layer.paint.clearRect).toHaveBeenCalledTimes(4);
    expect(layer.paint.restore.mock.calls.length).toBe(layer.paint.save.mock.calls.length);
    expect(main.paint.restore.mock.calls.length).toBe(main.paint.save.mock.calls.length);
  });

  it('restores contexts and discards a partially painted cache after a failure', () => {
    const { layer, chunkLayer } = mockLayers();
    const main = context();
    const renderer = createCanvasDrawingRenderer();
    const accepted = chunk('1', 'a', 'own', '#ff0000', [{ x: 0, y: 0 }]);
    chunkLayer.paint.fill.mockImplementationOnce(() => {
      throw new Error('Paint failed');
    });
    expect(() => renderer.render(main.canvas, drawing([accepted]), 'live', settings)).toThrow(
      'Paint failed'
    );
    expect(layer.paint.restore).toHaveBeenCalledOnce();
    expect(main.paint.restore).toHaveBeenCalledOnce();
    renderer.render(main.canvas, drawing([accepted]), 'live', settings);
    expect(layer.paint.clearRect).toHaveBeenCalledTimes(2);
    expect(chunkLayer.paint.arc).toHaveBeenCalledTimes(2);
  });
});
