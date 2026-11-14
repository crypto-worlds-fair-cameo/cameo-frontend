import { axiosInstance } from '@/shared/api/http-client';

const PREVIEW_PATH_PATTERN =
  /\/snapshots\/(?:main|seasons)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/preview\.webp$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 이미지 태그에 넣을 주소는 자격 증명 없는 절대 HTTP(S)의 스냅샷 중간 그림만 허용한다. */
export function isCanvasPreviewImageUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      PREVIEW_PATH_PATTERN.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/**
 * 캔버스의 가장 최근 스냅샷에서 첫 화면용 중간 크기 그림 주소를 조회한다.
 * 스냅샷이 없거나 서버가 아직 중간 그림을 만들지 않았으면 null이다. 원본은 크기가 커서 대신 쓰지 않는다.
 */
export async function getCanvasPreviewImageUrl(
  canvasId: string,
  signal?: AbortSignal
): Promise<string | null> {
  const response = await axiosInstance.get(
    `/canvases/${encodeURIComponent(canvasId)}/history?limit=1`,
    { withCredentials: true, signal }
  );
  const body: unknown = response.data;
  if (!isRecord(body) || body.success !== true || !isRecord(body.data)) return null;
  const { items } = body.data;
  const latest: unknown = Array.isArray(items) ? items[0] : undefined;
  if (!isRecord(latest) || !isCanvasPreviewImageUrl(latest.previewUrl)) return null;
  return latest.previewUrl;
}
