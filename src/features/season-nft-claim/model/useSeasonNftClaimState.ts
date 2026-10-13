import { useIsMutating } from '@tanstack/react-query';
import { sessionMutationKey, useSessionQuery } from '@/entities/session';
import { useSeasonNftStatusQuery } from '../api/season-nft.queries';

export type SeasonNftClaimState = 'claimable' | 'processing' | 'claimed';

/**
 * 로그인한 사용자가 이 시즌 NFT를 지금 받을 수 있는지 요약한다. 수령 카드와 같은 상태 캐시를 쓴다.
 * 비로그인·세션 전환·조회 실패에는 이전 사용자의 상태로 버튼을 띄우지 않도록 null을 돌려준다.
 */
export function useSeasonNftClaimState(
  seasonId: string | undefined,
  enabled: boolean
): SeasonNftClaimState | null {
  const sessionQuery = useSessionQuery();
  const changingSession = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  const session = changingSession ? undefined : sessionQuery.data;
  const canRead = Boolean(enabled && seasonId && session);
  const query = useSeasonNftStatusQuery(
    session?.user.id ?? 'signed-out',
    seasonId ?? 'none',
    canRead
  );
  if (!canRead || query.isError || !query.data) return null;
  const { availability, claim } = query.data;
  if (claim.state === 'CLAIMED') return 'claimed';
  if (claim.state === 'PROCESSING') return 'processing';
  return availability === 'READY' && claim.eligibility === 'ELIGIBLE' ? 'claimable' : null;
}
