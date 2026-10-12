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
      {seasons.length === 0 ? (
        <p className="profile-empty">{t('seasons.empty')}</p>
      ) : (
        <ul className="profile-list">
          {seasons.map(season => (
            <li key={season.id}>
              <MediaListItem
                media={<SeasonThumbnail thumbnail={season.thumbnail} />}
                title={season.title}
                description={[
                  formatDateRange(season.startsAt, season.endsAt, i18n.language),
                  t('seasons.participants', { count: season.participantCount }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                action={
                  <div className="profile-list-actions">
                    {/* NFT 발행·수령은 참여한 캔버스의 NFT 카드가 맡는다. */}
                    {season.status === 'active' ? (
                      <span className="profile-status profile-status--active">
                        <img src="/images/profile/status-active.svg" alt="" aria-hidden="true" />
                        {t('status.active')}
                      </span>
                    ) : (
                      <StatusBadge status={season.status}>
                        {t(`status.${season.status}`)}
                      </StatusBadge>
                    )}
                    {/* 샘플 항목의 화살표는 이동 가능한 실제 시즌이 연결될 때까지 장식으로 표시한다. */}
                    <img
                      className="profile-season-chevron"
                      src="/images/profile/season-chevron.svg"
                      alt=""
                      aria-hidden="true"
                    />
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
