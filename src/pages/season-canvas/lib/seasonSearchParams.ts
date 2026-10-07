import type { SeasonListStatus } from '../api/seasons.types';

export const SEASON_PAGE_LIMIT = 20;

export interface SeasonLocationState {
  status?: SeasonListStatus;
  page: number;
}

const allowedStatuses = new Set<SeasonListStatus>(['scheduled', 'active', 'ended']);

/** URL query를 지원하는 필터와 양의 정수 page로 정규화한다. */
export function parseSeasonSearchParams(params: URLSearchParams): {
  value: SeasonLocationState;
  normalized: URLSearchParams;
  needsReplace: boolean;
} {
  const statusValues = params.getAll('status');
  const pageValues = params.getAll('page');
  const status =
    statusValues.length === 1 && allowedStatuses.has(statusValues[0] as SeasonListStatus)
      ? (statusValues[0] as SeasonListStatus)
      : undefined;
  const pageValue = pageValues.length === 1 ? pageValues[0] : null;
  const parsedPage = pageValue && /^[1-9]\d*$/.test(pageValue) ? Number(pageValue) : 1;
  const page = Number.isSafeInteger(parsedPage) ? parsedPage : 1;
  const normalized = buildSeasonSearchParams({ status, page });
  return {
    value: { status, page },
    normalized,
    needsReplace: params.toString() !== normalized.toString(),
  };
}

/** 기본 전체 필터와 1페이지는 URL에서 생략한다. */
export function buildSeasonSearchParams(value: SeasonLocationState): URLSearchParams {
  const params = new URLSearchParams();
  if (value.status) params.set('status', value.status);
  if (value.page !== 1) params.set('page', String(value.page));
  return params;
}
