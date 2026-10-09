import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasSync, type CanvasSyncState } from './canvasSync';
import { CanvasRequestError } from '../api/canvasRequests';
import type { CanvasReady, CanvasSocket } from '../api/canvasSocket';
import type { CanvasBootstrapPayload, StrokePreview, SyncCanvasInput } from '../api/canvasProtocol';
import {
  CANVAS_RENDERER_VERSION,
  loadCanvasSnapshot,
  releaseCanvasSnapshot,
  type CanvasSnapshotBase,
} from './canvasSnapshot';

vi.mock('./canvasSnapshot', async importOriginal => ({
  ...(await importOriginal<typeof import('./canvasSnapshot')>()),
  loadCanvasSnapshot: vi.fn(),
  releaseCanvasSnapshot: vi.fn(),
}));

const epoch = '00000000-0000-4000-8000-000000000001';
const snapshotId = '11111111-1111-4111-8111-111111111111';
const ready: CanvasReady = {
  protocolVersion: 1,
  canvasKey: 'main',
  presence: { connectionCount: 1 },
  viewer: { status: 'authenticated', userId: 'user-a' },
  canDraw: true,
};
const bootstrap: CanvasBootstrapPayload = {
  canvasKey: 'main',
  epoch,
  baseSequence: '10',
  headSequence: '11',
  snapshot: {
    snapshotId,
    canvasKey: 'main',
    throughSequence: '10',
    imageUrl: '/snapshot.png',
    imageSha256: 'a'.repeat(64),
    continuationStateUrl: '/continuation.json',
    continuationStateSha256: 'b'.repeat(64),
    width: 10_000,
    height: 10_000,
    rendererVersion: CANVAS_RENDERER_VERSION,
    capturedAt: '2026-10-09T00:00:00Z',
  },
};
const withoutSnapshot: CanvasBootstrapPayload = {
  canvasKey: 'main',
  epoch,
  baseSequence: '0',
  headSequence: '1',
  snapshot: null,
};

function snapshotBase(): CanvasSnapshotBase {
  return {
    snapshotId,
    throughSequence: '10',
    rendererVersion: CANVAS_RENDERER_VERSION,
    image: { width: 10_000, height: 10_000, close: vi.fn() } as unknown as ImageBitmap,
    strokes: [],
  };
}

const owners: ReturnType<typeof createCanvasSync>[] = [];
function setup() {
  let state!: CanvasSyncState;
  const socket = { connected: true } as CanvasSocket;
  const requests = {
    bootstrap: vi.fn().mockResolvedValue(bootstrap),
    sync: vi.fn(async (_socket: CanvasSocket, input: SyncCanvasInput) => {
      const after = BigInt(input.afterSequence);
      const head = input.throughSequence ?? input.afterSequence;
      const previews: StrokePreview[] =
        after < BigInt(head)
          ? [
              {
                canvasKey: 'main',
                epoch,
                sequence: head,
                userId: 'user-b',
                clientStrokeId: snapshotId,
                chunkIndex: 0,
                brush: { type: 'round', size: 12, color: '#ED4242', opacity: 1, version: 1 },
                points: [{ x: 100, y: 200 }],
                isFinal: true,
              },
            ]
          : [];
      return {
        canvasKey: 'main' as const,
        epoch,
        reset: false,
        headSequence: head,
        nextSequence: head,
        hasMore: false,
        previews,
      };
    }),
  };
  const owner = createCanvasSync(
    next => {
      state = next;
    },
    vi.fn(),
    requests,
    vi.fn(),
    vi.fn(),
    'main',
    true
  );
  owners.push(owner);
  return { owner, requests, socket, state: () => state };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(loadCanvasSnapshot).mockReset();
  vi.mocked(releaseCanvasSnapshot).mockClear();
});

afterEach(() => {
  for (const owner of owners.splice(0)) owner.dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('snapshot recovery boundaries', () => {
  it('installs the verified image and replays only chunks after its sequence', async () => {
    const base = snapshotBase();
    vi.mocked(loadCanvasSnapshot).mockResolvedValue(base);
    const system = setup();
    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(0);

    expect(system.requests.bootstrap).toHaveBeenCalledWith(
      system.socket,
      { preferSnapshot: true, rendererVersion: CANVAS_RENDERER_VERSION },
      expect.objectContaining({ canvasKey: 'main' })
    );
    expect(system.requests.sync.mock.calls[0][1]).toMatchObject({
      afterSequence: '10',
      throughSequence: '11',
      epoch,
    });
    expect(system.state()).toMatchObject({
      status: 'ready',
      canDraw: true,
      snapshotBase: base,
      lastAppliedSequence: '11',
    });
    expect(system.state().previews.map(preview => preview.sequence)).toEqual(['11']);
  });

  it('requests a fresh zero base after image verification fails', async () => {
    vi.mocked(loadCanvasSnapshot).mockRejectedValue(
      new Error('Canvas snapshot hash does not match.')
    );
    const system = setup();
    system.requests.bootstrap.mockResolvedValueOnce(bootstrap).mockResolvedValue(withoutSnapshot);
    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(0);

    expect(loadCanvasSnapshot).toHaveBeenCalledOnce();
    expect(system.requests.bootstrap).toHaveBeenCalledTimes(2);
    expect(system.requests.bootstrap.mock.calls[1][1]).toMatchObject({ preferSnapshot: false });
    expect(system.requests.sync.mock.calls[0][1]).toMatchObject({ afterSequence: '0' });
    expect(system.state()).toMatchObject({
      status: 'ready',
      snapshotBase: null,
      lastAppliedSequence: '1',
    });
  });

  it('discards a completed image from a disconnected generation', async () => {
    let resolve!: (base: CanvasSnapshotBase) => void;
    vi.mocked(loadCanvasSnapshot).mockImplementation(
      () => new Promise<CanvasSnapshotBase>(yes => (resolve = yes))
    );
    const system = setup();
    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.requests.sync).not.toHaveBeenCalled();
    system.owner.interrupted();
    const base = snapshotBase();
    resolve(base);
    await vi.advanceTimersByTimeAsync(0);

    expect(releaseCanvasSnapshot).toHaveBeenCalledWith(base);
    expect(system.requests.sync).not.toHaveBeenCalled();
    expect(system.state()).toMatchObject({ status: 'waiting', canDraw: false, snapshotBase: null });
  });

  it('stops automatic bootstrap retries and allows an explicit retry', async () => {
    const system = setup();
    system.requests.bootstrap.mockRejectedValue(new CanvasRequestError('ACK_TIMEOUT', 'timeout'));
    system.owner.ready(system.socket, ready);
    await vi.advanceTimersByTimeAsync(31_000);

    expect(system.requests.bootstrap).toHaveBeenCalledTimes(6);
    expect(system.state()).toMatchObject({
      status: 'failed',
      canDraw: false,
      error: { code: 'ACK_TIMEOUT' },
    });
    system.requests.bootstrap.mockResolvedValue(withoutSnapshot);
    system.owner.retryRecovery();
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({ status: 'ready', canDraw: true, error: null });
  });
});
