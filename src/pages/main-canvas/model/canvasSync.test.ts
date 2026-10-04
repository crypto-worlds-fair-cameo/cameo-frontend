import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasSync, type CanvasSyncState } from './canvasSync';
import { CanvasRequestError } from '../api/canvasRequests';
import type { CanvasReady, CanvasSocket } from '../api/canvasSocket';
import type {
  AppendStrokeInput,
  AppendStrokeResult,
  CanvasSyncPage,
  StrokePreview,
  SyncCanvasInput,
} from '../api/canvasProtocol';
import type { CanvasStroke } from './useCanvasDrawing';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';

const epoch = '00000000-0000-4000-8000-000000000001';
const nextEpoch = '00000000-0000-4000-8000-000000000002';
const id = '11111111-1111-4111-8111-111111111111';
const ready: CanvasReady = {
  protocolVersion: 1,
  canvasKey: 'main',
  presence: { connectionCount: 1 },
  viewer: { status: 'authenticated', userId: 'user-a' },
  canDraw: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function preview(sequence: number, patch: Partial<StrokePreview> = {}): StrokePreview {
  return {
    canvasKey: 'main',
    epoch,
    sequence: String(sequence),
    userId: 'user-a',
    clientStrokeId: id,
    brush: { type: 'round', size: 12, color: '#ED4242', opacity: 1, version: 1 },
    points: [{ x: sequence, y: sequence }],
    chunkIndex: sequence - 1,
    isFinal: false,
    ...patch,
  };
}

function stroke(): CanvasStroke {
  return { clientStrokeId: id, brush: { ...defaultBrushSettings }, points: [{ x: 100, y: 200 }] };
}

const owners: ReturnType<typeof createCanvasSync>[] = [];
function setup(history: StrokePreview[] = []) {
  let state!: CanvasSyncState;
  let currentEpoch = epoch;
  let currentUser = ready.viewer.userId!;
  const socket = { connected: true } as CanvasSocket;
  const reset = vi.fn();
  const requests = {
    append: vi.fn(
      async (_socket: CanvasSocket, input: AppendStrokeInput): Promise<AppendStrokeResult> => {
        const repeated = history.find(
          item =>
            item.epoch === currentEpoch &&
            item.userId === currentUser &&
            item.clientStrokeId === input.clientStrokeId &&
            item.chunkIndex === input.chunkIndex &&
            item.isFinal === input.isFinal &&
            JSON.stringify(item.points) === JSON.stringify(input.points) &&
            JSON.stringify(item.brush) === JSON.stringify(input.brush)
        );
        if (repeated) return { accepted: false, preview: repeated };
        const accepted = preview(history.length + 1, {
          ...input,
          epoch: currentEpoch,
          userId: currentUser,
        });
        history.push(accepted);
        return { accepted: true, preview: accepted };
      }
    ),
    sync: vi.fn(async (_socket: CanvasSocket, input: SyncCanvasInput): Promise<CanvasSyncPage> => {
      const isReset = input.epoch !== currentEpoch;
      const after = isReset ? 0 : Number(input.afterSequence);
      const head =
        isReset || input.throughSequence === undefined
          ? history.length
          : Number(input.throughSequence);
      const items = history.slice(after, Math.min(head, after + (input.limit ?? 50)));
      const cursor = items[items.length - 1]?.sequence ?? String(after);
      return {
        canvasKey: 'main',
        epoch: currentEpoch,
        reset: isReset,
        previews: items,
        headSequence: String(head),
        nextSequence: cursor,
        hasMore: Number(cursor) < head,
      };
    }),
  };
  const owner = createCanvasSync(
    next => {
      state = next;
    },
    reset,
    requests
  );
  owners.push(owner);
  return {
    owner,
    requests,
    socket,
    reset,
    state: () => state,
    setEpoch: (value: string) => {
      currentEpoch = value;
    },
    setUser: (value: string) => {
      currentUser = value;
    },
  };
}

async function connect(system: ReturnType<typeof setup>) {
  system.owner.ready(system.socket, ready);
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  vi.useRealTimers();
});

describe('canvas chunk transmission and recovery', () => {
  it('consumes the account stroke at the first ACK while continuing only that stroke', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    const firstAck = deferred<AppendStrokeResult>();
    system.requests.append.mockImplementationOnce(() => firstAck.promise);
    const started = stroke();
    expect(system.owner.transport.start(started)).toBe(true);
    expect(system.requests.append).toHaveBeenCalledOnce();
    const first = system.requests.append.mock.calls[0][1];
    expect(first).toMatchObject({ chunkIndex: 0, points: started.points, isFinal: false });
    expect(system.state().strokeUsed).toBe(false);
    expect(system.owner.transport.start({ ...stroke(), clientStrokeId: crypto.randomUUID() })).toBe(
      false
    );
    started.brush.color = '#000000';
    const accepted = preview(1, first);
    history.push(accepted);
    firstAck.resolve({ accepted: true, preview: accepted });
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false });
    system.owner.transport.move(id, [{ x: 104, y: 203 }]);
    await vi.advanceTimersByTimeAsync(50);
    expect(system.requests.append.mock.calls[1][1]).toMatchObject({
      clientStrokeId: id,
      chunkIndex: 1,
      brush: { color: first.brush.color },
      points: [
        { x: 100, y: 200 },
        { x: 104, y: 203 },
      ],
    });
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.requests.append.mock.calls[2][1]).toMatchObject({
      chunkIndex: 2,
      points: [],
      isFinal: true,
    });
    expect(system.state().optimisticStrokes).toHaveLength(0);
    expect(system.owner.transport.start({ ...stroke(), clientStrokeId: crypto.randomUUID() })).toBe(
      false
    );
  });

  it('waits after STROKE_BUSY and retries the exact first chunk even when the pointer ends', async () => {
    const system = setup();
    await connect(system);
    system.requests.append.mockRejectedValueOnce(new CanvasRequestError('STROKE_BUSY', 'busy'));
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(0);
    const first = system.requests.append.mock.calls[0][1];
    expect(system.state().strokeUsed).toBe(false);
    expect(system.state().error).toBeNull();
    system.owner.transport.move(id, [{ x: 104, y: 203 }]);
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(999);
    expect(system.requests.append).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(system.requests.append.mock.calls[1][1]).toBe(first);
    expect(system.requests.append.mock.calls[2][1]).toMatchObject({ chunkIndex: 1, isFinal: true });
    expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false, error: null });
  });

  it.each(['STROKE_LIMIT_REACHED', 'STROKE_ALREADY_USED'])(
    'stops rejected transmission and keeps %s across reconnect and epoch reset',
    async code => {
      const history: StrokePreview[] = [];
      const system = setup(history);
      await connect(system);
      system.requests.append.mockRejectedValueOnce(new CanvasRequestError(code, 'used'));
      system.owner.transport.start(stroke());
      await vi.advanceTimersByTimeAsync(0);
      expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false, error: { code } });
      expect(system.state().optimisticStrokes).toHaveLength(0);
      system.owner.interrupted();
      await connect(system);
      expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false, error: { code } });
      system.owner.interrupted();
      system.setEpoch(nextEpoch);
      await connect(system);
      expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false, error: { code } });
      expect(
        system.owner.transport.start({ ...stroke(), clientStrokeId: crypto.randomUUID() })
      ).toBe(false);
      await vi.advanceTimersByTimeAsync(5000);
      expect(system.requests.append).toHaveBeenCalledOnce();
    }
  );

  it('preserves confirmed usage across reconnect and a new epoch while ending the existing stroke', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(0);
    system.owner.transport.move(id, [{ x: 104, y: 203 }]);
    system.owner.interrupted();
    await connect(system);
    expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false });
    expect(system.requests.append.mock.calls[1][1]).toMatchObject({
      clientStrokeId: id,
      chunkIndex: 1,
      isFinal: true,
    });
    system.owner.interrupted();
    history.length = 0;
    system.setEpoch(nextEpoch);
    await connect(system);
    expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false, previews: [] });
    expect(system.owner.transport.start({ ...stroke(), clientStrokeId: crypto.randomUUID() })).toBe(
      false
    );
  });

  it('tracks usage per account without treating ready or historical previews as a remaining-stroke query', async () => {
    const system = setup([preview(1, { clientStrokeId: crypto.randomUUID(), isFinal: true })]);
    await connect(system);
    expect(system.state()).toMatchObject({ strokeUsed: false, canDraw: true });
    system.owner.transport.start(stroke());
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    system.setUser('user-b');
    system.owner.ready(system.socket, {
      ...ready,
      viewer: { status: 'authenticated', userId: 'user-b' },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({ strokeUsed: false, canDraw: true });
    system.setUser('user-a');
    await connect(system);
    expect(system.state()).toMatchObject({ strokeUsed: true, canDraw: false });
  });

  it('discards rejected local pending pixels instead of resubmitting them after reconnect', async () => {
    const system = setup();
    await connect(system);
    system.owner.transport.start(stroke());
    system.owner.transport.move(
      id,
      Array.from({ length: 100_000 }, () => ({ x: 100, y: 200 }))
    );
    expect(system.state().error?.code).toBe('LOCAL_CAPACITY_REACHED');
    expect(system.state().optimisticStrokes).toHaveLength(0);
    system.owner.interrupted();
    await connect(system);
    await vi.advanceTimersByTimeAsync(5000);
    expect(system.requests.append).toHaveBeenCalledOnce();
  });
  it('keeps pre-disconnect input but does not queue pointer movement made while offline', async () => {
    const system = setup();
    await connect(system);
    system.owner.transport.start(stroke());
    system.owner.transport.move(id, [{ x: 104, y: 203 }]);
    system.owner.interrupted();
    system.owner.transport.move(id, [{ x: 900, y: 900 }]);
    system.owner.transport.finish(id);
    expect(system.requests.append).toHaveBeenCalledOnce();
    await connect(system);
    expect(system.requests.append.mock.calls[1][1]).toBe(system.requests.append.mock.calls[0][1]);
    expect(system.requests.append.mock.calls[2][1].points).toEqual([
      { x: 100, y: 200 },
      { x: 104, y: 203 },
    ]);
    expect(system.requests.append.mock.calls[2][1].isFinal).toBe(true);
  });
  it('groups input at 50ms, overlaps boundaries, and sends an empty final immediately', async () => {
    const system = setup();
    await connect(system);
    expect(system.owner.transport.start(stroke())).toBe(true);
    expect(system.requests.append).toHaveBeenCalledOnce();
    system.owner.transport.move(id, [
      { x: 104, y: 203 },
      { x: 110, y: 208 },
    ]);
    await vi.advanceTimersByTimeAsync(49);
    expect(system.requests.append).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(system.requests.append.mock.calls[1][1].points).toEqual([
      { x: 100, y: 200 },
      { x: 104, y: 203 },
      { x: 110, y: 208 },
    ]);
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.requests.append.mock.calls[2][1]).toMatchObject({
      chunkIndex: 2,
      points: [],
      isFinal: true,
    });
    expect(system.state().previews).toHaveLength(3);
    expect(system.state().optimisticStrokes).toHaveLength(0);
  });

  it('sends a short click immediately and closes it with an empty final after the first ACK', async () => {
    const system = setup();
    await connect(system);
    system.owner.transport.start(stroke());
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.requests.append).toHaveBeenCalledTimes(2);
    expect(system.requests.append.mock.calls[0][1]).toMatchObject({
      chunkIndex: 0,
      isFinal: false,
      brush: { opacity: 1, version: 1 },
    });
    expect(system.requests.append.mock.calls[1][1]).toMatchObject({
      chunkIndex: 1,
      points: [],
      isFinal: true,
    });
  });

  it('collects points while awaiting ACK and obeys both packet limits', async () => {
    const system = setup();
    await connect(system);
    const waiting = deferred<AppendStrokeResult>();
    system.requests.append.mockImplementationOnce(() => waiting.promise);
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(50);
    system.owner.transport.move(
      id,
      Array.from({ length: 299 }, (_, i) => ({ x: i + 101, y: 200 }))
    );
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(100);
    expect(system.requests.append).toHaveBeenCalledOnce();
    const first = system.requests.append.mock.calls[0][1];
    // ACK 대기 중 생성한 좌표는 첫 요청 객체를 바꾸지 않는다.
    expect(first.points).toHaveLength(1);
    waiting.resolve({ accepted: true, preview: preview(1, first) });
    await vi.advanceTimersByTimeAsync(0);
    const inputs = system.requests.append.mock.calls.map(([, input]) => input);
    expect(inputs).toHaveLength(4);
    expect(inputs.map(input => input.chunkIndex)).toEqual([0, 1, 2, 3]);
    for (let i = 1; i < inputs.length; i++) {
      expect(inputs[i].points[0]).toEqual(inputs[i - 1].points[inputs[i - 1].points.length - 1]);
      expect(inputs[i].points.length).toBeLessThanOrEqual(128);
      expect(new TextEncoder().encode(JSON.stringify(inputs[i])).byteLength).toBeLessThanOrEqual(
        8192
      );
    }
    expect(inputs[3].isFinal).toBe(true);
  });

  it('retries the exact unacknowledged request after timeout without applying its sequence twice', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    let accepted!: StrokePreview;
    system.requests.append.mockImplementationOnce(async (_socket, input) => {
      accepted = preview(1, input);
      history.push(accepted);
      throw new CanvasRequestError('ACK_TIMEOUT', 'timeout');
    });
    system.requests.append.mockImplementationOnce(async () => ({
      accepted: false,
      preview: accepted,
    }));
    system.owner.transport.start(stroke());
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    system.owner.acceptPreview(accepted);
    expect(system.state().strokeUsed).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(system.state().previews.map(item => item.sequence)).toEqual(['1', '2']);
    expect(system.requests.append.mock.calls[1][1]).toBe(system.requests.append.mock.calls[0][1]);
    expect(system.state().strokeUsed).toBe(true);
    expect(system.state().optimisticStrokes).toHaveLength(0);
  });

  it('retries the same ID, index and data while ACK is unknown', async () => {
    const system = setup();
    await connect(system);
    system.requests.append.mockRejectedValueOnce(new CanvasRequestError('ACK_TIMEOUT', 'timeout'));
    system.owner.transport.start(stroke());
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(1000);
    expect(system.requests.append.mock.calls[1][1]).toBe(system.requests.append.mock.calls[0][1]);
    expect(system.state().previews).toHaveLength(2);
  });

  it('accepts a stored duplicate ACK whose JSON object keys have a different order', async () => {
    const system = setup();
    await connect(system);
    const started = stroke();
    started.brush.brushType = 'airbrush';
    started.seed = 123;
    started.points[0].t = 0;
    system.owner.transport.start(started);
    await vi.advanceTimersByTimeAsync(0);
    const append = system.requests.append.getMockImplementation()!;
    system.requests.append.mockImplementationOnce(async (socket, input) => {
      const result = await append(socket, input);
      return {
        accepted: false,
        preview: {
          ...result.preview,
          brush: Object.fromEntries(Object.entries(result.preview.brush).reverse()),
          points: result.preview.points.map(point =>
            Object.fromEntries(Object.entries(point).reverse())
          ),
        } as StrokePreview,
      };
    });
    system.owner.transport.move(id, [{ x: 104, y: 203, t: 16 }]);
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({
      error: null,
      submissionStatus: 'saved',
      optimisticStrokes: [],
    });
  });

  it.each(['brush', 'points'] as const)(
    'still rejects an ACK with changed %s values',
    async field => {
      const system = setup();
      await connect(system);
      system.requests.append.mockImplementationOnce(async (_socket, input) => ({
        accepted: true,
        preview: preview(1, {
          ...input,
          ...(field === 'brush'
            ? { brush: { ...input.brush, color: '#000000' } }
            : { points: [{ x: 900, y: 900 }] }),
        }),
      }));
      system.owner.transport.start(stroke());
      await vi.advanceTimersByTimeAsync(0);
      expect(system.state().error?.code).toBe('INVALID_RESPONSE');
      expect(system.state().strokeUsed).toBe(false);
      expect(system.state().previews).toHaveLength(0);
    }
  );

  it('buffers broadcasts during paginated sync and applies all chunks once in order', async () => {
    const history = Array.from({ length: 52 }, (_, index) => preview(index + 1));
    const system = setup(history);
    const page = deferred<CanvasSyncPage>();
    const original = system.requests.sync.getMockImplementation()!;
    system.requests.sync.mockImplementationOnce(() => page.promise);
    system.owner.ready(system.socket, ready);
    const firstPage = await original(system.socket, { afterSequence: '0', limit: 50 });
    history.push(preview(53));
    system.owner.acceptPreview(history[52]);
    page.resolve(firstPage);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.requests.sync.mock.calls[1][1]).toMatchObject({
      epoch,
      afterSequence: '50',
      throughSequence: '52',
    });
    expect(system.state().previews.map(item => item.sequence)).toEqual(
      Array.from({ length: 53 }, (_, index) => String(index + 1))
    );
    system.owner.acceptPreview(preview(53));
    expect(system.state().previews).toHaveLength(53);
  });

  it('recovers a sequence gap and periodically discovers a lost last broadcast', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    history.push(preview(1), preview(2));
    system.owner.acceptPreview(history[1]);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state().lastAppliedSequence).toBe('2');
    history.push(preview(3));
    await vi.advanceTimersByTimeAsync(5000);
    expect(system.state().lastAppliedSequence).toBe('3');
    expect(
      system.requests.sync.mock.calls[system.requests.sync.mock.calls.length - 1][1].afterSequence
    ).toBe('2');
  });

  it('coalesces gap recovery requests while a transient failure is backing off', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    history.push(...Array.from({ length: 10 }, (_, index) => preview(index + 1)));
    system.requests.sync.mockRejectedValueOnce(new CanvasRequestError('RATE_LIMITED', 'wait'));

    system.owner.acceptPreview(history[1]);
    await vi.advanceTimersByTimeAsync(0);
    for (const item of history.slice(2)) system.owner.acceptPreview(item);
    await vi.advanceTimersByTimeAsync(999);

    expect(system.requests.sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(system.state().lastAppliedSequence).toBe('10');
  });

  it('keeps the first page head and cursor when a later recovery page is retried', async () => {
    const history = Array.from({ length: 100 }, (_, index) => preview(index + 1));
    const system = setup(history);
    const sync = system.requests.sync.getMockImplementation()!;
    system.requests.sync
      .mockImplementationOnce(sync)
      .mockRejectedValueOnce(new CanvasRequestError('RATE_LIMITED', 'wait'));

    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(0);
    history.push(...Array.from({ length: 50 }, (_, index) => preview(index + 101)));
    await vi.advanceTimersByTimeAsync(1000);

    expect(system.requests.sync.mock.calls[2][1]).toMatchObject({
      epoch,
      afterSequence: '50',
      throughSequence: '100',
    });
    expect(system.state().lastAppliedSequence).toBe('100');
  });

  it('retains confirmed pixels and an unacknowledged request across reconnect, discarding old responses', async () => {
    const system = setup([preview(1)]);
    await connect(system);
    const old = deferred<AppendStrokeResult>();
    system.requests.append.mockImplementationOnce(() => old.promise);
    system.owner.transport.start(stroke());
    system.owner.transport.finish(id);
    system.owner.interrupted();
    expect(system.state().previews).toHaveLength(1);
    const input = system.requests.append.mock.calls[0][1];
    await connect(system);
    const secondInput = system.requests.append.mock.calls[1][1];
    expect(secondInput).toBe(input);
    const count = system.state().previews.length;
    old.resolve({ accepted: true, preview: preview(99, input) });
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state().previews).toHaveLength(count);
  });

  it('clears old pixels, cursor and resend queue when the server epoch changes', async () => {
    const history = [preview(1)];
    const system = setup(history);
    await connect(system);
    const old = deferred<AppendStrokeResult>();
    system.requests.append.mockImplementationOnce(() => old.promise);
    system.owner.transport.start(stroke());
    system.owner.transport.finish(id);
    system.owner.interrupted();
    history.length = 0;
    system.setEpoch(nextEpoch);
    await connect(system);
    expect(system.state()).toMatchObject({
      epoch: nextEpoch,
      previews: [],
      optimisticStrokes: [],
      lastAppliedSequence: '0',
    });
    expect(system.requests.append).toHaveBeenCalledOnce();
    expect(system.reset).toHaveBeenCalledTimes(2);
    old.resolve({ accepted: true, preview: preview(2) });
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state().previews).toHaveLength(0);
  });

  it('waits for initial recovery and retries sync after a temporary storage failure', async () => {
    const system = setup();
    system.requests.sync.mockRejectedValueOnce(
      new CanvasRequestError('REALTIME_UNAVAILABLE', 'storage unavailable')
    );
    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(999);
    expect(system.state().status).toBe('recovering');
    expect(system.owner.transport.start(stroke())).toBe(false);
    expect(system.requests.append).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(system.state()).toMatchObject({ status: 'ready', error: null });
    expect(system.owner.transport.start(stroke())).toBe(true);
  });

  it('retains a capacity-rejected chunk and new points until the identical chunk succeeds', async () => {
    const system = setup();
    system.requests.sync.mockRejectedValueOnce(new CanvasRequestError('RATE_LIMITED', 'wait'));
    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(999);
    expect(system.requests.sync).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(system.state().status).toBe('ready');
    system.requests.append.mockRejectedValueOnce(
      new CanvasRequestError('CANVAS_CAPACITY_REACHED', 'full')
    );
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(0);
    const first = system.requests.append.mock.calls[0][1];
    expect(system.state()).toMatchObject({
      strokeUsed: false,
      error: null,
      retry: { code: 'CANVAS_CAPACITY_REACHED' },
    });
    system.owner.transport.move(id, [{ x: 104, y: 203 }]);
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(999);
    expect(system.state().optimisticStrokes[0].stroke.points).toHaveLength(2);
    expect(system.requests.append).toHaveBeenCalledOnce();
    expect(system.owner.transport.start({ ...stroke(), clientStrokeId: crypto.randomUUID() })).toBe(
      false
    );
    await vi.advanceTimersByTimeAsync(1);
    expect(system.requests.append.mock.calls[1][1]).toBe(first);
    expect(system.requests.append.mock.calls[2][1]).toMatchObject({ chunkIndex: 1, isFinal: true });
    expect(system.state()).toMatchObject({
      strokeUsed: true,
      submissionStatus: 'saved',
      error: null,
      retry: null,
      optimisticStrokes: [],
    });
  });

  it('retries a failed final save without discarding the stroke or restoring usage', async () => {
    const system = setup();
    await connect(system);
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(0);
    system.requests.append.mockRejectedValueOnce(
      new CanvasRequestError('REALTIME_UNAVAILABLE', 'save failed')
    );
    system.owner.transport.move(id, [{ x: 104, y: 203 }]);
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    const final = system.requests.append.mock.calls[1][1];
    expect(final.isFinal).toBe(true);
    expect(system.state()).toMatchObject({
      strokeUsed: true,
      submissionStatus: 'saving',
      retry: { code: 'REALTIME_UNAVAILABLE' },
      error: null,
    });
    expect(system.state().optimisticStrokes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(system.requests.append.mock.calls[2][1]).toBe(final);
    expect(system.state()).toMatchObject({
      submissionStatus: 'saved',
      retry: null,
      optimisticStrokes: [],
    });
  });

  it('keeps retrying a final ACK lost after storage even if sync has already returned its preview', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(0);
    const append = system.requests.append.getMockImplementation()!;
    system.requests.append.mockImplementationOnce(async (socket, input) => {
      await append(socket, input);
      throw new CanvasRequestError('ACK_TIMEOUT', 'final ACK lost');
    });
    system.owner.transport.finish(id);
    await vi.advanceTimersByTimeAsync(0);
    const final = system.requests.append.mock.calls[1][1];
    await system.owner.recover();
    expect(system.state().previews.map(item => item.sequence)).toEqual(['1', '2']);
    expect(system.state().submissionStatus).toBe('saving');
    expect(system.state().optimisticStrokes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(system.requests.append.mock.calls[2][1]).toBe(final);
    expect(system.state()).toMatchObject({ submissionStatus: 'saved', optimisticStrokes: [] });
    expect(system.state().previews.map(item => item.sequence)).toEqual(['1', '2']);
  });

  it('restores saved pages in the new epoch while discarding the previous resend queue', async () => {
    const history: StrokePreview[] = [];
    const system = setup(history);
    await connect(system);
    system.owner.transport.start(stroke());
    await vi.advanceTimersByTimeAsync(0);
    const oldFinal = deferred<AppendStrokeResult>();
    system.requests.append.mockImplementationOnce(() => oldFinal.promise);
    system.owner.transport.finish(id);
    const final = system.requests.append.mock.calls[1][1];
    system.owner.interrupted();
    system.setEpoch(nextEpoch);
    history.splice(
      0,
      history.length,
      ...Array.from({ length: 52 }, (_, i) => preview(i + 1, { epoch: nextEpoch }))
    );
    await connect(system);
    expect(system.state()).toMatchObject({
      epoch: nextEpoch,
      lastAppliedSequence: '52',
      strokeUsed: true,
      optimisticStrokes: [],
      submissionStatus: 'idle',
    });
    expect(system.state().previews).toHaveLength(52);
    expect(system.requests.sync.mock.calls.slice(-1)[0]![1]).toMatchObject({
      epoch: nextEpoch,
      afterSequence: '50',
      throughSequence: '52',
    });
    oldFinal.resolve({ accepted: true, preview: preview(2, final) });
    await vi.advanceTimersByTimeAsync(5000);
    expect(system.requests.append).toHaveBeenCalledTimes(2);
    expect(system.state().previews).toHaveLength(52);
  });

  it('rejects guest drawing and does not send while disconnected or after disposal', async () => {
    const system = setup();
    system.owner.ready(system.socket, {
      ...ready,
      viewer: { status: 'guest', userId: null },
      canDraw: false,
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(system.owner.transport.start(stroke())).toBe(false);
    system.owner.interrupted();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(system.requests.append).not.toHaveBeenCalled();
    const calls = system.requests.sync.mock.calls.length;
    system.owner.dispose();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(system.requests.sync).toHaveBeenCalledTimes(calls);
  });
});
