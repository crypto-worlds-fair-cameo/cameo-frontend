import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasPreviewImage } from './useCanvasPreviewImage';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/shared/api/http-client', () => ({ axiosInstance: { get } }));

const canvasId = '0414f7c0-e937-4efb-a058-7b5bf11f75b8';
const storageKey = `cameo.canvas-preview-image.${canvasId}`;
const base = `https://api.example.com/canvas-assets/snapshots/main/${canvasId}`;
const olderUrl = `${base}/2cfcf6ee-1a0c-494b-8059-1f1ba7d55dda/preview.webp`;
const newerUrl = `${base}/aaef427e-05b7-4608-8831-deb50978048d/preview.webp`;

function history(items: unknown[]) {
  return { data: { success: true, data: { items, nextCursor: null, hasNext: false } } };
}

function renderPreview(id: string | undefined, enabled = true) {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCanvasPreviewImage(id, enabled), { wrapper });
}

beforeEach(() => {
  get.mockReset();
  window.localStorage.clear();
});

describe('canvas preview image', () => {
  it('reads the medium image of the latest snapshot and remembers it for the next visit', async () => {
    get.mockResolvedValue(history([{ imageUrl: `${base}/x/image.png`, previewUrl: newerUrl }]));
    const { result } = renderPreview(canvasId);
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).toBe(newerUrl));
    expect(get.mock.calls[0][0]).toBe(`/canvases/${canvasId}/history?limit=1`);
    expect(window.localStorage.getItem(storageKey)).toBe(newerUrl);
  });

  it('shows the image from the last visit first and then switches to the newer one', async () => {
    window.localStorage.setItem(storageKey, olderUrl);
    let respond: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise(resolve => (respond = resolve)));
    const { result } = renderPreview(canvasId);
    expect(result.current).toBe(olderUrl);
    respond(history([{ previewUrl: newerUrl }]));
    await waitFor(() => expect(result.current).toBe(newerUrl));
  });

  it('keeps the image from the last visit when the lookup fails', async () => {
    window.localStorage.setItem(storageKey, olderUrl);
    get.mockRejectedValue(new Error('offline'));
    const { result } = renderPreview(canvasId);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current).toBe(olderUrl);
    expect(window.localStorage.getItem(storageKey)).toBe(olderUrl);
  });

  it('shows nothing when the server has no medium image yet', async () => {
    window.localStorage.setItem(storageKey, olderUrl);
    // 원본만 있는 스냅샷은 크기가 커서 대신 쓰지 않는다.
    get.mockResolvedValue(history([{ imageUrl: `${base}/x/image.png`, previewUrl: null }]));
    const { result } = renderPreview(canvasId);
    await waitFor(() => expect(result.current).toBeNull());
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it.each([
    ['a script address', 'javascript:alert(1)'],
    ['an address with credentials', newerUrl.replace('https://', 'https://user:pw@')],
    ['a file that is not the medium image', newerUrl.replace('preview.webp', 'image.png')],
  ])('ignores %s from the server and from storage', async (_label, unsafeUrl) => {
    window.localStorage.setItem(storageKey, unsafeUrl);
    get.mockResolvedValue(history([{ previewUrl: unsafeUrl }]));
    const { result } = renderPreview(canvasId);
    expect(result.current).toBeNull();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it('does not ask the server while disabled or without a valid canvas id', () => {
    window.localStorage.setItem(storageKey, olderUrl);
    expect(renderPreview(canvasId, false).result.current).toBeNull();
    expect(renderPreview(undefined).result.current).toBeNull();
    expect(renderPreview('not-a-canvas-id').result.current).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
