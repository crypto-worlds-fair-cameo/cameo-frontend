import { AlertTriangle, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state/ErrorState';
import { Skeleton } from '@/shared/ui/skeleton';
import type { SeasonPage } from '../api/seasons.types';
import { SeasonCard } from './SeasonCard';

interface SeasonListProps {
  data?: SeasonPage;
  isLoading: boolean;
  isError: boolean;
  isRefetchError: boolean;
  page: number;
  onOpen: (id: string, opener: HTMLButtonElement) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
}

export function SeasonList({
  data,
  isLoading,
  isError,
  isRefetchError,
  page,
  onOpen,
  onPage,
  onRetry,
}: SeasonListProps) {
  const { t } = useTranslation('seasonCanvas');
  if (isLoading && !data) {
    return (
      <section className="season-list" aria-label={t('list.loading')} aria-busy="true">
        {[0, 1, 2].map(value => (
          <Skeleton key={value} className="season-list__skeleton" />
        ))}
      </section>
    );
  }
  if (isError && !data) {
    return (
      <ErrorState
        role="alert"
        symbol={<AlertTriangle />}
        title={t('list.errorTitle')}
        description={t('list.errorDescription')}
        actions={<Button onClick={onRetry}>{t('retry')}</Button>}
      />
    );
  }
  return (
    <section className="season-list-shell" aria-live="polite">
      {isRefetchError && data && (
        <div className="season-inline-alert" role="alert">
          <span>{t('list.stale')}</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </div>
      )}
      {data?.items.length ? (
        <div className="season-list">
          {data.items.map(season => (
            <SeasonCard
              key={season.id}
              season={season}
              onOpen={opener => onOpen(season.id, opener)}
            />
          ))}
        </div>
      ) : (
        <div className="season-empty">
          <CalendarDays aria-hidden="true" />
          <p>{t('list.empty')}</p>
        </div>
      )}
      <nav className="season-pager" aria-label={t('list.pagination')}>
        <Button
          variant="secondary"
          size="sm"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          {t('list.previous')}
        </Button>
        <span aria-current="page">{t('list.page', { page })}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!data?.hasNext}
          onClick={() => onPage(page + 1)}
        >
          {t('list.next')}
        </Button>
      </nav>
    </section>
  );
}
