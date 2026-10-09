import type { CanvasHistoryItem, CanvasHistoryPage } from '../api/history.types';

export interface SnapshotDayGroup {
  key: string;
  capturedAt: string;
  items: CanvasHistoryItem[];
}

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 서버가 UUID v4만 받으므로 형식이 다른 설정값은 요청하지 않고 미설정으로 처리한다. */
export function readCanvasId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return UUID_V4_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

/** 페이지 사이에 같은 스냅샷이 다시 오더라도 처음 받은 순서대로 한 번만 남긴다. */
export function flattenHistoryPages(pages: readonly CanvasHistoryPage[] | undefined) {
  const seen = new Set<string>();
  const items: CanvasHistoryItem[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return items;
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 최신순 목록을 브라우저 시간대의 날짜별로 묶고, 목록 순서를 유지한다. */
export function groupSnapshotsByDay(items: readonly CanvasHistoryItem[]): SnapshotDayGroup[] {
  const groups: SnapshotDayGroup[] = [];
  for (const item of items) {
    const key = localDayKey(new Date(item.capturedAt));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, capturedAt: item.capturedAt, items: [item] });
  }
  return groups;
}

/** 캡처 시각을 브라우저 시간대의 날짜로 표시한다. 예: Oct 20, 2026 */
export function formatSnapshotDate(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** 캡처 시각을 브라우저 시간대의 24시간제 시각으로 표시한다. 예: 18:00 */
export function formatSnapshotTime(value: string, locale: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** 내려받는 파일 이름에 브라우저 시간대의 캡처 시각을 넣어 정렬하기 쉽게 한다. */
export function snapshotFileName(item: Pick<CanvasHistoryItem, 'capturedAt' | 'id'>): string {
  const date = new Date(item.capturedAt);
  if (!Number.isFinite(date.getTime())) return `cameo-snapshot-${item.id}.png`;
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  return `cameo-snapshot-${day}-${pad(date.getHours())}${pad(date.getMinutes())}.png`;
}
