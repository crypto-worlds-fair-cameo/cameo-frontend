import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCanvasPreviewImageUrl, isCanvasPreviewImageUrl } from '../api/canvasPreviewImage.api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_PREFIX = 'cameo.canvas-preview-image.';

/** 지난 방문에서 본 중간 그림 주소를 읽는다. 저장소를 쓸 수 없거나 값이 주소 형식이 아니면 null이다. */
function readRemembered(canvasId: string): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_PREFIX + canvasId);
    return isCanvasPreviewImageUrl(value) ? value : null;
  } catch {
    return null;
  }
}

function remember(canvasId: string, url: string | null) {
  try {
    if (url) window.localStorage.setItem(STORAGE_PREFIX + canvasId, url);
    else window.localStorage.removeItem(STORAGE_PREFIX + canvasId);
  } catch {
    // 사생활 보호 모드처럼 저장소를 쓸 수 없으면 다음 방문에 다시 조회하면 된다.
  }
}

/**
 * 공유 그림을 다 받기 전에 도화지 위에 먼저 보여 줄 중간 크기 그림 주소를 돌려준다.
 *
 * 그리기 엔진의 복구(스냅샷 원본 + 이후 획)와는 별개의 HTTP 조회라서 획 순서에 영향을 주지 않고,
 * 스냅샷 복구를 쓰지 않는 휴대폰에서도 동작한다. 조회가 끝나기 전에는 지난 방문에서 본 그림을 먼저 돌려준다.
 * 그 그림은 브라우저에 저장돼 있어 바로 뜨고, 메인 캔버스는 획이 쌓이기만 하므로 최신 그림의 일부다.
 */
export function useCanvasPreviewImage(canvasId: string | undefined, enabled: boolean) {
  const id = canvasId !== undefined && UUID_PATTERN.test(canvasId) ? canvasId.toLowerCase() : null;
  const remembered = useMemo(() => (id ? readRemembered(id) : null), [id]);
  const query = useQuery({
    queryKey: ['canvas-workspace', 'preview-image', id ?? 'none'],
    queryFn: async ({ signal }) => {
      const url = await getCanvasPreviewImageUrl(id!, signal);
      remember(id!, url);
      return url;
    },
    enabled: enabled && id !== null,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  if (!enabled || id === null) return null;
  // 서버가 그림이 없다고 답하면(null) 지난 그림도 쓰지 않는다. 조회 중·조회 실패에는 지난 그림을 쓴다.
  return query.data !== undefined ? query.data : remembered;
}
