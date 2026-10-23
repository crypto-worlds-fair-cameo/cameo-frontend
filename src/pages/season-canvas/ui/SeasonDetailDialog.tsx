import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { SeasonNftClaimCard, useSeasonNftClaimState } from '@/features/season-nft-claim';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Skeleton } from '@/shared/ui/skeleton';
import { SeasonRequestError, type Season } from '../api/seasons.types';
import type { SeasonErrorKey } from '../lib/seasonErrors';
import { formatSeasonDate, formatSeasonDateRange, formatSeasonDateTime } from '../lib/seasonDate';
import { formatSol } from '../lib/seasonForm';
import type { SeasonManageAction } from '../model/useSeasonDetail';
import { restoreDialogFocus } from './restoreDialogFocus';
import { SeasonPreview } from './SeasonPreview';
import { SeasonEndDialog } from './SeasonEndDialog';

interface SeasonDetailDialogProps {
  selectedId: string | null;
  preview?: Season;
  query: UseQueryResult<Season, Error>;
  manageAction: SeasonManageAction | null;
  manageError: SeasonErrorKey | null;
  isManaging: boolean;
  isRefreshingManagement: boolean;
  canInteract: boolean;
  isJoining: boolean;
  onClose: () => void;
  onJoin: (season: Season) => void;
  onBrowseLive: () => void;
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
  // 세션 경계가 준비되고 최신 상세가 확인된 시즌에만 참가·입장·보기 동작을 연다.
  const actionable = season && props.canInteract && !props.query.isError ? season : undefined;
  // 종료·예약·취소 시즌은 버튼 위에 현재 상태를 한 줄로 안내한다.
  const statusNotice =
    season?.status === 'ended'
      ? t('detail.endedNotice')
      : season?.status === 'scheduled'
        ? t('detail.opensAt', { date: formatSeasonDate(season.startsAt, i18n.language) })
        : season?.status === 'cancelled'
          ? t('detail.cancelledNotice')
          : null;
  // 404가 아니면 목록의 미리보기로 제목을 먼저 보여 주고, 조회된 상세로 갱신한다.
  const summary = notFound ? undefined : (season ?? props.preview);
  const nftClaim = useSeasonNftClaimState(actionable?.id, actionable?.status === 'ended');
  const [claimOpenFor, setClaimOpenFor] = useState<string | null>(null);
  const claimOpen = actionable?.status === 'ended' && claimOpenFor === actionable.id;
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
            restoreDialogFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
          }}
        >
          {/* 관리 요청 중에는 닫기를 막되, 스크롤 위치와 관계없이 상단 닫기 버튼을 표시한다. */}
          <DialogCloseButton aria-label={t('detail.close')} disabled={props.isManaging} />
          <div className="season-detail-layout">
            <SeasonPreview
              seasonId={summary?.id}
              status={summary?.status}
              variant="detail"
              live={summary && { requiresSession: summary.entryRule === 'wallet_holders' }}
              className="season-detail__preview"
            />
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
              {statusNotice && !props.query.isError && (
                <p className="season-detail__notice">{statusNotice}</p>
              )}
              <DialogFooter className="season-detail__actions">
                {/* 진행 중 시즌은 참가자에게 입장을, 그 밖의 사용자에게 참가를 제공한다. */}
                {actionable?.status === 'active' &&
                  (actionable.isParticipant ? (
                    <Button asChild>
                      <Link to={`/season-canvas/${actionable.id}`}>{t('detail.enter')}</Link>
                    </Button>
                  ) : (
                    <Button
                      variant="web3"
                      loading={props.isJoining}
                      onClick={() => props.onJoin(actionable)}
                    >
                      {props.isJoining
                        ? t('detail.joining')
                        : actionable.entryFeeLamports === '0'
                          ? t('detail.join')
                          : t('detail.joinFor', {
                              amount: formatSol(actionable.entryFeeLamports),
                            })}
                    </Button>
                  ))}
                {/* 종료된 시즌의 완성된 캔버스는 누구나 볼 수 있다. */}
                {actionable?.status === 'ended' && (
                  <Button asChild>
                    <Link to={`/season-canvas/${actionable.id}`}>{t('detail.view')}</Link>
                  </Button>
                )}
                {/* 받을 수 있거나 받는 중인 참가자에게만 보이고, 누르면 비용 안내와 서명 단계가 있는 수령 카드로 바뀐다. */}
                {actionable?.status === 'ended' &&
                  !claimOpen &&
                  (nftClaim === 'claimable' || nftClaim === 'processing') && (
                    <Button variant="web3" onClick={() => setClaimOpenFor(actionable.id)}>
                      {t('detail.claimNft')}
                    </Button>
                  )}
                {claimOpen && (
                  <SeasonNftClaimCard seasonId={actionable.id} source="detail" autoStart />
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
                {actionable?.status === 'ended' ? (
                  <Button variant="secondary" onClick={props.onBrowseLive}>
                    {t('detail.browseLive')}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                ) : (
                  <DialogClose asChild>
                    <Button variant="secondary" disabled={props.isManaging}>
                      {t('detail.close')}
                    </Button>
                  </DialogClose>
                )}
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={props.manageAction === 'cancel'}
        onOpenChange={open => !open && props.onCloseManage()}
        title={t('manage.cancelTitle')}
        description={t('manage.cancelDescription', {
          title: season?.title ?? props.preview?.title ?? '',
        })}
        confirmLabel={t('manage.cancelConfirm')}
        cancelLabel={t('manage.close')}
        loading={props.isManaging}
        onConfirm={() => void props.onConfirmManage()}
      />
      <SeasonEndDialog
        open={props.manageAction === 'end'}
        title={season?.title ?? props.preview?.title ?? ''}
        participantCount={season?.participantCount ?? props.preview?.participantCount ?? 0}
        canConfirm={Boolean(actionable?.canEnd)}
        loading={props.isManaging}
        onOpenChange={open => !open && props.onCloseManage()}
        onConfirm={() => void props.onConfirmManage()}
      />
    </>
  );
}

/** 최신 상세의 기간, 1인당 획 제한과 누적 참가 인원을 간결한 정보 행으로 표시한다. */
function SeasonDetail({ season }: { season: Season }) {
  const { t, i18n } = useTranslation('seasonCanvas');
  // 조기 종료일을 기간에 반영하고, null 획 제한은 무제한으로 표시한다.
  const periodEnd = season.forceEndedAt ?? season.endsAt;
  // 시즌 시각은 항상 UTC로 표시한다.
  const timezone = 'UTC';
  // 기간은 카드와 같은 날짜 범위로 보여 주고, 정확한 시각은 마우스를 올리면 확인한다.
  const exactPeriod = `${formatSeasonDateTime(season.startsAt)} - ${formatSeasonDateTime(periodEnd)}`;
  const facts: { label: string; value: ReactNode }[] = [
    {
      label: t('detail.period'),
      value: (
        <span title={`${exactPeriod} (${t('detail.timezone', { timezone })})`}>
          {formatSeasonDateRange(season.startsAt, periodEnd, i18n.language)}
        </span>
      ),
    },
    {
      label: t('detail.brushStrokes'),
      value:
        season.strokeLimitPerUser === null
          ? t('detail.unlimited')
          : t('detail.perPerson', { count: season.strokeLimitPerUser }),
    },
    {
      label: t('detail.capacity'),
      value: `${season.participantCount}/${season.capacity ?? t('detail.unlimited')}`,
    },
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
