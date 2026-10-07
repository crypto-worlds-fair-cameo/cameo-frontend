import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasSync, type CanvasSyncState } from './canvasSync';
import type { CanvasSocket, SeasonReady, SeasonStateEvent } from '../api/canvasSocket';
import type {
  AppendStrokeInput,
  CanvasKey,
  CanvasSyncPage,
  StrokePreview,
  SyncCanvasInput,
} from '../api/canvasProtocol';
import { CanvasRequestError } from '../api/canvasRequests';
import { defaultBrushSettings } from '@/shared/ui/color-palette/model/brushSettings';

const key = 'season:11111111-1111-4111-8111-111111111111' as const;
const epoch = '00000000-0000-4000-8000-000000000001';
const nextEpoch = '00000000-0000-4000-8000-000000000002';
const ready: SeasonReady = {
  protocolVersion: 1,
  canvasKey: key,
  viewer: { status: 'authenticated', userId: 'u' },
  canDraw: true,
  presence: { connectionCount: 1 },
  serverTime: '2026-10-07T01:00:00Z',
  season: {
    width: 800,
    height: 600,
    strokeLimitPerUser: 2,
    startsAt: '2026-10-07T00:00:00Z',
    endsAt: '2026-10-08T00:00:00Z',
    forceEndedAt: null,
    cancelledAt: null,
    status: 'active',
    isParticipant: true,
    isCreator: false,
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
const owners: ReturnType<typeof createCanvasSync>[] = [];
function setup(canvasKey: CanvasKey = key) {
  let state!: CanvasSyncState;
  let currentEpoch = epoch;
  const history: StrokePreview[] = [];
  const socket = { connected: true } as CanvasSocket;
  const requests = {
    append: vi.fn(async (_socket: CanvasSocket, input: AppendStrokeInput) => {
      const existing = history.find(
        p => p.clientStrokeId === input.clientStrokeId && p.chunkIndex === input.chunkIndex
      );
      if (existing) return { accepted: false, preview: existing };
      const preview = {
        ...input,
        epoch: currentEpoch,
        canvasKey,
        userId: 'u',
        sequence: String(history.length + 1),
      };
      history.push(preview);
      return { accepted: true, preview };
    }),
    sync: vi.fn(async (_socket: CanvasSocket, input: SyncCanvasInput): Promise<CanvasSyncPage> => {
      const reset = input.epoch !== currentEpoch;
      const after = reset ? 0n : BigInt(input.afterSequence);
      const head =
        reset || input.throughSequence === undefined
          ? BigInt(history.length)
          : BigInt(input.throughSequence);
      const previews = history
        .filter(p => BigInt(p.sequence) > after && BigInt(p.sequence) <= head)
        .slice(0, input.limit ?? 50);
      const nextSequence = previews[previews.length - 1]?.sequence ?? String(after);
      return {
        canvasKey,
        epoch: currentEpoch,
        reset,
        previews,
        headSequence: String(head),
        nextSequence,
        hasMore: BigInt(nextSequence) < head,
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
    canvasKey
  );
  owners.push(owner);
  const stroke = () => ({
    clientStrokeId: crypto.randomUUID(),
    brush: { ...defaultBrushSettings },
    points: [{ x: 50, y: 40 }],
  });
  const boundary = (head: string): SeasonStateEvent => ({
    ...ready.season,
    canvasKey: canvasKey as `season:${string}`,
    status: 'ended',
    serverTime: ready.season.endsAt,
    epoch: currentEpoch,
    headSequence: head,
  });
  return {
    owner,
    requests,
    history,
    socket,
    stroke,
    boundary,
    state: () => state,
    setEpoch: (value: string) => {
      currentEpoch = value;
    },
  };
}
async function connect(system: ReturnType<typeof setup>, payload = ready) {
  system.owner.ready(system.socket, payload);
  await vi.advanceTimersByTimeAsync(0);
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  owners.splice(0).forEach(owner => owner.dispose());
  vi.useRealTimers();
});

describe('season recovery and append ownership', () => {
  it('paces buffered chunks to at most thirty append requests per second', async () => {
    const system = setup();
    await connect(system);
    const stroke = system.stroke();
    system.owner.transport.start(stroke);
    system.owner.transport.move(
      stroke.clientStrokeId,
      Array.from({ length: 4100 }, (_, index) => ({ x: 50 + (index % 600), y: 40 }))
    );
    system.owner.transport.finish(stroke.clientStrokeId);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.requests.append).toHaveBeenCalledTimes(30);
    await vi.advanceTimersByTimeAsync(999);
    expect(system.requests.append).toHaveBeenCalledTimes(30);
    await vi.advanceTimersByTimeAsync(2);
    expect(system.requests.append.mock.calls.length).toBeGreaterThan(30);
    expect(system.state().submissionStatus).toBe('saved');
  });
  it('preserves the fixed head and cursor when sync capacity requires a delayed retry', async () => {
    const system = setup();
    for (let i = 1; i <= 3; i++)
      system.history.push({
        ...system.stroke(),
        canvasKey: key,
        epoch,
        userId: 'u',
        sequence: String(i),
        chunkIndex: 0,
        isFinal: false,
        brush: { type: 'round', size: 12, color: '#123456', opacity: 1, version: 1 },
      });
    const original = system.requests.sync.getMockImplementation()!;
    system.requests.sync.mockImplementationOnce((socket, input) =>
      original(socket, { ...input, limit: 1 })
    );
    system.requests.sync.mockRejectedValueOnce(
      new CanvasRequestError('CANVAS_CAPACITY_REACHED', 'busy')
    );
    await connect(system);
    expect(system.state()).toMatchObject({
      status: 'recovering',
      lastAppliedSequence: '1',
      error: null,
    });
    expect(system.requests.sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(999);
    expect(system.requests.sync).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(system.requests.sync.mock.calls[2][1]).toEqual(system.requests.sync.mock.calls[1][1]);
    expect(system.requests.sync.mock.calls[2][1]).toMatchObject({
      afterSequence: '1',
      throughSequence: '3',
    });
    expect(system.state()).toMatchObject({ status: 'ready', lastAppliedSequence: '3' });
  });
  it('recovers an old stroke ID rejection without exhausting another allowed season stroke', async () => {
    const system = setup();
    await connect(system);
    system.requests.append.mockRejectedValueOnce(
      new CanvasRequestError('STROKE_ALREADY_USED', 'old id')
    );
    system.owner.transport.start(system.stroke());
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({ error: null, canDraw: true, strokeUsed: false });
    expect(system.owner.transport.start(system.stroke())).toBe(true);
  });
  it.each([2, null])(
    'allows another stroke after a final ACK for a season limit %s',
    async limit => {
      const system = setup();
      await connect(system, { ...ready, season: { ...ready.season, strokeLimitPerUser: limit } });
      const first = system.stroke();
      expect(system.owner.transport.start(first)).toBe(true);
      system.owner.transport.finish(first.clientStrokeId);
      await vi.advanceTimersByTimeAsync(0);
      expect(system.state().strokeUsed).toBe(false);
      expect(system.owner.transport.start(system.stroke())).toBe(true);
    }
  );
  it('stops new strokes only after an authoritative limit rejection and keeps other seasons independent', async () => {
    const a = setup();
    await connect(a);
    a.requests.append.mockRejectedValueOnce(new CanvasRequestError('STROKE_LIMIT_REACHED', 'used'));
    a.owner.transport.start(a.stroke());
    await vi.advanceTimersByTimeAsync(0);
    expect(a.state()).toMatchObject({ canDraw: false, strokeUsed: true });
    await connect(a);
    expect(a.owner.transport.start(a.stroke())).toBe(false);
    const bKey = 'season:22222222-2222-4222-8222-222222222222' as const;
    const b = setup(bKey);
    await connect(b, { ...ready, canvasKey: bKey });
    expect(b.owner.transport.start(b.stroke())).toBe(true);
  });
  it('keeps viewing when the flag is disabled and never opens input from an active event alone', async () => {
    const system = setup();
    await connect(system, { ...ready, canDraw: false });
    system.owner.seasonState({ ...system.boundary('0'), status: 'active' });
    expect(system.state().status).toBe('ready');
    expect(system.owner.transport.start(system.stroke())).toBe(false);
    expect(system.requests.append).not.toHaveBeenCalled();
  });
  it('recovers approved partial strokes at the final head, including late previews but excluding later data', async () => {
    const system = setup();
    await connect(system);
    const first = system.stroke();
    system.owner.transport.start(first);
    await vi.advanceTimersByTimeAsync(0);
    const partial = {
      ...system.history[0],
      sequence: '2',
      chunkIndex: 1,
      points: [
        { x: 50, y: 40 },
        { x: 60, y: 50 },
      ],
      isFinal: false,
    };
    system.history.push(partial);
    system.owner.seasonState(system.boundary('2'));
    expect(system.owner.transport.start(system.stroke())).toBe(false);
    system.owner.acceptPreview(partial);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state().previews.map(p => p.sequence)).toEqual(['1', '2']);
    expect(system.state().previews[system.state().previews.length - 1]?.isFinal).toBe(false);
    system.owner.acceptPreview({ ...partial, sequence: '3' });
    expect(system.state().lastAppliedSequence).toBe('2');
    expect(
      system.requests.sync.mock.calls[system.requests.sync.mock.calls.length - 1]?.[1]
        .throughSequence
    ).toBe('2');
  });
  it('finishes an older sync before recovering a newer terminal head', async () => {
    const system = setup();
    await connect(system);
    const first = system.stroke();
    system.owner.transport.start(first);
    await vi.advanceTimersByTimeAsync(0);
    const held = deferred<CanvasSyncPage>();
    const original = system.requests.sync.getMockImplementation()!;
    const oldPage = await original(system.socket, { epoch, afterSequence: '1' });
    system.requests.sync.mockImplementationOnce(() => held.promise);
    void system.owner.recover();
    system.history.push({ ...system.history[0], sequence: '2', chunkIndex: 1 });
    system.owner.seasonState(system.boundary('2'));
    held.resolve(oldPage);
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({ lastAppliedSequence: '2', canDraw: false });
  });
  it('drops old ACK waits after an epoch reset but restores the stored partial stroke', async () => {
    const system = setup();
    await connect(system);
    const held = deferred<{ accepted: boolean; preview: StrokePreview }>();
    system.requests.append.mockImplementationOnce(() => held.promise);
    system.owner.transport.start(system.stroke());
    const input = system.requests.append.mock.calls[0][1];
    system.owner.interrupted();
    system.setEpoch(nextEpoch);
    const stored = { ...input, canvasKey: key, epoch: nextEpoch, userId: 'u', sequence: '1' };
    system.history.push(stored);
    await connect(system);
    held.resolve({ accepted: true, preview: { ...stored, epoch } });
    await vi.advanceTimersByTimeAsync(0);
    expect(system.state()).toMatchObject({
      epoch: nextEpoch,
      optimisticStrokes: [],
      lastAppliedSequence: '1',
    });
    expect(system.requests.append).toHaveBeenCalledTimes(1);
  });
  it('clears unknown requests on same-user session replacement', async () => {
    const system = setup();
    await connect(system);
    const held = deferred<{ accepted: boolean; preview: StrokePreview }>();
    system.requests.append.mockImplementationOnce(() => held.promise);
    system.owner.transport.start(system.stroke());
    system.owner.resetSession();
    await connect(system);
    expect(system.state().optimisticStrokes).toEqual([]);
    expect(system.requests.append).toHaveBeenCalledTimes(1);
  });
  it('paces large paginated recovery to at most five sync requests in one second', async () => {
    const system = setup();
    for (let i = 1; i <= 301; i++)
      system.history.push({
        ...system.stroke(),
        clientStrokeId: crypto.randomUUID(),
        canvasKey: key,
        epoch,
        userId: 'u',
        sequence: String(i),
        chunkIndex: 0,
        isFinal: false,
        brush: { type: 'round', size: 12, color: '#123456', opacity: 1, version: 1 },
      });
    await connect(system);
    expect(system.requests.sync).toHaveBeenCalledTimes(5);
    expect(system.state().status).toBe('recovering');
    await vi.advanceTimersByTimeAsync(1001);
    expect(system.state().lastAppliedSequence).toBe('301');
    expect(system.requests.sync).toHaveBeenCalledTimes(7);
  });
});
