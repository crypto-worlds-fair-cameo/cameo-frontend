import { describe, expect, it } from 'vitest';
import type { CanvasHistoryItem } from '../api/history.types';
import {
  flattenHistoryPages,
  formatSnapshotTime,
  groupSnapshotsByDay,
  readCanvasId,
  snapshotFileName,
} from './historyFormat';

// 테스트 실행 환경의 시간대와 관계없이 같은 결과가 나오도록 로컬 시각으로 만든다.
function snapshot(id: string, localDate: Date): CanvasHistoryItem {
  return {
    id,
    imageUrl: `https://api.example.com/canvas-assets/${id}.png`,
    width: 100,
    height: 100,
    capturedAt: localDate.toISOString(),
    isFinal: false,
  };
}

describe('history formatting', () => {
  it('accepts only UUID v4 canvas IDs', () => {
    expect(readCanvasId(' 0414F7C0-E937-4EFB-A058-7B5BF11F75B8 ')).toBe(
      '0414f7c0-e937-4efb-a058-7b5bf11f75b8'
    );
    expect(readCanvasId('main')).toBeNull();
    expect(readCanvasId(undefined)).toBeNull();
    expect(readCanvasId('')).toBeNull();
  });

  it('keeps the first copy when pages overlap', () => {
    const a = snapshot('a', new Date(2026, 9, 9, 18));
    const b = snapshot('b', new Date(2026, 9, 9, 17));
    const items = flattenHistoryPages([
      { items: [a, b], nextCursor: 'next', hasNext: true },
      { items: [b, { ...a, isFinal: true }], nextCursor: null, hasNext: false },
    ]);
    expect(items).toEqual([a, b]);
  });

  it('groups newest-first snapshots by local day without reordering', () => {
    const items = [
      snapshot('a', new Date(2026, 9, 10, 1)),
      snapshot('b', new Date(2026, 9, 10, 0)),
      snapshot('c', new Date(2026, 9, 9, 23)),
    ];
    const groups = groupSnapshotsByDay(items);
    expect(groups.map(group => group.key)).toEqual(['2026-10-10', '2026-10-09']);
    expect(groups[0].items.map(item => item.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map(item => item.id)).toEqual(['c']);
  });

  it('formats a 24-hour local time and a sortable download name', () => {
    const item = snapshot('a', new Date(2026, 9, 20, 18, 5));
    expect(formatSnapshotTime(item.capturedAt, 'en')).toBe('18:05');
    expect(snapshotFileName(item)).toBe('cameo-snapshot-20261020-1805.png');
  });
});
