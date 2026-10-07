import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasReady, CanvasSocket } from '../api/canvasSocket';
import type { AppendStrokeInput } from '../api/canvasProtocol';
import { CanvasRequestError } from '../api/canvasRequests';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useCanvasConnection } from './useCanvasConnection';
import type { CanvasMode } from './useCanvasMode';
import { useCanvasRealtime } from './useCanvasRealtime';

const { appendStroke, syncCanvas } = vi.hoisted(() => ({
  appendStroke: vi.fn(),
  syncCanvas: vi.fn(),
}));
vi.mock('../api/canvasRequests', async importOriginal => ({
  ...(await importOriginal<typeof import('../api/canvasRequests')>()),
  appendStroke,
  syncCanvas,
}));
vi.mock('./useCanvasConnection', () => ({
  useCanvasConnection: vi.fn(() => ({ connection: { status: 'ready' } })),
}));

const epoch = '00000000-0000-4000-8000-000000000001';
const ready: CanvasReady = {
  protocolVersion: 1,
  canvasKey: 'main',
  presence: { connectionCount: 1 },
  viewer: { status: 'authenticated', userId: 'user-a' },
  canDraw: true,
};

/** 실제 동기화 소유자와 입력 모델을 연결하고, 서버의 승인·거절만 테스트 응답으로 대체한다. */
async function setup() {
  const hook = renderHook(
    ({ mode, brush }: { mode: CanvasMode; brush?: BrushSettings }) =>
      useCanvasRealtime(brush ?? defaultBrushSettings, mode),
    { initialProps: { mode: 'live' } as { mode: CanvasMode; brush?: BrushSettings } }
  );
  await act(async () => {
    vi.mocked(useCanvasConnection)
      .mock.calls.slice(-1)[0]![0]!
      .onReady?.({ connected: true } as CanvasSocket, ready);
    await vi.advanceTimersByTimeAsync(0);
  });
  return hook;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  let sequence = 0;
  appendStroke.mockImplementation(async (_socket: CanvasSocket, input: AppendStrokeInput) => ({
    accepted: true,
    preview: {
      ...input,
      canvasKey: 'main',
      epoch,
      sequence: String(++sequence),
      userId: 'user-a',
    },
  }));
  syncCanvas.mockResolvedValue({
    canvasKey: 'main',
    epoch,
    reset: true,
    previews: [],
    headSequence: '0',
    nextSequence: '0',
    hasMore: false,
  });
});
afterEach(() => vi.useRealTimers());

describe('canvas live transmission and pointer-up notices', () => {
  it('keeps the immediate usage notice while a final save retries and confirms saving only on ACK', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      await vi.advanceTimersByTimeAsync(0);
    });
    appendStroke.mockRejectedValueOnce(
      new CanvasRequestError('REALTIME_UNAVAILABLE', 'save failed')
    );
    act(() => result.current.drawingModel.finishStroke(1, { x: 110, y: 210 }));
    expect(result.current.strokeNotice).toBe('completed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBe('completed');
    expect(result.current.sync).toMatchObject({
      submissionStatus: 'saving',
      retry: { code: 'REALTIME_UNAVAILABLE' },
      strokeUsed: true,
    });
    act(() => result.current.onStrokeNoticeOpenChange(false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.sync.submissionStatus).toBe('saved');
    expect(result.current.strokeNotice).toBeNull();
  });

  it('streams before pointer-up, continues the used stroke and opens the notice only on release', async () => {
    const { result, rerender } = await setup();
    await act(async () => {
      expect(result.current.drawingModel.startStroke(1, { x: 100, y: 200 })).toBe(true);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(appendStroke).toHaveBeenCalledTimes(1);
    expect(appendStroke.mock.calls[0][1].points).toEqual([{ x: 100, y: 200 }]);
    expect(appendStroke.mock.calls[0][1].isFinal).toBe(false);
    expect(result.current.sync.strokeUsed).toBe(true);
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.drawingModel.drawing.activeStroke).toBeNull();
    await act(async () => {
      result.current.drawingModel.moveStroke(1, { x: 110, y: 210 });
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(appendStroke).toHaveBeenCalledTimes(2);
    expect(appendStroke.mock.calls[1][1].points).toEqual([
      { x: 100, y: 200 },
      { x: 110, y: 210 },
    ]);
    expect(result.current.strokeNotice).toBeNull();
    act(() => result.current.drawingModel.finishStroke(1, { x: 120, y: 220 }));
    expect(result.current.strokeNotice).toBe('completed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(appendStroke.mock.calls.slice(-1)[0]![1].isFinal).toBe(true);
    const sent = appendStroke.mock.calls.length;
    act(() => result.current.onStrokeNoticeOpenChange(false));
    act(() => expect(result.current.drawingModel.startStroke(2, { x: 300, y: 400 })).toBe(false));
    expect(result.current.strokeNotice).toBe('limit');
    expect(appendStroke).toHaveBeenCalledTimes(sent);
    act(() => result.current.onStrokeNoticeOpenChange(false));
    rerender({ mode: 'practice' });
    act(() => {
      expect(result.current.drawingModel.startStroke(3, { x: 300, y: 400 })).toBe(true);
      result.current.drawingModel.finishStroke(3, { x: 350, y: 450 });
    });
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.drawingModel.drawing.practiceStroke).not.toBeNull();
    expect(appendStroke).toHaveBeenCalledTimes(sent);
  });

  it('opens immediately on release during ACK wait and does not reopen after the ACK', async () => {
    const implementation = appendStroke.getMockImplementation()!;
    let approve!: () => void;
    const approval = new Promise<void>(resolve => {
      approve = resolve;
    });
    appendStroke.mockImplementationOnce(async (...args) => {
      await approval;
      return implementation(...args);
    });
    const { result } = await setup();
    act(() => result.current.drawingModel.startStroke(1, { x: 100, y: 200 }));
    await act(async () => {
      result.current.drawingModel.moveStroke(1, { x: 110, y: 210 });
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(appendStroke).toHaveBeenCalledTimes(1);
    expect(result.current.strokeNotice).toBeNull();
    act(() => result.current.drawingModel.finishStroke(1, { x: 110, y: 210 }));
    expect(result.current.sync.strokeUsed).toBe(false);
    expect(result.current.strokeNotice).toBe('completed');
    act(() => result.current.onStrokeNoticeOpenChange(false));
    act(() => expect(result.current.drawingModel.startStroke(2, { x: 300, y: 400 })).toBe(false));
    await act(async () => {
      approve();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.sync.strokeUsed).toBe(true);
    expect(result.current.strokeNotice).toBeNull();
    expect(appendStroke).toHaveBeenCalledTimes(2);
    expect(appendStroke.mock.calls[1][1].isFinal).toBe(true);
    act(() => result.current.drawingModel.finishStroke(1, { x: 110, y: 210 }));
    expect(result.current.strokeNotice).toBeNull();
  });

  it('replaces the release notice with the quota rejection after refresh', async () => {
    appendStroke.mockRejectedValue(new CanvasRequestError('STROKE_LIMIT_REACHED', 'Used'));
    const { result } = await setup();
    act(() => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      result.current.drawingModel.finishStroke(1, { x: 110, y: 210 });
    });
    expect(result.current.strokeNotice).toBe('completed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBe('limit');
    expect(result.current.sync.optimisticStrokes).toHaveLength(0);
    expect(result.current.drawingModel.drawing.activeStroke).toBeNull();
    act(() => result.current.onStrokeNoticeOpenChange(false));
    act(() => expect(result.current.drawingModel.startStroke(2, { x: 100, y: 200 })).toBe(false));
    expect(result.current.strokeNotice).toBe('limit');
    expect(appendStroke).toHaveBeenCalledTimes(1);
  });

  it('closes the release notice on a permanent drawing error', async () => {
    appendStroke.mockRejectedValue(new CanvasRequestError('UNAUTHORIZED', 'Login required'));
    const { result } = await setup();
    act(() => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      result.current.drawingModel.finishStroke(1, { x: 110, y: 210 });
    });
    expect(result.current.strokeNotice).toBe('completed');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.sync.error?.code).toBe('UNAUTHORIZED');
  });

  it('closes an old account notice when the authenticated account changes', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      result.current.drawingModel.finishStroke(1, { x: 110, y: 210 });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBe('completed');
    await act(async () => {
      vi.mocked(useCanvasConnection)
        .mock.calls.slice(-1)[0]![0]!
        .onReady?.({ connected: true } as CanvasSocket, {
          ...ready,
          viewer: { status: 'authenticated', userId: 'user-b' },
        });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.sync.strokeUsed).toBe(false);
  });

  it('ends a cancelled stroke without a completion notice or restoring its usage', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      result.current.drawingModel.cancelStroke(1);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.sync.strokeUsed).toBe(true);
    expect(appendStroke.mock.calls.slice(-1)[0]![1].isFinal).toBe(true);
    act(() => expect(result.current.drawingModel.startStroke(2, { x: 300, y: 400 })).toBe(false));
    expect(result.current.strokeNotice).toBe('limit');
  });

  it('preserves frozen brush, seed, UUID and relative times during live streaming', async () => {
    const { result, rerender } = await setup();
    const brush: BrushSettings = { ...defaultBrushSettings, brushType: 'airbrush', brushSize: 30 };
    rerender({ mode: 'live', brush });
    await act(async () => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200, t: 1000 });
      await vi.advanceTimersByTimeAsync(0);
    });
    const original = result.current.sync.optimisticStrokes[0].stroke;
    rerender({ mode: 'live', brush: { ...brush, color: '#000000', brushSize: 80 } });
    await act(async () => {
      for (let i = 1; i <= 200; i++)
        result.current.drawingModel.moveStroke(1, { x: 100 + i, y: 200 + i, t: 1000 + i * 16 });
      await vi.advanceTimersByTimeAsync(50);
    });
    const streamed = result.current.sync.optimisticStrokes[0].stroke;
    expect(streamed.brush).toEqual(brush);
    expect(result.current.strokeNotice).toBeNull();
    await act(async () => {
      result.current.drawingModel.finishStroke(1, { x: 300, y: 400, t: 4200 });
      await vi.advanceTimersByTimeAsync(0);
    });
    const chunks = appendStroke.mock.calls.map(([, input]) => input as AppendStrokeInput);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.slice(-1)[0]!.isFinal).toBe(true);
    expect(chunks.map(chunk => chunk.chunkIndex)).toEqual(chunks.map((_, i) => i));
    expect(
      chunks.every(
        chunk =>
          chunk.clientStrokeId === original.clientStrokeId && chunk.brush.seed === original.seed
      )
    ).toBe(true);
    expect(
      chunks.every(chunk => chunk.brush.color === brush.color && chunk.brush.size === 30)
    ).toBe(true);
    expect(chunks.flatMap((chunk, i) => (i ? chunk.points.slice(1) : chunk.points))).toEqual(
      streamed.points
    );
    expect(result.current.strokeNotice).toBe('completed');
  });

  it('ends live input on disconnect, preserving approved usage without a completion notice', async () => {
    const { result } = await setup();
    await act(async () => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => vi.mocked(useCanvasConnection).mock.calls.slice(-1)[0]![0]!.onInterrupted?.());
    act(() => result.current.drawingModel.finishStroke(1, { x: 110, y: 210 }));
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.sync.strokeUsed).toBe(true);
    expect(appendStroke).toHaveBeenCalledTimes(1);
  });

  it('ends the live stroke without a completion notice on switching to practice', async () => {
    const { result, rerender } = await setup();
    await act(async () => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      await vi.advanceTimersByTimeAsync(0);
    });
    rerender({ mode: 'practice' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.strokeNotice).toBeNull();
    expect(result.current.sync.strokeUsed).toBe(true);
    expect(appendStroke.mock.calls.slice(-1)[0]![1].isFinal).toBe(true);
  });

  it('keeps the local point limit without announcing an interrupted stroke', async () => {
    const { result } = await setup();
    act(() => {
      result.current.drawingModel.startStroke(1, { x: 100, y: 200 });
      result.current.drawingModel.moveStroke(
        1,
        Array.from({ length: 99_999 }, (_, i) => ({
          x: i % 10_000,
          y: Math.floor(i / 10_000),
        }))
      );
    });
    act(() => result.current.drawingModel.finishStroke(1, { x: 100, y: 200 }));
    expect(result.current.sync.error?.code).toBe('LOCAL_CAPACITY_REACHED');
    expect(result.current.strokeNotice).toBeNull();
    expect(appendStroke).toHaveBeenCalledTimes(1);
  });
});
