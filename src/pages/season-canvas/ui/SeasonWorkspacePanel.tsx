import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import type { CanvasMode } from '@/features/canvas-workspace';
import type { useSeasonWorkspace } from '../model/useSeasonWorkspace';
import { SeasonStatusBadge } from './SeasonStatusBadge';
import { formatSeasonDate } from '../lib/seasonDate';

/** 참가 등록과 현재 관람 연결 수를 분리하고 서버 승인·저장 상태를 안내한다. */
export function SeasonWorkspacePanel({
  model,
  mode,
}: {
  model: ReturnType<typeof useSeasonWorkspace>;
  mode: CanvasMode;
}) {
  const { t, i18n } = useTranslation('seasonCanvas');
  const { season, ready, status, realtime, scope } = model;
  const { sync, connection } = realtime;
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
    <section className="season-workspace-panel">
      <h1>{season?.title ?? t('workspace.title')}</h1>
      {status && <SeasonStatusBadge status={status} />}
      {season && (
        <dl>
          <div>
            <dt>{t('detail.participants')}</dt>
            <dd>
              {season.participantCount} / {season.capacity}
            </dd>
          </div>
          <div>
            <dt>{t('workspace.connections')}</dt>
            <dd>{connection.status === 'ready' ? connection.connectionCount : '—'}</dd>
          </div>
          <div>
            <dt>{t('detail.dimensions')}</dt>
            <dd>
              {ready
                ? `${ready.season.width} × ${ready.season.height}`
                : `${season.width} × ${season.height}`}
            </dd>
          </div>
          <div>
            <dt>{t('detail.strokeLimit')}</dt>
            <dd>
              {season.strokeLimitPerUser === null
                ? t('units.unlimited')
                : season.strokeLimitPerUser}
            </dd>
          </div>
          <div>
            <dt>{t('detail.startsAt')}</dt>
            <dd>{formatSeasonDate(season.startsAt, i18n.language)}</dd>
          </div>
          <div>
            <dt>{t('detail.scheduledEnd')}</dt>
            <dd>{formatSeasonDate(season.endsAt, i18n.language)}</dd>
          </div>
          {(model.boundary?.forceEndedAt ?? season.forceEndedAt) && (
            <div>
              <dt>{t('detail.actualEnd')}</dt>
              <dd>
                {formatSeasonDate(
                  (model.boundary?.forceEndedAt ?? season.forceEndedAt)!,
                  i18n.language
                )}
              </dd>
            </div>
          )}
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
      <p role="status">{t(`workspace.connection.${connection.status}`)}</p>
      {connection.notice && (
        <p role={connection.status === 'failed' ? 'alert' : 'status'}>
          {t(`workspace.notices.${connection.notice}`)}
        </p>
      )}
      {sync.status === 'recovering' && <p role="status">{t('workspace.recovering')}</p>}
      {sync.error && <p role="alert">{t(`workspace.${errorKey}`)}</p>}
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
      <p className="season-workspace-rule">{t('workspace.rule')}</p>
    </section>
  );
}
