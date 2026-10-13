import { useId, useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { MediaListItem } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import type { HostedSeason } from '../api/profile.api';
import { useHostedSeasonsQuery } from '../api/profile.queries';
import { formatDateRange } from '../lib/profileFormat';
import { SeasonThumbnail } from './SeasonThumbnail';

/** 내가 개설한 시즌을 최근 개설순으로 보여 주고, 화살표로 해당 시즌 캔버스에 들어간다. */
export function MySeasons({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation('profile');
  const titleId = useId();
  const query = useHostedSeasonsQuery(userId);
  const seasons = useMemo(() => {
    const unique = new Map<string, HostedSeason>();
    for (const page of query.data?.pages ?? []) {
      for (const season of page.items) unique.set(season.seasonId, season);
    }
    return [...unique.values()];
  }, [query.data]);

  return (
    <section className="profile-section profile-seasons" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('seasons.title')}</h2>
        <Button className="profile-new-season" size="sm" asChild>
          <Link to="/season-canvas">
            <Plus aria-hidden="true" />
            {t('seasons.newSeason')}
          </Link>
        </Button>
        <img
          className="profile-section-rule"
          src="/images/profile/section-rule.svg"
          alt=""
          aria-hidden="true"
        />
      </div>
      {query.isPending ? (
        <p className="profile-empty" role="status">
          {t('seasons.loading')}
        </p>
      ) : query.isError && seasons.length === 0 ? (
        <div className="profile-activity-error" role="alert">
          <p>{t('seasons.error')}</p>
          <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
            {t('activityError.retry')}
          </Button>
        </div>
      ) : seasons.length === 0 ? (
        <p className="profile-empty">{t('seasons.empty')}</p>
      ) : (
        <>
          <ul className="profile-list">
            {seasons.map(season => (
              <li key={season.seasonId}>
                <MediaListItem
                  media={
                    <SeasonThumbnail
                      thumbnail={['#4fb3ff', '#5ec44f']}
                      imageUrl={season.finalImageUrl}
                    />
                  }
                  title={season.title}
                  description={[
                    formatDateRange(season.startsAt, season.endsAt, i18n.language),
                    t('seasons.participants', { count: season.participantCount }),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  action={
                    <div className="profile-list-actions">
                      {season.lifecycleStatus === 'active' ? (
                        <span className="profile-status profile-status--active">
                          <img src="/images/profile/status-active.svg" alt="" aria-hidden="true" />
                          {t('status.active')}
                        </span>
                      ) : (
                        <StatusBadge status={season.lifecycleStatus}>
                          {t(`status.${season.lifecycleStatus}`)}
                        </StatusBadge>
                      )}
                      <Link
                        className="profile-season-link"
                        to={`/season-canvas/${season.seasonId}`}
                        aria-label={t('seasons.open', { title: season.title })}
                      >
                        <img
                          className="profile-season-chevron"
                          src="/images/profile/season-chevron.svg"
                          alt=""
                          aria-hidden="true"
                        />
                      </Link>
                    </div>
                  }
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
              {t('seasons.loadMore')}
            </Button>
          )}
          {query.isError && (
            <p className="profile-list-warning" role="alert">
              {t('seasons.refreshError')}
            </p>
          )}
        </>
      )}
    </section>
  );
}
