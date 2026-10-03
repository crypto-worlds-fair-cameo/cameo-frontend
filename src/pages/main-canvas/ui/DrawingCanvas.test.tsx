import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DrawingCanvas } from './DrawingCanvas';

const props = {
  viewportWidth: 320,
  viewportHeight: 640,
  pixelRatio: 2,
  worldWidth: 10_000,
  worldHeight: 10_000,
  view: { scale: 0.0288, offsetX: 16, offsetY: 176 },
};

describe('canvas initialization recovery', () => {
  it.each(['unavailable', 'throws'])('allows retry when the context %s', async failure => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    if (failure === 'throws') {
      getContext.mockImplementation(() => {
        throw new Error('Context creation failed');
      });
    } else {
      getContext.mockReturnValue(null);
    }

    render(<DrawingCanvas {...props} />);
    expect((await screen.findByRole('alert')).textContent).toContain(
      '캔버스를 표시하지 못했습니다'
    );
    expect(screen.queryByRole('img')).toBeNull();

    getContext.mockReturnValue({
      setTransform: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    const canvas = (await screen.findByRole('img')) as HTMLCanvasElement;
    expect(screen.queryByRole('alert')).toBeNull();
    expect(canvas.width).toBe(640);
    expect(canvas.height).toBe(1280);
  });
});
