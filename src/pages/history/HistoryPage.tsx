import { useMemo } from 'react';
import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state/ErrorState';
import { useCanvasHistoryQuery } from './api/history.queries';
import { flattenHistoryPages, readCanvasId } from './lib/historyFormat';
import { useSnapshotViewer } from './model/useSnapshotViewer';
import { SnapshotDialog } from './ui/SnapshotDialog';
import { SnapshotGrid, SnapshotGridSkeleton } from './ui/SnapshotGrid';
import './ui/history.css';

const HistoryPage = () => {
  const { t } = useTranslation('history');
  // 메인 캔버스 ID를 알려 주는 API가 없어 배포 환경마다 DB의 메인 캔버스 ID를 설정한다.
  const mainCanvasId = readCanvasId(import.meta.env.VITE_MAIN_CANVAS_ID);
  const query = useCanvasHistoryQuery(mainCanvasId);
  const items = useMemo(() => flattenHistoryPages(query.data?.pages), [query.data]);
  const viewer = useSnapshotViewer({
    items,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => query.fetchNextPage(),
  });

  function renderContent() {
    if (mainCanvasId === null) {
      return (
        <ErrorState
          symbol={<AlertTriangle />}
          title={t('unavailable.title')}
          description={t('unavailable.description')}
          actions={null}
        />
      );
    }
    // 오류를 먼저 구분해야 실패한 첫 조회가 로딩 화면에 머무르지 않는다.
    if (query.isError && !query.data) {
      return (
        <ErrorState
          role="alert"
          symbol={<AlertTriangle />}
          title={t('error.title')}
          description={t('error.description')}
          actions={<Button onClick={() => void query.refetch()}>{t('error.retry')}</Button>}
        />
      );
    }
    if (query.isPending) return <SnapshotGridSkeleton />;
    if (items.length === 0) {
      return (
        <div className="history-empty">
          <CalendarDays aria-hidden="true" />
          <p className="history-empty__title">{t('empty.title')}</p>
          <p className="history-empty__description">{t('empty.description')}</p>
        </div>
      );
    }
    return (
      <SnapshotGrid
        items={items}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        isFetchNextPageError={query.isFetchNextPageError}
        onLoadMore={() => void query.fetchNextPage()}
        onOpen={viewer.open}
      />
    );
  }

  return (
    <div className="history-page">
      <header className="history-header">
        <h1>{t('title')}</h1>
        <p>{t('subtitle')}</p>
      </header>
      {renderContent()}
      <SnapshotDialog
        item={viewer.selected}
        isLatest={viewer.isLatest}
        canShowOlder={viewer.canShowOlder}
        canShowNewer={viewer.canShowNewer}
        isLoadingOlder={viewer.isLoadingOlder}
        isDownloading={viewer.isDownloading}
        downloadFailed={viewer.downloadFailed}
        onClose={viewer.close}
        onShowOlder={() => void viewer.showOlder()}
        onShowNewer={viewer.showNewer}
        onDownload={() => void viewer.download()}
      />
    </div>
  );
};

export default HistoryPage;
