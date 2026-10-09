import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import type { CanvasHistoryItem } from '../api/history.types';
import { formatSnapshotDate, groupSnapshotsByDay } from '../lib/historyFormat';
import { SnapshotCard } from './SnapshotCard';

interface SnapshotGridProps {
  items: CanvasHistoryItem[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  onLoadMore: () => void;
  onOpen: (id: string) => void;
}

export function SnapshotGrid({
  items,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
  onOpen,
}: SnapshotGridProps) {
  const { t, i18n } = useTranslation('history');
  const groups = groupSnapshotsByDay(items);
  const latestId = items[0]?.id;

  return (
    <div className="history-list">
      {groups.map((group, groupIndex) => {
        // 다음 페이지가 남아 있으면 마지막 날짜의 스냅샷이 더 있을 수 있어 개수 뒤에 +를 붙인다.
        const mayContinue = hasNextPage && groupIndex === groups.length - 1;
        return (
          <section key={group.key} className="history-day" aria-labelledby={`day-${group.key}`}>
            <h2 id={`day-${group.key}`} className="history-day__title">
              {formatSnapshotDate(group.capturedAt, i18n.language)}
              <span className="history-day__count">
                {mayContinue
                  ? t('dayCountMore', { count: group.items.length })
                  : t('dayCount', { count: group.items.length })}
              </span>
            </h2>
            <div className="history-grid">
              {group.items.map(item => (
                <SnapshotCard
                  key={item.id}
                  item={item}
                  isLatest={item.id === latestId}
                  onOpen={() => onOpen(item.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
      {isFetchNextPageError && (
        <div className="history-inline-alert" role="alert">
          <span>{t('error.more')}</span>
          <Button size="sm" variant="secondary" onClick={onLoadMore}>
            {t('error.retry')}
          </Button>
        </div>
      )}
      {hasNextPage && !isFetchNextPageError && (
        <div className="history-more">
          <Button variant="secondary" disabled={isFetchingNextPage} onClick={onLoadMore}>
            {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

export function SnapshotGridSkeleton() {
  const { t } = useTranslation('history');
  return (
    <div className="history-grid" aria-busy="true" aria-label={t('loading')}>
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="history-card history-card--skeleton">
          <Skeleton className="history-card__frame" />
          <Skeleton className="history-skeleton-line" />
          <Skeleton className="history-skeleton-line history-skeleton-line--long" />
        </div>
      ))}
    </div>
  );
}
