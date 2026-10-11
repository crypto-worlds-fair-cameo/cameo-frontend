import { useQuery } from '@tanstack/react-query';
import { getClaimAttempt, getSeasonNft } from './season-nft.api';
import {
  isSessionInvalidError,
  type ClaimAttemptState,
  type SeasonNftNetwork,
} from './season-nft.types';

export const claimQueryKeys = {
  root: ['season-nft'] as const,
  user: (userId: string) => ['season-nft', userId] as const,
  status: (userId: string, seasonId: string) => ['season-nft', userId, seasonId, 'status'] as const,
  attempt: (userId: string, network: SeasonNftNetwork, seasonId: string, attemptId: string) =>
    ['season-nft', userId, network, seasonId, 'attempt', attemptId] as const,
};

function isVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

/** 사용자·시즌별 NFT 상태를 보이는 탭에서 30초마다 갱신한다. */
export function useSeasonNftStatusQuery(userId: string, seasonId: string, enabled: boolean) {
  return useQuery({
    queryKey: claimQueryKeys.status(userId, seasonId),
    queryFn: ({ signal }) => getSeasonNft(seasonId, signal),
    enabled,
    retry: (failureCount, error) => !isSessionInvalidError(error) && failureCount < 2,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: () => (isVisible() ? 30_000 : false),
  });
}

const terminalAttemptStates: ClaimAttemptState[] = ['SUCCEEDED', 'FAILED', 'EXPIRED'];

/** 활성 시도는 3초마다 읽고, 조회 실패 뒤에는 15초 간격으로 완화한다. */
export function useClaimAttemptQuery(
  userId: string,
  network: SeasonNftNetwork,
  seasonId: string,
  attemptId: string,
  enabled: boolean
) {
  return useQuery({
    queryKey: claimQueryKeys.attempt(userId, network, seasonId, attemptId),
    queryFn: ({ signal }) => getClaimAttempt(seasonId, attemptId, signal),
    enabled,
    retry: (failureCount, error) => !isSessionInvalidError(error) && failureCount < 2,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: query => {
      if (!isVisible()) return false;
      const state = query.state.data?.state;
      if (state && terminalAttemptStates.includes(state)) return false;
      return query.state.fetchFailureCount > 0 ? 15_000 : 3_000;
    },
  });
}
