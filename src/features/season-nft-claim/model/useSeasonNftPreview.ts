import { useIsMutating, useQuery } from '@tanstack/react-query';
import { sessionMutationKey, useSessionQuery } from '@/entities/session';
import { getSeasonNft } from '../api/season-nft.api';
import { claimQueryKeys } from '../api/season-nft.queries';

/** 종료된 시즌의 NFT 상태를 읽고, 수령 카드와 사용자별 조회 캐시를 공유한다. */
function useSeasonNftStatus(seasonId: string | undefined, enabled: boolean) {
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
  // 비로그인·세션 전환·조회 실패에는 이전 사용자의 캐시를 노출하지 않는다.
  return canRead && !query.isError ? (query.data ?? null) : null;
}

/** 종료된 시즌의 대표 이미지만 돌려준다. */
export function useSeasonNftPreview(seasonId: string | undefined, enabled: boolean) {
  return useSeasonNftStatus(seasonId, enabled)?.imageUrl ?? null;
}

/** 시즌 NFT 발행이 끝나 받을 수 있는 상태인지 돌려준다. */
export function useSeasonNftMinted(seasonId: string | undefined, enabled: boolean) {
  return useSeasonNftStatus(seasonId, enabled)?.availability === 'READY';
}
