import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrawingCanvas } from './DrawingCanvas';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useCanvasDrawing } from '../model/useCanvasDrawing';

const props = {
  viewportWidth: 320,
  viewportHeight: 640,
  pixelRatio: 2,
  worldWidth: 10_000,
  worldHeight: 10_000,
  view: { scale: 0.0288, offsetX: 16, offsetY: 176 },
};

function CanvasProbe({ dimensions = props }: { dimensions?: typeof props }) {
  const drawingModel = useCanvasDrawing(defaultBrushSettings, 'live', 10_000, 10_000);
  return (
    <>
      <DrawingCanvas
        {...dimensions}
        brushSettings={defaultBrushSettings}
        mode="live"
        drawingModel={drawingModel}
      />
      <button onClick={() => drawingModel.startStroke(1, { x: 100, y: 200 })}>Start stroke</button>
      <button onClick={() => drawingModel.finishStroke(1, { x: 150, y: 250 })}>
        Finish stroke
      </button>
      <output data-testid="drawing-state">
        {drawingModel.drawing.activeStroke ? 'drawing' : 'idle'},
        {drawingModel.drawing.liveStrokes.length}
      </output>
    </>
  );
}

describe('canvas initialization recovery', () => {
  it('reuses completed live pixels during another stroke and rebuilds them on resize', async () => {
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      drawImage: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    const { rerender } = render(<CanvasProbe />);
    fireEvent.click(screen.getByRole('button', { name: 'Start stroke' }));
    await waitFor(() => expect(context.arc).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'Finish stroke' }));
    await waitFor(() => expect(context.lineTo).toHaveBeenCalledWith(150, 250));
    const completedLines = context.lineTo.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Start stroke' }));
    await waitFor(() => expect(context.arc).toHaveBeenCalledTimes(2));
    expect(context.lineTo.mock.calls.length).toBe(completedLines);
    rerender(
      <CanvasProbe
        dimensions={{
          ...props,
          viewportWidth: 640,
          view: { scale: 0.06, offsetX: 20, offsetY: 20 },
        }}
      />
    );
    await waitFor(() => expect(context.lineTo.mock.calls.length).toBeGreaterThan(completedLines));
  });

  it('cancels a stroke after a paint failure and waits for explicit retry', async () => {
    const context = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(() => {
        throw new Error('Paint failed');
      }),
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );
    render(<CanvasProbe />);
    await screen.findByRole('img');
    fireEvent.click(screen.getByRole('button', { name: 'Start stroke' }));
    await screen.findByRole('alert');
    expect(screen.getByTestId('drawing-state').textContent).toBe('idle,0');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('img');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['unavailable', 'throws'])('allows retry when the context %s', async failure => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    if (failure === 'throws') {
      getContext.mockImplementation(() => {
        throw new Error('Context creation failed');
      });
    } else {
      getContext.mockReturnValue(null);
    }

    render(<CanvasProbe />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      '캔버스를 표시하지 못했습니다'
    );
    expect(screen.queryByRole('img')).toBeNull();

    getContext.mockReturnValue({
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    const canvas = (await screen.findByRole('img')) as HTMLCanvasElement;
    expect(screen.queryByRole('alert')).toBeNull();
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(1280);
  });
});
