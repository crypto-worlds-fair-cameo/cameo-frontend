import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/entities/session';
import {
  useCancelSeasonMutation,
  useEndSeasonMutation,
  type SeasonScopeToken,
} from '../api/seasons.mutations';
import { seasonQueryKeys, useSeasonDetailQuery } from '../api/seasons.queries';
import { getSeasonErrorKey, isAmbiguousWriteError, type SeasonErrorKey } from '../lib/seasonErrors';

const MAX_TIMER_DELAY = 24 * 60 * 60 * 1000;
export type SeasonManageAction = 'cancel' | 'end';

interface SeasonDetailScope {
  sessionKey: string | undefined;
  isReady: boolean;
  resetVersion: number;
  captureScope: () => SeasonScopeToken | null;
  isCurrentScope: (scope: SeasonScopeToken) => boolean;
}

/** 상세 선택, 시간 경계 갱신과 최신 권한 기반 관리 동작을 연결한다. */
export function useSeasonDetail(scope: SeasonDetailScope) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manageTarget, setManageTarget] = useState<{
    id: string;
    action: SeasonManageAction;
  } | null>(null);
  const [manageError, setManageError] = useState<SeasonErrorKey | null>(null);
  const [isRefreshingManagement, setIsRefreshingManagement] = useState(false);
  const selectedIdRef = useRef<string | null>(null);
  const manageRequestOwnerRef = useRef<symbol | null>(null);
  const managePreparationOwnerRef = useRef<symbol | null>(null);
  const detailQuery = useSeasonDetailQuery(scope.sessionKey, selectedId, scope.isReady);
  const cancelMutation = useCancelSeasonMutation(scope.isCurrentScope);
  const endMutation = useEndSeasonMutation(scope.isCurrentScope);
  const isManaging = cancelMutation.isPending || endMutation.isPending;

  useEffect(() => {
    let active = true;
    // 세션 경계가 바뀐 commit 뒤 선택과 이전 관리 권한을 함께 폐기한다.
    queueMicrotask(() => {
      if (!active) return;
      setSelectedId(null);
      selectedIdRef.current = null;
      managePreparationOwnerRef.current = null;
      manageRequestOwnerRef.current = null;
      setIsRefreshingManagement(false);
      setManageTarget(null);
      setManageError(null);
    });
    return () => {
      active = false;
    };
  }, [scope.resetVersion]);

  useEffect(() => {
    const season = detailQuery.data;
    if (!season || !selectedId || !scope.sessionKey) return;
    const now = Date.now();
    const candidate =
      season.status === 'scheduled'
        ? season.startsAt
        : season.status === 'active'
          ? season.endsAt
          : null;
    if (!candidate) return;
    const boundary = new Date(candidate).getTime();
    // 이미 지난 경계는 정기 조회에 맡겨 같은 stale 응답의 즉시 재조회 반복을 피한다.
    if (!Number.isFinite(boundary) || boundary <= now) return;
    let timer: number | undefined;
    let disposed = false;
    const schedule = () => {
      const remaining = boundary - Date.now() + 50;
      timer = window.setTimeout(
        () => {
          if (disposed) return;
          // 24시간보다 먼 경계는 같은 timer가 남은 시간을 다시 계산해 이어서 기다린다.
          if (boundary > Date.now()) {
            schedule();
            return;
          }
          void queryClient.invalidateQueries({
            queryKey: seasonQueryKeys.detail(scope.sessionKey!, selectedId),
          });
          void queryClient.invalidateQueries({
            queryKey: seasonQueryKeys.lists(scope.sessionKey!),
          });
        },
        Math.min(Math.max(remaining, 0), MAX_TIMER_DELAY)
      );
    };
    schedule();
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [detailQuery.data, queryClient, scope.sessionKey, selectedId]);

  const openDetail = (id: string) => {
    selectedIdRef.current = id;
    setSelectedId(id);
    setManageTarget(null);
    setManageError(null);
  };
  const closeDetail = () => {
    if (!isManaging && !manageRequestOwnerRef.current && !managePreparationOwnerRef.current) {
      selectedIdRef.current = null;
      setSelectedId(null);
      setManageTarget(null);
      setManageError(null);
    }
  };

  const openManage = async (action: SeasonManageAction) => {
    const targetId = selectedIdRef.current;
    const token = scope.captureScope();
    if (!targetId || !token || managePreparationOwnerRef.current || isRefreshingManagement) return;
    const preparationOwner = Symbol('prepare-season-management');
    managePreparationOwnerRef.current = preparationOwner;
    setManageError(null);
    setIsRefreshingManagement(true);
    const refreshed = await detailQuery.refetch();
    if (managePreparationOwnerRef.current === preparationOwner) {
      managePreparationOwnerRef.current = null;
      setIsRefreshingManagement(false);
    }
    // 다른 상세이나 세션으로 이동한 동안 완료된 GET은 확인창을 열 수 없다.
    if (selectedIdRef.current !== targetId || !scope.isCurrentScope(token)) return;
    const season = refreshed.data;
    // 최신 상세가 없거나 권한이 사라졌으면 확인창을 열지 않는다.
    if (!season || refreshed.isError) {
      setManageError(refreshed.error ? getSeasonErrorKey(refreshed.error) : 'unavailable');
      return;
    }
    if ((action === 'cancel' && !season.canCancel) || (action === 'end' && !season.canEnd)) {
      setManageError('stateConflict');
      return;
    }
    setManageTarget({ id: targetId, action });
  };

  const confirmManage = async () => {
    if (!manageTarget || manageRequestOwnerRef.current || isManaging) return;
    const token = scope.captureScope();
    if (!token || selectedIdRef.current !== manageTarget.id) return;
    const requestOwner = Symbol('manage-season');
    manageRequestOwnerRef.current = requestOwner;
    setManageError(null);
    const mutation = manageTarget.action === 'cancel' ? cancelMutation : endMutation;
    try {
      await mutation.mutateAsync({ id: manageTarget.id, scope: token });
      if (!scope.isCurrentScope(token)) return;
      setManageTarget(null);
    } catch (error) {
      if (!scope.isCurrentScope(token)) return;
      const key = getSeasonErrorKey(error);
      setManageError(key);
      setManageTarget(null);
      if (key === 'sessionInvalid' || key === 'userUnavailable') {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
      if (
        key === 'stateConflict' ||
        key === 'ownerRequired' ||
        key === 'notFound' ||
        isAmbiguousWriteError(error)
      ) {
        // 결과 불명확 또는 상태 충돌은 재전송하지 않고 상세와 목록으로 실제 상태를 확인한다.
        void detailQuery.refetch();
        void queryClient.invalidateQueries({ queryKey: seasonQueryKeys.lists(token.sessionKey) });
      }
    } finally {
      if (manageRequestOwnerRef.current === requestOwner) manageRequestOwnerRef.current = null;
    }
  };

  return {
    selectedId,
    detailQuery,
    manageAction: manageTarget?.action ?? null,
    manageError,
    isManaging,
    isRefreshingManagement,
    openDetail,
    closeDetail,
    openManage,
    closeManage: () => {
      if (!isManaging && !manageRequestOwnerRef.current && !managePreparationOwnerRef.current)
        setManageTarget(null);
    },
    confirmManage,
  };
}
