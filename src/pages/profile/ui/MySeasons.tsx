import { useId } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { MediaListItem } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import type { ProfileSeason } from '../api/profile.api';
import { formatDateRange } from '../lib/profileFormat';
import { SeasonThumbnail } from './SeasonThumbnail';

/** 아직 API가 없는 내가 만든 시즌 샘플 목록을 표시한다. */
export function MySeasons({ seasons }: { seasons: ProfileSeason[] }) {
  const { t, i18n } = useTranslation('profile');
  const titleId = useId();
  return (
    <section className="profile-section" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('seasons.title')}</h2>
        <Button size="sm" asChild>
          <Link to="/season-canvas">
            <Plus aria-hidden="true" />
            {t('seasons.newSeason')}
          </Link>
        </Button>
      </div>
      {seasons.length === 0 ? (
        <p className="profile-empty">{t('seasons.empty')}</p>
      ) : (
        <ul className="profile-list">
          {seasons.map(season => (
            <li key={season.id}>
              <MediaListItem
                media={<SeasonThumbnail colors={season.thumbnail} />}
                title={season.title}
                description={[
                  formatDateRange(season.startsAt, season.endsAt, i18n.language),
                  t('seasons.participants', { count: season.participantCount }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                action={
                  <div className="profile-list-actions">
                    <StatusBadge status={season.status}>{t(`status.${season.status}`)}</StatusBadge>
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
