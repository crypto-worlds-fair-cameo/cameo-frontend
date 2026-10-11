import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { canRetryCanvasRecovery, type CanvasMode } from '@/features/canvas-workspace';
import { SeasonNftClaimCard } from '@/features/season-nft-claim';
import type { useSeasonWorkspace } from '../model/useSeasonWorkspace';
import { SeasonStatusBadge } from './SeasonStatusBadge';
import { formatSeasonDate, formatSeasonDateRange } from '../lib/seasonDate';
import { useSeasonWorkspaceEnd } from '../model/useSeasonWorkspaceEnd';
import { SeasonEndDialog } from './SeasonEndDialog';
import { SeasonInviteDialog } from './SeasonInviteDialog';

/** 참가 등록과 현재 관람 연결 수를 분리하고 서버 승인·저장 상태를 안내한다. */
export function SeasonWorkspacePanel({
  model,
  mode,
}: {
  model: ReturnType<typeof useSeasonWorkspace>;
  mode: CanvasMode;
}) {
  const { t, i18n } = useTranslation('seasonCanvas');
  const { season, status, realtime, scope } = model;
  const { sync, connection } = realtime;
  const [infoOpen, setInfoOpen] = useState(true);
  const [inviteVersion, setInviteVersion] = useState<number | null>(null);
  const management = useSeasonWorkspaceEnd(scope, model.query);
  const isOwner = Boolean(
    model.isOwner && scope.isReady && scope.session?.user.id === season?.creatorId
  );
  const canShare =
    isOwner && !model.query.isError && (status === 'active' || status === 'scheduled');
  const hostName = isOwner ? scope.session?.user.displayName?.trim() : undefined;
  const errorKey =
    sync.error?.code === 'STROKE_LIMIT_REACHED'
      ? 'limitReached'
      : sync.error?.code === 'SEASON_DRAWING_DISABLED'
        ? 'drawingDisabled'
        : ['AUTH_REQUIRED', 'USER_UNAVAILABLE'].includes(sync.error?.code ?? '')
          ? 'login'
          : sync.error?.code === 'SEASON_PARTICIPATION_REQUIRED'
            ? 'joinRequired'
            : sync.error?.code === 'SEASON_NOT_ACTIVE'
              ? 'readOnly'
              : 'drawingError';
  return (
    <section className="season-workspace-panel" aria-label={t('workspace.info')}>
      <div className="season-workspace-info">
        <div className="season-workspace-info-heading">
          <span>{t('workspace.info')}</span>
          {isOwner && (
            <span className="season-workspace-host-badge">{t('workspace.hostBadge')}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('workspace.info')}
            aria-expanded={infoOpen}
            onClick={() => setInfoOpen(open => !open)}
          >
            {infoOpen ? (
              <img src="/images/season-info-collapse.svg" alt="" width={19} height={2} />
            ) : (
              <Plus aria-hidden="true" />
            )}
          </Button>
        </div>
        {infoOpen && (
          <>
            <h1>{season?.title ?? t('workspace.title')}</h1>
            {status && status !== 'active' && <SeasonStatusBadge status={status} />}
            {season && (
              <dl>
                {hostName && (
                  <div>
                    <dt>{t('workspace.host')}</dt>
                    <dd>{hostName}</dd>
                  </div>
                )}
                <div>
                  <dt>{t('workspace.duration')}</dt>
                  <dd
                    title={`${formatSeasonDate(season.startsAt, i18n.language)} – ${formatSeasonDate(season.forceEndedAt ?? season.endsAt, i18n.language)}`}
                  >
                    {formatSeasonDateRange(
                      season.startsAt,
                      model.boundary?.forceEndedAt ?? season.forceEndedAt ?? season.endsAt,
                      i18n.language
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('workspace.participants')}</dt>
                  <dd>{season.participantCount}</dd>
                </div>
                <div>
                  <dt>{t('workspace.brushStrokes')}</dt>
                  <dd>
                    {season.strokeLimitPerUser === null
                      ? t('detail.unlimited')
                      : t('detail.perPerson', { count: season.strokeLimitPerUser })}
                  </dd>
                </div>
                {(model.boundary?.cancelledAt ?? season.cancelledAt) && (
                  <div>
                    <dt>{t('detail.cancelledAt')}</dt>
                    <dd>
                      {formatSeasonDate(
                        (model.boundary?.cancelledAt ?? season.cancelledAt)!,
                        i18n.language
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </>
        )}
      </div>
      {canShare && season && (
        <div className="season-workspace-host-actions">
          <Button variant="secondary" onClick={() => setInviteVersion(scope.resetVersion)}>
            {t('workspace.shareInvite')}
          </Button>
          {season.canEnd && status === 'active' && (
            <Button
              variant="secondary"
              className="season-workspace-end-button"
              disabled={!scope.isReady || model.query.isFetching}
              loading={management.isPreparing || management.isEnding}
              onClick={() => void management.open()}
            >
              {t('workspace.forceEnd')}
            </Button>
          )}
        </div>
      )}
      {management.error && <p role="alert">{t(`errors.${management.error}`)}</p>}
      {model.query.isLoading && <p role="status">{t('detail.loading')}</p>}
      {model.query.isError && (
        <div role="alert">
          <p>{t('detail.error')}</p>
          <Button size="sm" variant="secondary" onClick={() => void model.query.refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}
      {scope.sessionQuery.isError && (
        <div role="alert">
          <p>{t('sessionError')}</p>
          <Button size="sm" variant="secondary" onClick={() => void scope.sessionQuery.refetch()}>
            {t('retry')}
          </Button>
        </div>
      )}
      <p className={connection.status === 'ready' ? 'sr-only' : undefined} role="status">
        {t(`workspace.connection.${connection.status}`)}
      </p>
      {connection.notice && (
        <p role={connection.status === 'failed' ? 'alert' : 'status'}>
          {t(`workspace.notices.${connection.notice}`)}
        </p>
      )}
      {sync.status === 'recovering' && <p role="status">{t('workspace.recovering')}</p>}
      {sync.error && (
        <div role="alert">
          <p>{t(`workspace.${errorKey}`)}</p>
          {canRetryCanvasRecovery(sync.error.code) && (
            <Button size="sm" variant="secondary" onClick={realtime.retryRecovery}>
              {t('retry')}
            </Button>
          )}
        </div>
      )}
      {sync.retry && <p role="status">{t('workspace.retrying')}</p>}
      {sync.submissionStatus === 'saving' && <p role="status">{t('workspace.saving')}</p>}
      {sync.submissionStatus === 'saved' && <p role="status">{t('workspace.saved')}</p>}
      {mode === 'practice' ? (
        <p>{t('workspace.practiceNotice')}</p>
      ) : !scope.session ? (
        <p>{t('workspace.login')}</p>
      ) : status !== 'active' ? (
        <p>{t('workspace.readOnly')}</p>
      ) : !model.isParticipant ? (
        <p>{t('workspace.joinRequired')}</p>
      ) : !model.canDraw && !sync.error ? (
        <p>{t('workspace.readOnly')}</p>
      ) : null}
      {scope.session && status === 'active' && !model.isParticipant && (
        <>
          <Button
            disabled={!model.canJoin || model.join.isJoining}
            loading={model.join.isJoining}
            onClick={() => void model.join.join()}
          >
            {t('workspace.join')}
          </Button>
          {season && season.participantCount >= season.capacity && (
            <p>{t('errors.capacityReached')}</p>
          )}
        </>
      )}
      {model.join.error && <p role="alert">{t(`errors.${model.join.error}`)}</p>}
      {season && <SeasonNftClaimCard seasonId={season.id} source="workspace" />}
      <span className="sr-only">{t('workspace.rule')}</span>
      {season && (
        <SeasonInviteDialog
          open={inviteVersion === scope.resetVersion && canShare}
          season={season}
          onOpenChange={open => !open && setInviteVersion(null)}
        />
      )}
      <SeasonEndDialog
        open={management.target !== null}
        title={management.target?.title ?? ''}
        participantCount={management.target?.participantCount ?? 0}
        canConfirm={Boolean(
          isOwner && season?.canEnd && status === 'active' && !model.query.isError
        )}
        loading={management.isEnding}
        onOpenChange={open => !open && management.close()}
        onConfirm={() => void management.confirm()}
      />
    </section>
  );
}
