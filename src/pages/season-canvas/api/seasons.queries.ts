import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getLatestSeasonSnapshotUrl,
  getSeason,
  listSeasonHolders,
  listSeasons,
} from './seasons.api';
import type { ListSeasonHoldersInput, ListSeasonsInput } from './seasons.types';

export const seasonQueryKeys = {
  root: ['season-canvas'] as const,
  session: (sessionKey: string) => ['season-canvas', sessionKey] as const,
  lists: (sessionKey: string) => ['season-canvas', sessionKey, 'list'] as const,
  list: (sessionKey: string, input: ListSeasonsInput) =>
    ['season-canvas', sessionKey, 'list', input.status ?? 'all', input.page, input.limit] as const,
  detail: (sessionKey: string, id: string) => ['season-canvas', sessionKey, 'detail', id] as const,
  snapshot: (sessionKey: string, id: string) =>
    ['season-canvas', sessionKey, 'snapshot', id] as const,
  holders: (sessionKey: string, id: string, input: ListSeasonHoldersInput) =>
    [
      'season-canvas',
      sessionKey,
      'holders',
      id,
      input.page,
      input.limit,
      input.search?.trim() ?? '',
    ] as const,
};

/**
 * 시즌 참가자와 NFT 수령 수량을 조회한다.
 * 같은 세션·시즌에서 쪽이나 검색어만 바뀌는 동안에는 이전 목록을 유지해 창 높이가 흔들리지 않게 한다.
 */
export function useSeasonHoldersQuery(
  sessionKey: string | undefined,
  seasonId: string | undefined,
  input: ListSeasonHoldersInput,
  enabled: boolean
) {
  const queryKey = seasonQueryKeys.holders(sessionKey ?? 'pending', seasonId ?? 'none', input);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => listSeasonHolders(seasonId!, input, signal),
    enabled: enabled && sessionKey !== undefined && seasonId !== undefined,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === queryKey[1] && previousQuery.queryKey[3] === queryKey[3]
        ? keepPreviousData(previous)
        : undefined,
  });
}

/** 시즌 미리보기의 최신 스냅샷 주소를 조회한다. 서버가 주기적으로 새로 찍으므로 보이는 탭에서 1분마다 갱신한다. */
export function useSeasonSnapshotQuery(
  sessionKey: string | undefined,
  seasonId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: seasonQueryKeys.snapshot(sessionKey ?? 'pending', seasonId ?? 'none'),
    queryFn: ({ signal }) => getLatestSeasonSnapshotUrl(seasonId!, signal),
    enabled: enabled && sessionKey !== undefined && seasonId !== undefined,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: () =>
      typeof document === 'undefined' || document.visibilityState === 'visible' ? 60_000 : false,
  });
}

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
