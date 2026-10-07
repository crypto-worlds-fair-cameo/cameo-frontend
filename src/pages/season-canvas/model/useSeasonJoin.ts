import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/entities/session';
import { useJoinSeasonMutation } from '../api/seasons.mutations';
import { seasonQueryKeys } from '../api/seasons.queries';
import { getSeasonErrorKey, type SeasonErrorKey } from '../lib/seasonErrors';
import type { useSeasonSessionScope } from './useSeasonSessionScope';

/** 참가 성공 후 새 소켓을 열고, 미확정 응답은 같은 요청의 명시적 재시도를 허용한다. */
export function useSeasonJoin(
  id: string,
  scope: ReturnType<typeof useSeasonSessionScope>,
  onJoined: () => void
) {
  const mutation = useJoinSeasonMutation(scope.isCurrentScope);
  const queryClient = useQueryClient();
  const requestRef = useRef<object | null>(null);
  const [errorState, setErrorState] = useState<{
    version: number;
    id: string;
    value: SeasonErrorKey;
  } | null>(null);
  const [joiningScope, setJoiningScope] = useState<{ version: number; id: string } | null>(null);
  const error =
    errorState?.version === scope.resetVersion && errorState.id === id ? errorState.value : null;
  const isJoining = joiningScope?.version === scope.resetVersion && joiningScope.id === id;
  useEffect(() => {
    // 계정이나 대상이 바뀌면 이전 요청의 버튼 상태와 안내도 폐기한다.
    requestRef.current = null;
    return () => {
      requestRef.current = null;
    };
  }, [scope.resetVersion, id]);

  async function join() {
    const token = scope.captureScope();
    if (!token || !scope.session || requestRef.current) return;
    const request = {};
    requestRef.current = request;
    setJoiningScope({ version: scope.resetVersion, id });
    setErrorState(null);
    try {
      await mutation.mutateAsync({ id, scope: token });
      // 늦은 이전 계정의 성공은 새 계정 소켓을 재연결하지 않는다.
      if (scope.isCurrentScope(token) && requestRef.current === request) onJoined();
    } catch (cause) {
      if (!scope.isCurrentScope(token) || requestRef.current !== request) return;
      const key = getSeasonErrorKey(cause);
      setErrorState({ version: scope.resetVersion, id, value: key });
      if (key === 'sessionInvalid' || key === 'userUnavailable') {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
      // 정원과 상태는 서버가 판단한다. 실패 뒤에도 최신 상세를 표시한다.
      await queryClient.invalidateQueries({
        queryKey: seasonQueryKeys.detail(token.sessionKey, id),
      });
      await queryClient.invalidateQueries({ queryKey: seasonQueryKeys.lists(token.sessionKey) });
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setJoiningScope(null);
      }
    }
  }
  return { join, error, isJoining };
}
