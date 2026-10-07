import type { Season } from '../api/seasons.types';

/** 상세 기간의 ISO 시각을 브라우저 시간대의 YYYY.MM.DD HH:mm 형식으로 표시한다. */
export function formatSeasonDateTime(value: string): string {
  const date = new Date(value);
  // 해석할 수 없는 시각은 원본을 남기고, 유효한 시각은 초 없이 24시간제로 표시한다.
  if (!Number.isFinite(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}.${month}.${day} ${hour}:${minute}`;
}

/** 서버 ISO 시각을 선택 언어와 브라우저 시간대로 표시한다. */
export function formatSeasonDate(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

/** 카드의 시즌 기간을 브라우저 시간대의 날짜 범위로 축약해 표시한다. */
export function formatSeasonDateRange(start: string, end: string, locale: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  // 날짜를 해석할 수 없거나 종료가 시작보다 이르면 원본을 남겨 렌더링 오류를 피한다.
  if (
    !Number.isFinite(startDate.getTime()) ||
    !Number.isFinite(endDate.getTime()) ||
    endDate < startDate
  ) {
    return `${start} – ${end}`;
  }
  const endLabel = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(endDate);
  // 같은 날짜에 시작·종료하면 날짜를 한 번만 표시한다.
  if (startDate.toDateString() === endDate.toDateString()) return endLabel;
  // 같은 해의 기간은 시작 날짜에서 연도를 생략하고, 해를 넘기면 양쪽 연도를 표시한다.
  const startLabel = new Intl.DateTimeFormat(locale, {
    year: startDate.getFullYear() === endDate.getFullYear() ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(startDate);
  return `${startLabel} – ${endLabel}`;
}

/** 예약·진행 시즌의 예정 종료까지 남은 24시간 단위 일수를 올림해 반환한다. */
export function getSeasonDaysRemaining(
  season: Pick<Season, 'status' | 'endsAt'>,
  now = Date.now()
): number | null {
  // 종료·취소 시즌은 남은 기간을 표시하지 않고 서버 상태를 그대로 따른다.
  if (season.status !== 'scheduled' && season.status !== 'active') return null;
  const end = Date.parse(season.endsAt);
  // 해석할 수 없는 종료 시각은 생략하고, 이미 지난 예정 종료일은 D-0으로 표시한다.
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}
