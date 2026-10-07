import { describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';
import { isStrokePreview } from './canvasProtocol';
import { createCanvasSocket, isCanvasReady, isCanvasReset, isSeasonState } from './canvasSocket';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
const key = 'season:11111111-1111-4111-8111-111111111111' as const;
const season = {
  width: 800,
  height: 600,
  strokeLimitPerUser: null,
  startsAt: '2026-10-07T00:00:00Z',
  endsAt: '2026-10-08T00:00:00Z',
  cancelledAt: null,
  forceEndedAt: null,
  status: 'active',
  isParticipant: true,
  isCreator: false,
};

describe('season canvas wire contract', () => {
  it('selects the season in handshake without changing the main handshake', () => {
    createCanvasSocket(key);
    expect(io).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/canvas$/),
      expect.objectContaining({
        auth: { canvasKey: key },
        withCredentials: true,
        reconnection: false,
      })
    );
  });
  it('accepts a season ready without inventing an epoch or head', () => {
    const ready = {
      protocolVersion: 1,
      canvasKey: key,
      presence: { connectionCount: 2 },
      viewer: { status: 'authenticated', userId: 'u' },
      canDraw: true,
      season,
      serverTime: season.startsAt,
    };
    expect(isCanvasReady(ready, key)).toBe(true);
    expect(isCanvasReady(ready, 'main')).toBe(false);
    expect(isCanvasReady({ ...ready, season: { ...season, width: NaN } }, key)).toBe(false);
  });
  it('validates source coordinates against the selected season, including exclusive edges', () => {
    const preview = {
      canvasKey: key,
      epoch: '00000000-0000-4000-8000-000000000001',
      sequence: '9007199254740993',
      userId: 'u',
      clientStrokeId: key.slice(7),
      chunkIndex: 0,
      isFinal: false,
      points: [{ x: 799, y: 599 }],
      brush: { type: 'round', size: 12, color: '#123456', opacity: 1, version: 1 },
    };
    expect(isStrokePreview(preview, { canvasKey: key, width: 800, height: 600 })).toBe(true);
    expect(
      isStrokePreview(
        { ...preview, points: [{ x: 800, y: 599 }] },
        { canvasKey: key, width: 800, height: 600 }
      )
    ).toBe(false);
    expect(isStrokePreview(preview)).toBe(false);
  });
  it('recognizes state boundaries and all retry policies', () => {
    expect(
      isSeasonState(
        {
          ...season,
          canvasKey: key,
          serverTime: season.endsAt,
          epoch: '00000000-0000-4000-8000-000000000001',
          headSequence: '9007199254740993',
        },
        key
      )
    ).toBe(true);
    expect(isCanvasReset({ reason: 'canvas_unavailable', retryable: false, retryAfterMs: 0 })).toBe(
      true
    );
    expect(
      isCanvasReset({ reason: 'realtime_unavailable', retryable: true, retryAfterMs: 1000 })
    ).toBe(true);
  });
});
