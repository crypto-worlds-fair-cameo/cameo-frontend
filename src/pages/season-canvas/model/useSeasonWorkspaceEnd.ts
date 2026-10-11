import { useRef, useState } from 'react';
import { useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { sessionQueryKey } from '@/entities/session';
import { useEndSeasonMutation } from '../api/seasons.mutations';
import { seasonQueryKeys } from '../api/seasons.queries';
import type { Season } from '../api/seasons.types';
import { getSeasonErrorKey, isAmbiguousWriteError, type SeasonErrorKey } from '../lib/seasonErrors';
import type { useSeasonSessionScope } from './useSeasonSessionScope';

type WorkspaceScope = ReturnType<typeof useSeasonSessionScope>;

/** 최신 개설자 권한을 확인하고 종료 응답을 요청 당시 세션에만 반영한다. */
export function useSeasonWorkspaceEnd(scope: WorkspaceScope, query: UseQueryResult<Season, Error>) {
  const queryClient = useQueryClient();
  const mutation = useEndSeasonMutation(scope.isCurrentScope);
  const [target, setTarget] = useState<{ version: number; season: Season } | null>(null);
  const [errorRecord, setErrorRecord] = useState<{
    version: number;
    key: SeasonErrorKey;
  } | null>(null);
  const [preparingVersion, setPreparingVersion] = useState<number | null>(null);
  const preparationOwnerRef = useRef<symbol | null>(null);
  const requestOwnerRef = useRef<symbol | null>(null);
  const currentTarget = target && target.version === scope.resetVersion ? target.season : null;
  const error = errorRecord && errorRecord.version === scope.resetVersion ? errorRecord.key : null;
  const isPreparing = preparingVersion === scope.resetVersion;

  const open = async () => {
    const token = scope.captureScope();
    if (!scope.session || !token || preparationOwnerRef.current || requestOwnerRef.current) return;
    const owner = Symbol('prepare-workspace-end');
    preparationOwnerRef.current = owner;
    setPreparingVersion(scope.resetVersion);
    setErrorRecord(null);
    const refreshed = await query.refetch();
    if (preparationOwnerRef.current === owner) {
      preparationOwnerRef.current = null;
      setPreparingVersion(null);
    }
    if (!scope.isCurrentScope(token)) return;
    if (!refreshed.data || refreshed.isError) {
      setErrorRecord({
        version: scope.resetVersion,
        key: refreshed.error ? getSeasonErrorKey(refreshed.error) : 'unavailable',
      });
      return;
    }
    if (!refreshed.data.canEnd || refreshed.data.status !== 'active') {
      setErrorRecord({ version: scope.resetVersion, key: 'stateConflict' });
      return;
    }
    setTarget({ version: scope.resetVersion, season: refreshed.data });
  };

  const confirm = async () => {
    const token = scope.captureScope();
    if (
      !scope.session ||
      !token ||
      !currentTarget ||
      requestOwnerRef.current ||
      mutation.isPending ||
      query.isError ||
      !query.data?.canEnd ||
      query.data.id !== currentTarget.id ||
      query.data.status !== 'active'
    )
      return;
    const owner = Symbol('end-workspace-season');
    requestOwnerRef.current = owner;
    setErrorRecord(null);
    try {
      await mutation.mutateAsync({ id: currentTarget.id, scope: token });
      if (scope.isCurrentScope(token)) setTarget(null);
    } catch (error) {
      if (!scope.isCurrentScope(token)) return;
      const key = getSeasonErrorKey(error);
      setErrorRecord({ version: scope.resetVersion, key });
      setTarget(null);
      if (key === 'sessionInvalid' || key === 'userUnavailable') {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
      if (
        key === 'stateConflict' ||
        key === 'ownerRequired' ||
        key === 'notFound' ||
        isAmbiguousWriteError(error)
      ) {
        // 실패 결과가 모호하면 종료 요청을 재전송하지 않고 현재 상태를 조회한다.
        void query.refetch();
        void queryClient.invalidateQueries({ queryKey: seasonQueryKeys.lists(token.sessionKey) });
      }
    } finally {
      if (requestOwnerRef.current === owner) requestOwnerRef.current = null;
    }
  };

  return {
    target: currentTarget,
    error,
    isPreparing,
    isEnding: mutation.isPending,
    open,
    confirm,
    close: () => {
      if (!mutation.isPending && !requestOwnerRef.current) setTarget(null);
    },
  };
}
