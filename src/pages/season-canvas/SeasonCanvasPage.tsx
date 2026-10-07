import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import type { SeasonListStatus } from './api/seasons.types';
import { useSeasonCreate } from './model/useSeasonCreate';
import { useSeasonDetail } from './model/useSeasonDetail';
import { useSeasonList } from './model/useSeasonList';
import { useSeasonSessionScope } from './model/useSeasonSessionScope';
import { SeasonCreateDialog } from './ui/SeasonCreateDialog';
import { SeasonDetailDialog } from './ui/SeasonDetailDialog';
import { SeasonList } from './ui/SeasonList';
import './ui/season-canvas.css';

const filters: (SeasonListStatus | undefined)[] = [undefined, 'scheduled', 'active', 'ended'];

const SeasonCanvasPage = () => {
  const { t } = useTranslation('seasonCanvas');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const createOpenerRef = useRef<HTMLElement | null>(null);
  const detailOpenerRef = useRef<HTMLElement | null>(null);
  const restoreCreateFocusRef = useRef(true);
  const scope = useSeasonSessionScope();
  const list = useSeasonList(scope.sessionKey, scope.isReady);
  const detail = useSeasonDetail(scope);
  const create = useSeasonCreate(
    scope,
    id => {
      restoreCreateFocusRef.current = false;
      detailOpenerRef.current = null;
      list.resetToFirstAll();
      detail.openDetail(id);
    },
    list.resetToFirstAll
  );
  const preview = list.query.data?.items.find(item => item.id === detail.selectedId);

  return (
    <div className="season-page">
      <header className="season-hero">
        <h1 ref={headingRef} tabIndex={-1}>
          {t('title')}
        </h1>
        {scope.sessionQuery.isLoading && !scope.sessionQuery.data ? (
          <Skeleton className="season-create-skeleton" />
        ) : (
          <Button
            disabled={!scope.session || !scope.isReady}
            onClick={event => {
              createOpenerRef.current = event.currentTarget;
              restoreCreateFocusRef.current = true;
              create.openDialog();
            }}
          >
            {t('create')}
          </Button>
        )}
      </header>
      {scope.sessionQuery.isError && (
        <div className="season-inline-alert" role="alert">
          <span>{t('sessionError')}</span>
          <Button size="sm" variant="secondary" onClick={() => void scope.sessionQuery.refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}
      <div className="season-filter" role="group" aria-label={t('filters.label')}>
        {filters.map(filter => (
          <button
            key={filter ?? 'all'}
            type="button"
            className="season-filter__item"
            aria-pressed={list.status === filter}
            onClick={() => list.setStatus(filter)}
          >
            {t(`filters.${filter ?? 'all'}`)}
          </button>
        ))}
      </div>
      {!scope.isReady ? (
        <div className="season-list" aria-busy="true" aria-label={t('sessionChecking')}>
          {[0, 1, 2].map(value => (
            <Skeleton key={value} className="season-list__skeleton" />
          ))}
        </div>
      ) : (
        <SeasonList
          data={list.query.data}
          isLoading={list.query.isLoading}
          isError={list.query.isError}
          isRefetchError={list.query.isRefetchError}
          page={list.page}
          onOpen={(id, opener) => {
            detailOpenerRef.current = opener;
            detail.openDetail(id);
          }}
          onPage={list.setPage}
          onRetry={() => void list.query.refetch()}
        />
      )}
      <SeasonCreateDialog
        open={create.open}
        draft={create.draft}
        errors={create.errors}
        serverError={create.serverError}
        traceId={create.traceId}
        ambiguous={create.ambiguous}
        retryAcknowledged={create.retryAcknowledged}
        isPending={create.isPending}
        onOpenChange={open => !open && create.closeDialog()}
        onUpdate={create.updateDraft}
        onSubmit={create.submit}
        onCheckList={create.checkList}
        onRetryAcknowledged={create.setRetryAcknowledged}
        restoreFocusTo={createOpenerRef}
        fallbackFocusTo={headingRef}
        restoreFocusOnClose={restoreCreateFocusRef}
      />
      <SeasonDetailDialog
        selectedId={detail.selectedId}
        preview={preview}
        query={detail.detailQuery}
        manageAction={detail.manageAction}
        manageError={detail.manageError}
        isManaging={detail.isManaging}
        isRefreshingManagement={detail.isRefreshingManagement}
        canInteract={scope.isReady && !scope.isChangingSession}
        onClose={detail.closeDetail}
        onOpenManage={detail.openManage}
        onCloseManage={detail.closeManage}
        onConfirmManage={detail.confirmManage}
        restoreFocusTo={detailOpenerRef}
        fallbackFocusTo={headingRef}
      />
    </div>
  );
};

export default SeasonCanvasPage;
