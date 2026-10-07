import { describe, expect, it, vi } from 'vitest';
import { appendStroke, syncCanvas } from './canvasRequests';
import type { CanvasSocket } from './canvasSocket';
import type { AppendStrokeInput } from './canvasProtocol';

const input: AppendStrokeInput = {
  clientStrokeId: '11111111-1111-4111-8111-111111111111',
  chunkIndex: 0,
  brush: { type: 'round', size: 12, color: '#ED4242', opacity: 1, version: 1 },
  points: [{ x: 100, y: 200 }],
  isFinal: true,
};

function socket(response: unknown) {
  const emitWithAck = vi.fn().mockResolvedValue(response);
  const timeout = vi.fn(() => ({ emitWithAck }));
  return { value: { connected: true, timeout } as unknown as CanvasSocket, emitWithAck, timeout };
}

describe('canvas acknowledgement boundary', () => {
  it('requires a connected transport and a five-second ACK', async () => {
    const preview = {
      ...input,
      canvasKey: 'main',
      userId: 'user',
      epoch: '00000000-0000-4000-8000-000000000001',
      sequence: '1',
    };
    const transport = socket({ ok: true, data: { accepted: true, preview } });
    expect(await appendStroke(transport.value, input)).toEqual({ accepted: true, preview });
    expect(transport.timeout).toHaveBeenCalledWith(5000);
    transport.value.connected = false;
    await expect(appendStroke(transport.value, input)).rejects.toMatchObject({
      code: 'DISCONNECTED',
    });
    expect(transport.emitWithAck).toHaveBeenCalledOnce();
  });

  it('preserves server refusal codes while identifying acknowledgement timeouts separately', async () => {
    const transport = socket({
      ok: false,
      error: { code: 'CANVAS_CAPACITY_REACHED', message: 'full' },
    });
    await expect(appendStroke(transport.value, input)).rejects.toMatchObject({
      code: 'CANVAS_CAPACITY_REACHED',
    });
    transport.emitWithAck.mockRejectedValueOnce(new Error('operation has timed out'));
    await expect(appendStroke(transport.value, input)).rejects.toMatchObject({
      code: 'ACK_TIMEOUT',
    });
  });

  it('rejects unsupported or malformed render data before it reaches the canvas', async () => {
    const transport = socket({
      ok: true,
      data: { accepted: true, preview: { ...input, brush: { ...input.brush, version: 2 } } },
    });
    await expect(appendStroke(transport.value, input)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
    transport.emitWithAck.mockResolvedValue({
      ok: true,
      data: {
        canvasKey: 'main',
        epoch: '00000000-0000-4000-8000-000000000001',
        reset: false,
        previews: [],
        headSequence: '5',
        nextSequence: '6',
        hasMore: false,
      },
    });
    await expect(syncCanvas(transport.value, { afterSequence: '0' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
