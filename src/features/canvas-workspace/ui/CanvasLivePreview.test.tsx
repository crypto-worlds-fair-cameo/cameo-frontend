import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasLivePreview } from './CanvasLivePreview';

const mocks = vi.hoisted(() => ({
  session: null as object | null,
  status: 'recovering' as 'recovering' | 'ready',
  realtime: vi.fn(),
}));
vi.mock('@/entities/session', () => ({ useSessionQuery: () => ({ data: mocks.session }) }));
vi.mock('../model/useCanvasRealtime', () => ({
  useCanvasRealtime: (...args: unknown[]) => {
    mocks.realtime(...args);
    return {
      dimensions: { width: 1000, height: 500 },
      sync: { status: mocks.status },
      drawingModel: { drawing: { liveStrokes: [], serverChunks: [] }, revision: 0 },
    };
  },
}));

const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
};

beforeEach(() => {
  mocks.session = null;
  mocks.status = 'recovering';
  mocks.realtime.mockClear();
  Object.values(context).forEach(spy => spy.mockClear());
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
});
afterEach(() => vi.restoreAllMocks());

describe('CanvasLivePreview', () => {
  it('watches without drawing input and waits for a login on wallet-only canvases', () => {
    render(<CanvasLivePreview canvasKey="season:one" requiresSession label="Current canvas" />);
    expect(mocks.realtime).toHaveBeenLastCalledWith(
      expect.anything(),
      'live',
      expect.objectContaining({ canvasKey: 'season:one', enabled: false, allowLiveInput: false })
    );
  });

  it('paints the whole paper centered in the box only after recovery finishes', async () => {
    const { rerender } = render(
      <CanvasLivePreview canvasKey="season:one" label="Current canvas" />
    );
    expect(mocks.realtime).toHaveBeenLastCalledWith(
      expect.anything(),
      'live',
      expect.objectContaining({ enabled: true })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.fillRect).not.toHaveBeenCalled();

    mocks.status = 'ready';
    rerender(<CanvasLivePreview canvasKey="season:one" label="Current canvas" />);
    // 1000×500 도화지를 400px 상자에 맞추면 0.4배로 줄고 위아래에 100px씩 여백이 생긴다.
    await waitFor(() => expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1000, 500));
    const ratio = window.devicePixelRatio || 1;
    expect(context.setTransform).toHaveBeenCalledWith(
      0.4 * ratio,
      0,
      0,
      0.4 * ratio,
      0,
      100 * ratio
    );
  });
});
