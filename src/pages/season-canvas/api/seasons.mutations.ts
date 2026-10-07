import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelSeason, createSeason, endSeason, joinSeason } from './seasons.api';
import { seasonQueryKeys } from './seasons.queries';
import type { CreateSeasonInput, Season } from './seasons.types';

export interface SeasonScopeToken {
  sessionKey: string;
  epoch: number;
}

interface ScopedCreateVariables {
  input: CreateSeasonInput;
  scope: SeasonScopeToken;
}

interface ScopedManageVariables {
  id: string;
  scope: SeasonScopeToken;
}

/** 응답이 아직 같은 세션에 속할 때만 상세 cache와 목록을 갱신한다. */
function useScopedSeasonMutation<TVariables extends { scope: SeasonScopeToken }>(
  mutationFn: (variables: TVariables) => Promise<Season>,
  isCurrentScope: (scope: SeasonScopeToken) => boolean
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: async (season, variables) => {
      // 계정 전환이나 unmount 뒤 도착한 응답은 현재 화면 cache를 바꾸지 않는다.
      if (!isCurrentScope(variables.scope)) return;
      const detailKey = seasonQueryKeys.detail(variables.scope.sessionKey, season.id);
      // 변경 전 시작된 상세 GET이 mutation 응답을 덮지 않도록 먼저 취소한다.
      await queryClient.cancelQueries({ queryKey: detailKey });
      if (!isCurrentScope(variables.scope)) return;
      queryClient.setQueryData(detailKey, season);
      await queryClient.invalidateQueries({
        queryKey: seasonQueryKeys.lists(variables.scope.sessionKey),
      });
    },
  });
}

export function useCreateSeasonMutation(isCurrentScope: (scope: SeasonScopeToken) => boolean) {
  return useScopedSeasonMutation<ScopedCreateVariables>(
    ({ input }) => createSeason(input),
    isCurrentScope
  );
}

export function useCancelSeasonMutation(isCurrentScope: (scope: SeasonScopeToken) => boolean) {
  return useScopedSeasonMutation<ScopedManageVariables>(
    ({ id }) => cancelSeason(id),
    isCurrentScope
  );
}

export function useEndSeasonMutation(isCurrentScope: (scope: SeasonScopeToken) => boolean) {
  return useScopedSeasonMutation<ScopedManageVariables>(({ id }) => endSeason(id), isCurrentScope);
}

export function useJoinSeasonMutation(isCurrentScope: (scope: SeasonScopeToken) => boolean) {
  return useScopedSeasonMutation<ScopedManageVariables>(({ id }) => joinSeason(id), isCurrentScope);
}
