import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import type { SeasonListStatus } from './api/seasons.types';
import { useSeasonCreate } from './model/useSeasonCreate';
import { useSeasonDetail } from './model/useSeasonDetail';
import { useSeasonJoinFlow } from './model/useSeasonJoinFlow';
import { useSeasonList } from './model/useSeasonList';
import { useSeasonSessionScope } from './model/useSeasonSessionScope';
import { SeasonCreateDialog } from './ui/SeasonCreateDialog';
import { SeasonCreatedDialog } from './ui/SeasonCreatedDialog';
import { SeasonDetailDialog } from './ui/SeasonDetailDialog';
import { SeasonJoinDialog } from './ui/SeasonJoinDialog';
import { SeasonList } from './ui/SeasonList';
import './ui/season-canvas.css';

// Figma 탭 순서(전체·진행 중·예정·종료)를 따른다. 인기순 정렬은 서버가 제공하지 않는다.
const filters: (SeasonListStatus | undefined)[] = [undefined, 'active', 'scheduled', 'ended'];

const SeasonCanvasPage = () => {
  const { t } = useTranslation('seasonCanvas');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const createOpenerRef = useRef<HTMLElement | null>(null);
  const detailOpenerRef = useRef<HTMLElement | null>(null);
  const restoreCreateFocusRef = useRef(true);
  const scope = useSeasonSessionScope();
  // 로그인 확인이 실패해도 공개 목록은 손님으로 보여 준다. 계정 동작은 각 버튼의 로그인 창이 맡는다.
  const browseAsGuest = scope.sessionQuery.isError && !scope.isReady && !scope.isChangingSession;
  const listScope = browseAsGuest ? { ...scope, sessionKey: 'guest', isReady: true } : scope;
  const list = useSeasonList(listScope.sessionKey, listScope.isReady);
  const detail = useSeasonDetail(listScope);
  const create = useSeasonCreate(
    scope,
    () => {
      restoreCreateFocusRef.current = false;
      detailOpenerRef.current = null;
      list.resetToFirstAll();
    },
    list.resetToFirstAll
  );
  const preview = list.query.data?.items.find(item => item.id === detail.selectedId);
  // 참가 안내 팝업은 상세 모달을 대신하므로 팝업을 띄우기 전에 상세를 닫는다.
  const joinFlow = useSeasonJoinFlow(scope, detail.closeDetail);

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
            variant="secondary"
            className="season-create-button"
            disabled={scope.isChangingSession}
            onClick={event => {
              // 지갑 연결 창은 헤더가 소유하므로 손님에게는 헤더의 연결 버튼을 안내한다.
              // 안내를 닫으면 포커스가 이 버튼으로 돌아오도록 안내 팝업의 복귀 대상으로 둔다.
              if (!scope.session) {
                detailOpenerRef.current = event.currentTarget;
                joinFlow.askWalletToCreate();
                return;
              }
              createOpenerRef.current = event.currentTarget;
              restoreCreateFocusRef.current = true;
              create.openDialog();
            }}
          >
            <span aria-hidden="true">+</span>
            {t('create')}
          </Button>
        )}
      </header>
      <hr className="season-divider" />
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
      {!listScope.isReady ? (
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
        canInteract={listScope.isReady && !scope.isChangingSession}
        isJoining={joinFlow.joiningId !== null && joinFlow.joiningId === detail.selectedId}
        onClose={detail.closeDetail}
        onJoin={season => void joinFlow.join(season)}
        onBrowseLive={() => {
          detail.closeDetail();
          list.setStatus('active');
        }}
        onOpenManage={detail.openManage}
        onCloseManage={detail.closeManage}
        onConfirmManage={detail.confirmManage}
        restoreFocusTo={detailOpenerRef}
        fallbackFocusTo={headingRef}
      />
      <SeasonCreatedDialog
        createdId={create.createdId}
        onClose={create.closeCreatedNotice}
        restoreFocusTo={createOpenerRef}
        fallbackFocusTo={headingRef}
      />
      <SeasonJoinDialog
        notice={joinFlow.notice}
        joiningId={joinFlow.joiningId}
        onClose={joinFlow.closeNotice}
        onRetry={season => void joinFlow.join(season)}
        restoreFocusTo={detailOpenerRef}
        fallbackFocusTo={headingRef}
      />
    </div>
  );
};

export default SeasonCanvasPage;
