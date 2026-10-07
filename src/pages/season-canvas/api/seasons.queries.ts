import { useQuery } from '@tanstack/react-query';
import { getSeason, listSeasons } from './seasons.api';
import type { ListSeasonsInput } from './seasons.types';

export const seasonQueryKeys = {
  root: ['season-canvas'] as const,
  session: (sessionKey: string) => ['season-canvas', sessionKey] as const,
  lists: (sessionKey: string) => ['season-canvas', sessionKey, 'list'] as const,
  list: (sessionKey: string, input: ListSeasonsInput) =>
    ['season-canvas', sessionKey, 'list', input.status ?? 'all', input.page, input.limit] as const,
  detail: (sessionKey: string, id: string) => ['season-canvas', sessionKey, 'detail', id] as const,
};

/** 현재 세션에 귀속된 목록만 조회하고 보이는 탭에서 30초마다 갱신한다. */
export function useSeasonsQuery(
  sessionKey: string | undefined,
  input: ListSeasonsInput,
  enabled: boolean
) {
  return useQuery({
    queryKey: seasonQueryKeys.list(sessionKey ?? 'pending', input),
    queryFn: ({ signal }) => listSeasons(input, signal),
    enabled: enabled && sessionKey !== undefined,
    retry: false,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible' ? 30_000 : false,
  });
}

/** 열린 상세의 최신 권한과 상태를 조회하고 보이는 탭에서만 주기적으로 갱신한다. */
export function useSeasonDetailQuery(
  sessionKey: string | undefined,
  id: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: seasonQueryKeys.detail(sessionKey ?? 'pending', id ?? 'none'),
    queryFn: ({ signal }) => getSeason(id!, signal),
    enabled: enabled && sessionKey !== undefined && id !== null,
    retry: false,
    staleTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible' ? 30_000 : false,
  });
}
