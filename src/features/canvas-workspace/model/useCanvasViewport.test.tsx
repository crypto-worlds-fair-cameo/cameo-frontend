import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasViewport } from './useCanvasViewport';

let resize: () => void;
const disconnect = vi.fn();
let width = 1440;
let height = 800;

function ViewportProbe() {
  const { containerRef, viewport, view } = useCanvasViewport(10_000, 10_000);
  return (
    <div ref={containerRef}>
      <output data-testid="viewport">
        {viewport.width},{viewport.height},{viewport.pixelRatio},{view?.scale ?? 'waiting'}
      </output>
    </div>
  );
}

beforeEach(() => {
  width = 1440;
  height = 800;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    }
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width, height }) as DOMRect
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('canvas viewport lifecycle', () => {
  it('refits the world when the container changes size', () => {
    render(<ViewportProbe />);
    expect(screen.getByTestId('viewport').textContent).toContain('1440,800,1,0.0768');

    width = 320;
    height = 640;
    act(() => resize());

    expect(screen.getByTestId('viewport').textContent).toContain('320,640,1,0.0288');
  });

  it('updates backing resolution when the device pixel ratio changes', () => {
    render(<ViewportProbe />);
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);

    act(() => window.dispatchEvent(new Event('resize')));

    expect(screen.getByTestId('viewport').textContent).toContain('1440,800,2,0.0768');
  });

  it('disconnects observers when the page is left', () => {
    const { unmount } = render(<ViewportProbe />);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
