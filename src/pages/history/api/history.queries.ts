import { useInfiniteQuery } from '@tanstack/react-query';
import { listCanvasHistory } from './history.api';

export const HISTORY_PAGE_SIZE = 20;

export const historyQueryKeys = {
  root: ['history'] as const,
  canvas: (canvasId: string) => ['history', canvasId] as const,
};

/**
 * 캔버스 스냅샷을 커서 기반으로 이어서 조회한다.
 * 스냅샷은 한 시간 단위로 늘어나므로 창 포커스마다 전체 페이지를 다시 받지 않는다.
 */
export function useCanvasHistoryQuery(canvasId: string | null) {
  return useInfiniteQuery({
    queryKey: historyQueryKeys.canvas(canvasId ?? 'none'),
    queryFn: ({ pageParam, signal }) =>
      listCanvasHistory(canvasId!, { limit: HISTORY_PAGE_SIZE, cursor: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: lastPage =>
      lastPage.hasNext && lastPage.nextCursor !== null ? lastPage.nextCursor : undefined,
    enabled: canvasId !== null,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}
