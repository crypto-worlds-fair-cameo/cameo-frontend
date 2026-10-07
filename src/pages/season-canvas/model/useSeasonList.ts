import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useSeasonsQuery } from '../api/seasons.queries';
import {
  buildSeasonSearchParams,
  parseSeasonSearchParams,
  SEASON_PAGE_LIMIT,
} from '../lib/seasonSearchParams';
import type { SeasonListStatus } from '../api/seasons.types';

/** URL 필터와 페이지를 목록 query에 연결하고 잘못된 query를 표준 URL로 고친다. */
export function useSeasonList(sessionKey: string | undefined, enabled: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsString = searchParams.toString();
  const parsed = useMemo(
    () => parseSeasonSearchParams(new URLSearchParams(searchParamsString)),
    [searchParamsString]
  );
  const { status, page } = parsed.value;
  const query = useSeasonsQuery(sessionKey, { status, page, limit: SEASON_PAGE_LIMIT }, enabled);

  useEffect(() => {
    // 중복·빈 값·지원하지 않는 query는 history를 늘리지 않고 표준 URL로 교체한다.
    if (parsed.needsReplace) setSearchParams(parsed.normalized, { replace: true });
  }, [parsed.needsReplace, parsed.normalized, setSearchParams]);

  useEffect(() => {
    // 변경 사이에 비어진 후속 페이지는 첫 페이지에서 최신 목록을 다시 조회한다.
    if (query.isSuccess && page > 1 && query.data.items.length === 0) {
      setSearchParams(buildSeasonSearchParams({ status, page: 1 }), { replace: true });
    }
  }, [page, query.data, query.isSuccess, setSearchParams, status]);

  const setStatus = (nextStatus?: SeasonListStatus) => {
    setSearchParams(buildSeasonSearchParams({ status: nextStatus, page: 1 }));
  };
  const setPage = (nextPage: number) => {
    if (nextPage < 1) return;
    setSearchParams(buildSeasonSearchParams({ status, page: nextPage }));
  };
  const resetToFirstAll = () => {
    setSearchParams(buildSeasonSearchParams({ page: 1 }));
  };

  return { status, page, query, setStatus, setPage, resetToFirstAll };
}
