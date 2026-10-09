import { useRef, useState } from 'react';
import type { CanvasHistoryItem, CanvasHistoryPage } from '../api/history.types';
import { downloadSnapshot } from '../lib/downloadSnapshot';
import { flattenHistoryPages } from '../lib/historyFormat';

interface SnapshotViewerOptions {
  items: readonly CanvasHistoryItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<{ data?: { pages: CanvasHistoryPage[] } }>;
}

/**
 * 상세 팝업의 선택 스냅샷과 이전·다음 이동, 내려받기 상태를 소유한다.
 * 목록은 최신순이므로 Prev는 더 오래된(다음 인덱스), Next는 더 최신(이전 인덱스) 스냅샷이다.
 */
export function useSnapshotViewer({
  items,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: SnapshotViewerOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadFailedId, setDownloadFailedId] = useState<string | null>(null);
  // 마지막 선택 변경만 유효하게 해서 늦게 끝난 더 보기 요청이 다른 선택을 덮지 않게 한다.
  const selectionTokenRef = useRef(0);

  const index = selectedId === null ? -1 : items.findIndex(item => item.id === selectedId);
  // 다시 조회한 목록에서 사라진 스냅샷은 팝업을 닫은 것으로 처리한다.
  const selected = index >= 0 ? items[index] : undefined;

  function select(id: string | null) {
    selectionTokenRef.current += 1;
    setSelectedId(id);
  }

  async function showOlder() {
    if (!selected) return;
    const older = items[index + 1];
    if (older) {
      select(older.id);
      return;
    }
    if (!hasNextPage || isFetchingNextPage) return;
    const token = ++selectionTokenRef.current;
    const result = await fetchNextPage();
    if (token !== selectionTokenRef.current) return;
    const next = flattenHistoryPages(result.data?.pages);
    const currentIndex = next.findIndex(item => item.id === selected.id);
    const target = currentIndex >= 0 ? next[currentIndex + 1] : undefined;
    if (target) select(target.id);
  }

  function showNewer() {
    const newer = index > 0 ? items[index - 1] : undefined;
    if (newer) select(newer.id);
  }

  async function download() {
    if (!selected || isDownloading) return;
    setIsDownloading(true);
    setDownloadFailedId(null);
    try {
      await downloadSnapshot(selected);
    } catch {
      // 받기에 실패하면 팝업에 원본 이미지 열기 링크를 보여 준다.
      setDownloadFailedId(selected.id);
    } finally {
      setIsDownloading(false);
    }
  }

  return {
    selected,
    isLatest: index === 0,
    canShowNewer: index > 0,
    canShowOlder: selected !== undefined && (index < items.length - 1 || hasNextPage),
    isLoadingOlder: isFetchingNextPage && selected !== undefined && index === items.length - 1,
    isDownloading,
    downloadFailed: selected !== undefined && downloadFailedId === selected.id,
    open: (id: string) => select(id),
    close: () => select(null),
    showOlder,
    showNewer,
    download,
  };
}
