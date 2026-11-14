import axios, { isAxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/http-client';
import {
  HistoryRequestError,
  type CanvasHistoryItem,
  type CanvasHistoryPage,
  type ListCanvasHistoryInput,
} from './history.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 이미지 주소는 브라우저가 그대로 불러오므로 http(s) 절대 주소만 허용한다. */
function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

/** 축소 그림 주소는 서버가 아직 만들지 않았으면 null이고, 예전 서버 응답에는 필드가 없다. */
function isOptionalHttpUrl(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isHttpUrl(value);
}

type HistoryItemResponse = Omit<CanvasHistoryItem, 'previewUrl' | 'thumbnailUrl'> & {
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
};

type HistoryPageResponse = Omit<CanvasHistoryPage, 'items'> & { items: HistoryItemResponse[] };

function isHistoryItem(value: unknown): value is HistoryItemResponse {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isHttpUrl(value.imageUrl) &&
    isOptionalHttpUrl(value.previewUrl) &&
    isOptionalHttpUrl(value.thumbnailUrl) &&
    typeof value.width === 'number' &&
    value.width > 0 &&
    typeof value.height === 'number' &&
    value.height > 0 &&
    typeof value.capturedAt === 'string' &&
    Number.isFinite(Date.parse(value.capturedAt)) &&
    typeof value.isFinal === 'boolean'
  );
}

/** 다음 페이지가 있다고 하면서 커서가 없는 응답은 더 보기를 진행할 수 없으므로 거절한다. */
function isHistoryPage(value: unknown): value is HistoryPageResponse {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.every(isHistoryItem) &&
    typeof value.hasNext === 'boolean' &&
    (value.nextCursor === null || typeof value.nextCursor === 'string') &&
    (!value.hasNext || typeof value.nextCursor === 'string')
  );
}

/** Axios 오류를 업무 오류, 전송 오류, 취소로 나눠 화면이 재시도 여부를 고르게 한다. */
function normalizeError(error: unknown): never {
  if (axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) {
    throw new HistoryRequestError('The request was cancelled.', 'aborted');
  }
  if (error instanceof HistoryRequestError) throw error;
  if (!isAxiosError(error)) throw new HistoryRequestError('The request failed.', 'transport');
  const body = error.response?.data;
  if (isRecord(body) && body.success === false && typeof body.message === 'string') {
    throw new HistoryRequestError(
      body.message,
      'business',
      error.response?.status,
      typeof body.code === 'string' ? body.code : undefined
    );
  }
  if (error.response) {
    throw new HistoryRequestError(
      'The server returned an unreadable response.',
      'invalid-response',
      error.response.status
    );
  }
  throw new HistoryRequestError(error.message || 'The network request failed.', 'transport');
}

/** 캔버스 스냅샷을 최신순으로 한 페이지 조회한다. 커서는 이전 응답의 값을 그대로 전달한다. */
export async function listCanvasHistory(
  canvasId: string,
  input: ListCanvasHistoryInput,
  signal?: AbortSignal
): Promise<CanvasHistoryPage> {
  const params = new URLSearchParams({ limit: String(input.limit) });
  if (input.cursor !== undefined) params.set('cursor', input.cursor);
  try {
    const response = await axiosInstance.get(
      `/canvases/${encodeURIComponent(canvasId)}/history?${params.toString()}`,
      { withCredentials: true, signal }
    );
    const body: unknown = response.data;
    if (!isRecord(body) || body.success !== true || !isHistoryPage(body.data)) {
      throw new HistoryRequestError('The server returned an invalid response.', 'invalid-response');
    }
    // 축소 그림이 없는 항목은 null로 맞춰, 화면이 원본으로 넘어갈지 한 가지 값으로 판단하게 한다.
    return {
      ...body.data,
      items: body.data.items.map(item => ({
        ...item,
        previewUrl: item.previewUrl ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
      })),
    };
  } catch (error) {
    return normalizeError(error);
  }
}
