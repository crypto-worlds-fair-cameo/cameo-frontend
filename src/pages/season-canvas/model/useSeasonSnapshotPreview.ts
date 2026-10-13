import { useIsMutating } from '@tanstack/react-query';
import { sessionMutationKey, useSessionQuery } from '@/entities/session';
import { useSeasonSnapshotQuery } from '../api/seasons.queries';

/**
 * 시즌 미리보기에 쓸 최신 스냅샷 주소를 돌려준다.
 * 지갑 전용·취소 시즌은 세션마다 볼 수 있는 범위가 달라 세션별로 조회하고, 세션 전환 중·조회 실패에는 이전 이미지를 노출하지 않는다.
 */
export function useSeasonSnapshotPreview(seasonId: string | undefined, enabled: boolean) {
  const sessionQuery = useSessionQuery();
  const changingSession = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  const session = changingSession ? undefined : sessionQuery.data;
  // 로그인 확인이 실패하면 목록처럼 손님으로 조회한다.
  const sessionKey = changingSession
    ? undefined
    : session
      ? session.user.id
      : session === null || sessionQuery.isError
        ? 'guest'
        : undefined;
  const query = useSeasonSnapshotQuery(sessionKey, seasonId, enabled);
  return sessionKey && !query.isError ? (query.data ?? null) : null;
}
