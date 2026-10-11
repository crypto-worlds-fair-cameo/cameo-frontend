import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SeasonNftClaimCard } from '@/features/season-nft-claim';
import { Button } from '@/shared/ui/button';
import { MediaListItem } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import { useParticipatedSeasonsQuery } from '../api/profile.queries';
import { formatDateRange } from '../lib/profileFormat';
import { SeasonThumbnail } from './SeasonThumbnail';

/** 실제 참여 시즌 목록과 각 시즌의 서버 기준 NFT 수령 상태를 함께 표시한다. */
export function JoinedCanvases({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation('profile');
  const titleId = useId();
  const query = useParticipatedSeasonsQuery(userId);
  const canvases = useMemo(() => {
    const unique = new Map<
      string,
      NonNullable<typeof query.data>['pages'][number]['items'][number]
    >();
    for (const page of query.data?.pages ?? []) {
      for (const canvas of page.items) unique.set(canvas.seasonId, canvas);
    }
    return [...unique.values()];
  }, [query.data]);

  return (
    <section className="profile-section" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('joined.title')}</h2>
      </div>
      {query.isPending ? (
        <p className="profile-empty" role="status">
          {t('joined.loading')}
        </p>
      ) : query.isError && canvases.length === 0 ? (
        <div className="profile-activity-error" role="alert">
          <p>{t('joined.error')}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t('activityError.retry')}
          </Button>
        </div>
      ) : canvases.length === 0 ? (
        <div className="profile-empty">
          <p>{t('joined.empty')}</p>
          <Button variant="secondary" size="sm" asChild>
            <Link to="/season-canvas">{t('joined.browse')}</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="profile-list profile-joined-list">
            {canvases.map(canvas => (
              <li key={canvas.seasonId}>
                <MediaListItem
                  media={
                    <SeasonThumbnail
                      colors={['#4fb3ff', '#5ec44f']}
                      imageUrl={canvas.finalImageUrl}
                    />
                  }
                  title={canvas.title}
                  description={formatDateRange(canvas.startsAt, canvas.endsAt, i18n.language)}
                  action={
                    <div className="profile-list-actions">
                      <span className="profile-strokes">
                        {t('joined.strokes', { count: canvas.ownStrokeCount })}
                      </span>
                      <StatusBadge status={canvas.lifecycleStatus}>
                        {t(`status.${canvas.lifecycleStatus}`)}
                      </StatusBadge>
                    </div>
                  }
                />
                <SeasonNftClaimCard
                  seasonId={canvas.seasonId}
                  source="profile"
                  initialSummary={canvas.nft}
                  previewImageUrl={canvas.finalImageUrl}
                />
              </li>
            ))}
          </ul>
          {query.hasNextPage && (
            <Button
              variant="secondary"
              size="sm"
              loading={query.isFetchingNextPage}
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t('joined.loadMore')}
            </Button>
          )}
          {query.isError && (
            <p className="profile-list-warning" role="alert">
              {t('joined.refreshError')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
