import type { CanvasHistoryItem } from '../api/history.types';
import { snapshotFileName } from './historyFormat';

/**
 * 이미지 주소는 API 도메인이라 a[download]가 무시되므로 파일을 받아 같은 출처 주소로 바꿔 저장한다.
 * 받기에 실패하면 호출한 쪽이 새 탭 열기로 대신한다.
 */
export async function downloadSnapshot(item: CanvasHistoryItem): Promise<void> {
  const response = await fetch(item.imageUrl, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Snapshot download failed with ${response.status}.`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = snapshotFileName(item);
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // 일부 브라우저는 click 직후 저장을 시작하므로 주소 해제를 잠시 미룬다.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
