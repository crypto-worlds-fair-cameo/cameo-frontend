import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Skeleton } from '@/shared/ui/skeleton';
import { SeasonRequestError, type Season } from '../api/seasons.types';
import type { SeasonErrorKey } from '../lib/seasonErrors';
import { formatSeasonDateTime } from '../lib/seasonDate';
import type { SeasonManageAction } from '../model/useSeasonDetail';
import { SeasonPreview } from './SeasonPreview';

interface SeasonDetailDialogProps {
  selectedId: string | null;
  preview?: Season;
  query: UseQueryResult<Season, Error>;
  manageAction: SeasonManageAction | null;
  manageError: SeasonErrorKey | null;
  isManaging: boolean;
  isRefreshingManagement: boolean;
  canInteract: boolean;
  onClose: () => void;
  onOpenManage: (action: SeasonManageAction) => void;
  onCloseManage: () => void;
  onConfirmManage: () => void;
  restoreFocusTo: RefObject<HTMLElement | null>;
  fallbackFocusTo: RefObject<HTMLElement | null>;
}

export function SeasonDetailDialog(props: SeasonDetailDialogProps) {
  const { t } = useTranslation('seasonCanvas');
  const cachedSeason = props.query.data;
  const notFound =
    props.query.error instanceof SeasonRequestError &&
    (props.query.error.statusCode === 404 || props.query.error.code === 'SEASON_NOT_FOUND');
  // 404는 취소된 시즌의 접근 제한일 수 있으므로 오래된 상세를 현재 정보처럼 표시하지 않는다.
  const season = notFound ? undefined : cachedSeason;
  // 404가 아니면 목록의 미리보기로 제목을 먼저 보여 주고, 조회된 상세로 갱신한다.
  const summary = notFound ? undefined : (season ?? props.preview);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const endButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousManageActionRef = useRef<SeasonManageAction | null>(props.manageAction);

  useEffect(() => {
    const previous = previousManageActionRef.current;
    previousManageActionRef.current = props.manageAction;
    if (!previous || props.manageAction) return;
    // 확인창을 닫으면 실행했던 관리 버튼으로 돌아가고, 버튼이 사라지면 상세 자체로 이동한다.
    queueMicrotask(() => {
      const target = previous === 'cancel' ? cancelButtonRef.current : endButtonRef.current;
      if (target?.isConnected && !target.disabled) target.focus();
      else contentRef.current?.focus();
    });
  }, [props.manageAction]);
  return (
    <>
      <Dialog open={props.selectedId !== null} onOpenChange={open => !open && props.onClose()}>
        <DialogContent
          ref={contentRef}
          tabIndex={-1}
          className="season-dialog season-detail-dialog"
          showCloseButton={false}
          onCloseAutoFocus={event => {
            event.preventDefault();
            restoreFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
          }}
        >
          <div className="season-detail-layout">
            <SeasonPreview status={summary?.status} className="season-detail__preview" />
            <div className="season-detail__info">
              <DialogHeader className="season-detail__heading">
                <p className="season-detail__eyebrow">{t('detail.eyebrow')}</p>
                <DialogTitle>{summary?.title ?? t('detail.title')}</DialogTitle>
                <DialogDescription>
                  {summary?.description || t('detail.descriptionEmpty')}
                </DialogDescription>
              </DialogHeader>
              {/* 최초 조회 중에는 로딩을, 상세 없이 실패하면 재시도를, 조회 성공 시에는 정보를 보여 준다. */}
              {props.query.isLoading && !season ? (
                <div aria-busy="true">
                  <Skeleton className="season-detail__skeleton" />
                  <p>{t('detail.loading')}</p>
                </div>
              ) : props.query.isError && !season ? (
                <div className="season-detail__error" role="alert">
                  <p>{notFound ? t('detail.notFound') : t('detail.error')}</p>
                  <Button variant="secondary" size="sm" onClick={() => void props.query.refetch()}>
                    {t('detail.refresh')}
                  </Button>
                </div>
              ) : season ? (
                <>
                  {/* 기존 상세를 유지한 재조회가 실패하면 오래된 정보임을 안내한다. */}
                  {props.query.isRefetchError && (
                    <div className="season-inline-alert" role="alert">
                      <span>{t('list.stale')}</span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void props.query.refetch()}
                      >
                        {t('retry')}
                      </Button>
                    </div>
                  )}
                  <SeasonDetail season={season} />
                </>
              ) : null}
              {/* 관리 요청의 실패는 상세 정보 옆에 남겨 다시 확인할 수 있게 한다. */}
              {props.manageError && (
                <p className="season-detail__error" role="alert">
                  {t(`errors.${props.manageError}`)}
                </p>
              )}
              <DialogFooter className="season-detail__actions">
                {/* 확인된 상세와 세션 경계가 준비됐을 때만 캔버스 관람 링크를 제공한다. */}
                {season && props.canInteract && !props.query.isError && (
                  <Button asChild variant="web3">
                    <Link to={`/season-canvas/${season.id}`}>{t('workspace.watch')}</Link>
                  </Button>
                )}
                {/* 서버가 제공한 관리 권한에 따라 취소·조기 종료 버튼을 표시한다. */}
                {season?.canCancel && (
                  <Button
                    ref={cancelButtonRef}
                    variant="destructive"
                    disabled={
                      !props.canInteract ||
                      props.query.isError ||
                      props.query.isFetching ||
                      props.isRefreshingManagement
                    }
                    loading={props.isRefreshingManagement}
                    onClick={() => void props.onOpenManage('cancel')}
                  >
                    {t('detail.cancel')}
                  </Button>
                )}
                {season?.canEnd && (
                  <Button
                    ref={endButtonRef}
                    variant="destructive"
                    disabled={
                      !props.canInteract ||
                      props.query.isError ||
                      props.query.isFetching ||
                      props.isRefreshingManagement
                    }
                    loading={props.isRefreshingManagement}
                    onClick={() => void props.onOpenManage('end')}
                  >
                    {t('detail.end')}
                  </Button>
                )}
                <DialogClose asChild>
                  <Button variant="secondary" disabled={props.isManaging}>
                    {t('detail.close')}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={props.manageAction !== null}
        onOpenChange={open => !open && props.onCloseManage()}
        title={t(props.manageAction === 'cancel' ? 'manage.cancelTitle' : 'manage.endTitle')}
        description={t(
          props.manageAction === 'cancel' ? 'manage.cancelDescription' : 'manage.endDescription',
          { title: season?.title ?? props.preview?.title ?? '' }
        )}
        confirmLabel={t(
          props.manageAction === 'cancel' ? 'manage.cancelConfirm' : 'manage.endConfirm'
        )}
        cancelLabel={t('manage.close')}
        loading={props.isManaging}
        onConfirm={() => void props.onConfirmManage()}
      />
    </>
  );
}

function restoreFocus(target: HTMLElement | null, fallback: HTMLElement | null) {
  queueMicrotask(() => {
    const available = (element: HTMLElement | null) =>
      element?.isConnected && !element.matches(':disabled, [aria-disabled="true"]');
    if (available(target)) target!.focus();
    else if (available(fallback)) fallback!.focus();
  });
}

/** 최신 상세의 기간, 1인당 획 제한과 누적 참가 인원을 간결한 정보 행으로 표시한다. */
function SeasonDetail({ season }: { season: Season }) {
  const { t } = useTranslation('seasonCanvas');
  // 조기 종료일을 기간에 반영하고, null 획 제한은 무제한으로 표시한다.
  const periodEnd = season.forceEndedAt ?? season.endsAt;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const facts: { label: string; value: ReactNode }[] = [
    {
      label: t('detail.period'),
      value: (
        <span className="season-detail__period" title={t('detail.timezone', { timezone })}>
          <time dateTime={season.startsAt}>{formatSeasonDateTime(season.startsAt)}</time>
          <span>-</span>
          <time dateTime={periodEnd}>{formatSeasonDateTime(periodEnd)}</time>
        </span>
      ),
    },
    {
      label: t('detail.brushStrokes'),
      value:
        season.strokeLimitPerUser === null
          ? t('card.unlimited')
          : t('card.strokes', { count: season.strokeLimitPerUser }),
    },
    { label: t('detail.capacity'), value: `${season.participantCount}/${season.capacity}` },
  ];
  return (
    <div className="season-detail">
      <dl>
        {facts.map(fact => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
