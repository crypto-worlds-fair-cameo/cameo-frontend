import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listCanvasHistory } from './history.api';
import { HistoryRequestError, type CanvasHistoryItem } from './history.types';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/shared/api/http-client', () => ({ axiosInstance: { get } }));

const canvasId = '0414f7c0-e937-4efb-a058-7b5bf11f75b8';
const item: CanvasHistoryItem = {
  id: '2f1c8f0e-3c47-4c8f-9a4e-6f8f7b0c1d2e',
  imageUrl: `https://api.cameoprint.com/canvas-assets/snapshots/main/${canvasId}/2f1c8f0e-3c47-4c8f-9a4e-6f8f7b0c1d2e/image.png`,
  width: 2000,
  height: 2000,
  capturedAt: '2026-10-09T09:00:00.000Z',
  isFinal: false,
};

function envelope(data: unknown) {
  return { data: { statusCode: 200, success: true, data } };
}

beforeEach(() => {
  get.mockReset();
});

describe('canvas history API contract', () => {
  it('requests the first page without a cursor and forwards credentials and AbortSignal', async () => {
    get.mockResolvedValue(envelope({ items: [item], nextCursor: null, hasNext: false }));
    const controller = new AbortController();
    const page = await listCanvasHistory(canvasId, { limit: 20 }, controller.signal);
    expect(page.items).toEqual([item]);
    const [path, options] = get.mock.calls[0];
    expect(path).toBe(`/canvases/${canvasId}/history?limit=20`);
    expect(options).toMatchObject({ withCredentials: true, signal: controller.signal });
  });

  it('passes the previous nextCursor unchanged', async () => {
    get.mockResolvedValue(envelope({ items: [], nextCursor: null, hasNext: false }));
    await listCanvasHistory(canvasId, { limit: 20, cursor: 'eyJ2IjoxfQ' });
    expect(get.mock.calls[0][0]).toBe(`/canvases/${canvasId}/history?limit=20&cursor=eyJ2IjoxfQ`);
  });

  it.each([
    ['a missing envelope', { items: [], nextCursor: null, hasNext: false }],
    [
      'hasNext without a cursor',
      { success: true, data: { items: [], nextCursor: null, hasNext: true } },
    ],
    [
      'a non-http image URL',
      {
        success: true,
        data: {
          items: [{ ...item, imageUrl: 'javascript:alert(1)' }],
          nextCursor: null,
          hasNext: false,
        },
      },
    ],
    [
      'an unreadable capture time',
      {
        success: true,
        data: { items: [{ ...item, capturedAt: 'later' }], nextCursor: null, hasNext: false },
      },
    ],
  ])('rejects %s', async (_label, data) => {
    get.mockResolvedValue({ data });
    await expect(listCanvasHistory(canvasId, { limit: 20 })).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('keeps the server error code for business failures', async () => {
    const response = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: { success: false, message: 'Canvas not found.', code: 'CANVAS_NOT_FOUND' },
    };
    get.mockRejectedValue(
      new AxiosError('Not Found', 'ERR_BAD_REQUEST', response.config, null, response)
    );
    const error = await listCanvasHistory(canvasId, { limit: 20 }).catch(value => value);
    expect(error).toBeInstanceOf(HistoryRequestError);
    expect(error).toMatchObject({ kind: 'business', statusCode: 404, code: 'CANVAS_NOT_FOUND' });
  });
});
