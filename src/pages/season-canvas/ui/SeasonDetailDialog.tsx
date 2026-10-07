import { useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { UseQueryResult } from '@tanstack/react-query';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Skeleton } from '@/shared/ui/skeleton';
import { SeasonRequestError, type Season } from '../api/seasons.types';
import type { SeasonErrorKey } from '../lib/seasonErrors';
import { formatSeasonDate } from '../lib/seasonDate';
import type { SeasonManageAction } from '../model/useSeasonDetail';
import { SeasonStatusBadge } from './SeasonStatusBadge';

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
  const { t, i18n } = useTranslation('seasonCanvas');
  const cachedSeason = props.query.data;
  const notFound =
    props.query.error instanceof SeasonRequestError &&
    (props.query.error.statusCode === 404 || props.query.error.code === 'SEASON_NOT_FOUND');
  // 404는 취소된 시즌의 접근 제한일 수 있으므로 오래된 상세를 현재 정보처럼 표시하지 않는다.
  const season = notFound ? undefined : cachedSeason;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
          className="season-dialog"
          showCloseButton={!props.isManaging}
          onCloseAutoFocus={event => {
            event.preventDefault();
            restoreFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
          }}
        >
          <DialogHeader>
            <DialogTitle>{season?.title ?? props.preview?.title ?? t('detail.title')}</DialogTitle>
            <DialogDescription>
              {season?.description ?? props.preview?.description ?? t('detail.descriptionEmpty')}
            </DialogDescription>
          </DialogHeader>
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
              {props.query.isRefetchError && (
                <div className="season-inline-alert" role="alert">
                  <span>{t('list.stale')}</span>
                  <Button variant="secondary" size="sm" onClick={() => void props.query.refetch()}>
                    {t('retry')}
                  </Button>
                </div>
              )}
              <SeasonDetail season={season} locale={i18n.language} timezone={timezone} />
            </>
          ) : null}
          {props.manageError && (
            <p className="season-detail__error" role="alert">
              {t(`errors.${props.manageError}`)}
            </p>
          )}
          {season && (
            <DialogFooter>
              {props.canInteract && !props.query.isError && (
                <Button asChild variant="secondary">
                  <Link to={`/season-canvas/${season.id}`}>{t('workspace.watch')}</Link>
                </Button>
              )}
              {season.canCancel && (
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
              {season.canEnd && (
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
            </DialogFooter>
          )}
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

function SeasonDetail({
  season,
  locale,
  timezone,
}: {
  season: Season;
  locale: string;
  timezone: string;
}) {
  const { t } = useTranslation('seasonCanvas');
  const facts: { label: string; value: string }[] = [
    {
      label: t('detail.participants'),
      value: t('units.people', { count: season.participantCount }),
    },
    { label: t('detail.capacity'), value: t('units.people', { count: season.capacity }) },
    { label: t('detail.dimensions'), value: `${season.width} × ${season.height} px` },
    {
      label: t('detail.strokeLimit'),
      value:
        season.strokeLimitPerUser === null
          ? t('units.unlimited')
          : t('units.strokes', { count: season.strokeLimitPerUser }),
    },
    { label: t('detail.startsAt'), value: formatSeasonDate(season.startsAt, locale) },
    { label: t('detail.scheduledEnd'), value: formatSeasonDate(season.endsAt, locale) },
    { label: t('detail.createdAt'), value: formatSeasonDate(season.createdAt, locale) },
  ];
  if (season.forceEndedAt)
    facts.splice(6, 0, {
      label: t('detail.actualEnd'),
      value: formatSeasonDate(season.forceEndedAt, locale),
    });
  if (season.cancelledAt)
    facts.splice(6, 0, {
      label: t('detail.cancelledAt'),
      value: formatSeasonDate(season.cancelledAt, locale),
    });
  return (
    <div className="season-detail">
      <SeasonStatusBadge status={season.status} />
      <dl>
        {facts.map(fact => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="season-detail__timezone">{t('detail.timezone', { timezone })}</p>
    </div>
  );
}
