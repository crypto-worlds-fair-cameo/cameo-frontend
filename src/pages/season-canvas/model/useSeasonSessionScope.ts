import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import { sessionMutationKey, useSessionQuery } from '@/entities/session';
import { seasonQueryKeys } from '../api/seasons.queries';
import type { SeasonScopeToken } from '../api/seasons.mutations';

/** 세션별 query와 쓰기 응답의 소유권을 관리해 이전 계정의 권한이 남지 않게 한다. */
export function useSeasonSessionScope() {
  const queryClient = useQueryClient();
  const sessionQuery = useSessionQuery();
  const isChangingSession = useIsMutating({ mutationKey: sessionMutationKey }) > 0;
  const session = sessionQuery.data;
  const sessionKey =
    !isChangingSession && sessionQuery.isSuccess && session !== undefined
      ? session === null
        ? 'guest'
        : JSON.stringify([session.user.id, session.session.absoluteExpiresAt])
      : undefined;
  const stateRef = useRef({ sessionKey, epoch: 0, mounted: true });
  const previousStableKeyRef = useRef<string | undefined>(undefined);
  const wasChangingRef = useRef(false);
  const [resetVersion, setResetVersion] = useState(0);

  useLayoutEffect(() => {
    stateRef.current.sessionKey = sessionKey;
  }, [sessionKey]);

  useEffect(() => {
    const startedChanging = isChangingSession && !wasChangingRef.current;
    const finishedChanging = !isChangingSession && wasChangingRef.current;
    wasChangingRef.current = isChangingSession;

    if (startedChanging) {
      // 세션 mutation 시작 즉시 조회를 취소하고 기존 화면 권한과 입력을 폐기한다.
      stateRef.current.epoch += 1;
      setResetVersion(version => version + 1);
      void queryClient.cancelQueries({ queryKey: seasonQueryKeys.root });
    }

    if (sessionKey !== undefined && previousStableKeyRef.current !== sessionKey) {
      const previousKey = previousStableKeyRef.current;
      stateRef.current.epoch += 1;
      setResetVersion(version => version + 1);
      if (previousKey !== undefined) {
        void queryClient.cancelQueries({ queryKey: seasonQueryKeys.session(previousKey) });
        queryClient.removeQueries({ queryKey: seasonQueryKeys.session(previousKey) });
      }
      previousStableKeyRef.current = sessionKey;
    }

    if (finishedChanging && sessionKey !== undefined) {
      // 같은 사용자로 재로그인해 key가 같아도 새 쿠키 기준 데이터를 다시 확인한다.
      void queryClient.invalidateQueries({ queryKey: seasonQueryKeys.session(sessionKey) });
    }
  }, [isChangingSession, queryClient, sessionKey]);

  useEffect(() => {
    const scopeState = stateRef.current;
    scopeState.mounted = true;
    return () => {
      scopeState.mounted = false;
      scopeState.epoch += 1;
      void queryClient.cancelQueries({ queryKey: seasonQueryKeys.root });
    };
  }, [queryClient]);

  const captureScope = useCallback((): SeasonScopeToken | null => {
    const current = stateRef.current;
    if (!current.mounted || current.sessionKey === undefined) return null;
    return { sessionKey: current.sessionKey, epoch: current.epoch };
  }, []);

  const isCurrentScope = useCallback((scope: SeasonScopeToken) => {
    const current = stateRef.current;
    return (
      current.mounted && current.sessionKey === scope.sessionKey && current.epoch === scope.epoch
    );
  }, []);

  return {
    session,
    sessionKey,
    sessionQuery,
    isChangingSession,
    isReady: sessionKey !== undefined,
    resetVersion,
    captureScope,
    isCurrentScope,
  };
}
