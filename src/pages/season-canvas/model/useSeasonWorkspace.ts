import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sessionQueryKey } from '@/entities/session';
import {
  useCanvasRealtime,
  type CanvasMode,
  type SeasonReady,
  type SeasonStateEvent,
} from '@/features/canvas-workspace';
import type { BrushSettings } from '@/shared/ui/color-palette/model/brushSettings';
import { useSeasonDetailQuery, seasonQueryKeys } from '../api/seasons.queries';
import { useSeasonSessionScope } from './useSeasonSessionScope';
import { useSeasonJoin } from './useSeasonJoin';

/** HTTP는 참가와 상세를, 소켓 ready는 현재 연결의 입력 권한을 소유한다. */
export function useSeasonWorkspace(id: string, brush: BrushSettings, mode: CanvasMode) {
  const scope = useSeasonSessionScope();
  const query = useSeasonDetailQuery(scope.sessionKey, id, scope.isReady);
  const queryClient = useQueryClient();
  const [readyRecord, setReadyRecord] = useState<{ version: number; value: SeasonReady } | null>(
    null
  );
  const [boundaryRecord, setBoundaryRecord] = useState<{
    version: number;
    value: SeasonStateEvent;
  } | null>(null);
  // 새 세션은 render 시점부터 이전 연결의 권한과 상태를 표시하지 않는다.
  const ready = readyRecord?.version === scope.resetVersion ? readyRecord.value : null;
  const boundary = boundaryRecord?.version === scope.resetVersion ? boundaryRecord.value : null;
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const [unavailableVersion, setUnavailableVersion] = useState<number | null>(null);
  const canvasUnavailable = unavailableVersion === scope.resetVersion;
  const readyRef = useRef(ready);
  const reconnect = () => {
    // 이전 ready로 입력을 열어 두지 않고 새 handshake와 sync를 기다린다.
    setReadyRecord(null);
    readyRef.current = null;
    setReconnectVersion(value => value + 1);
  };
  const refreshDetail = () => {
    if (scope.sessionKey)
      void queryClient.invalidateQueries({
        queryKey: seasonQueryKeys.detail(scope.sessionKey, id),
      });
  };
  const join = useSeasonJoin(id, scope, reconnect);
  const realtime = useCanvasRealtime(brush, mode, {
    canvasKey: `season:${id}`,
    enabled: scope.isReady && !canvasUnavailable,
    sessionVersion: scope.resetVersion,
    reconnectVersion: reconnectVersion + scope.resetVersion,
    allowLiveInput: Boolean(
      scope.isReady &&
      scope.session &&
      !join.isJoining &&
      ready?.viewer.status === 'authenticated' &&
      ready.viewer.userId === scope.session.user.id &&
      ready.season.status === 'active' &&
      (!boundary || boundary.status === 'active') &&
      query.data?.status !== 'ended' &&
      query.data?.status !== 'cancelled'
    ),
    onReady: payload => {
      if (payload.canvasKey === 'main') return;
      readyRef.current = payload;
      setReadyRecord({ version: scope.resetVersion, value: payload });
      setBoundaryRecord(null);
      refreshDetail();
    },
    onSeasonState: event => {
      setBoundaryRecord({ version: scope.resetVersion, value: event });
      refreshDetail();
      // 시작 방송은 개인 권한을 제공하지 않는다. 기존 참가자는 새 ready로 확인한다.
      if (
        event.status === 'active' &&
        readyRef.current?.season.status !== 'active' &&
        readyRef.current?.season.isParticipant
      )
        reconnect();
    },
    onError: code => {
      if (code === 'CANVAS_NOT_FOUND') setUnavailableVersion(scope.resetVersion);
      if (['AUTH_REQUIRED', 'USER_UNAVAILABLE'].includes(code)) {
        void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      }
      if (['SEASON_NOT_ACTIVE', 'SEASON_PARTICIPATION_REQUIRED'].includes(code)) refreshDetail();
    },
  });

  useEffect(() => {
    readyRef.current = null;
  }, [scope.resetVersion, id]);

  useEffect(() => {
    const status = query.data?.status;
    // 첫 상세가 ready보다 늦게 오거나 먼저 와도 최신 조회와 연결 상태를 대조한다.
    // 같은 상태 이벤트를 이미 처리했으면 그 head 복구를 재연결로 중단하지 않는다.
    if (
      !query.isFetching &&
      !query.isError &&
      status &&
      ready &&
      ready.season.status !== status &&
      boundary?.status !== status
    ) {
      // 외부 조회 결과의 반영을 마친 뒤 연결을 교체하며, 그 전에 세션이 바뀌면 취소한다.
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) reconnect();
      });
      return () => {
        cancelled = true;
      };
    }
  }, [query.data?.status, query.dataUpdatedAt, query.isFetching, query.isError, ready, boundary]);

  const season = query.data;
  const status = boundary?.status ?? ready?.season.status ?? season?.status;
  const isParticipant = ready?.season.isParticipant ?? season?.isParticipant ?? false;
  const isOwner = ready?.season.isCreator ?? season?.isCreator ?? false;
  const canDraw = Boolean(
    scope.isReady &&
    scope.session &&
    ready?.viewer.status === 'authenticated' &&
    ready.viewer.userId === scope.session.user.id &&
    status === 'active' &&
    realtime.connection.status === 'ready' &&
    realtime.sync.status === 'ready' &&
    realtime.sync.canDraw
  );
  const canJoin = Boolean(
    scope.isReady &&
    scope.session &&
    status === 'active' &&
    !isParticipant &&
    season &&
    !query.isError &&
    season.participantCount < season.capacity
  );
  return {
    scope,
    query,
    season,
    status,
    ready,
    boundary,
    isParticipant,
    isOwner,
    canDraw,
    canJoin,
    join,
    realtime,
    canvasUnavailable,
  };
}
