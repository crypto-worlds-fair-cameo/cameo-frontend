import { useIsMutating, useQuery } from '@tanstack/react-query';
import { sessionMutationKey, useSessionQuery } from '@/entities/session';
import { getSeasonNft } from '../api/season-nft.api';
import { claimQueryKeys } from '../api/season-nft.queries';

/** 종료된 시즌의 대표 이미지만 읽고, 수령 카드와 사용자별 조회 캐시를 공유한다. */
export function useSeasonNftPreview(seasonId: string | undefined, enabled: boolean) {
  const sessionQuery = useSessionQuery();
  const changingSession = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  const session = changingSession ? undefined : sessionQuery.data;
  const canRead = Boolean(enabled && seasonId && session);
  const query = useQuery({
    queryKey: claimQueryKeys.status(session?.user.id ?? 'signed-out', seasonId ?? 'none'),
    queryFn: ({ signal }) => getSeasonNft(seasonId!, signal),
    enabled: canRead,
    staleTime: 30_000,
    retry: false,
    // 목록의 이미지마다 상태 폴링을 추가하지 않는다. 수령 카드가 있으면 기존 폴링을 공유한다.
    refetchInterval: false,
  });
  // 비로그인·세션 전환·조회 실패에는 이전 사용자의 캐시를 대표 이미지로 노출하지 않는다.
  return canRead && !query.isError ? (query.data?.imageUrl ?? null) : null;
}
