import { useId } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { MediaListItem } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import type { ProfileSeason } from '../api/profile.api';
import { formatDateRange } from '../lib/profileFormat';
import { SeasonThumbnail } from './SeasonThumbnail';

/**
 * 내가 만든 시즌. 종료 후 민팅 전이면 NFT 만들기, 민팅 후에는 NFT 보기를 표시한다.
 * NFT 민팅은 블록체인 액션이므로 공통 규칙에 따라 web3 버튼을 사용한다.
 * 민팅·조회 API가 없어 버튼은 연결 예정 안내만 띄운다.
 */
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
                  season.minted ? t('seasons.minted') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                action={
                  <div className="profile-list-actions">
                    {season.status === 'ended' && !season.minted && (
                      <Button variant="web3" size="sm" onClick={() => toast(t('comingSoon'))}>
                        {t('seasons.createNft')}
                      </Button>
                    )}
                    {season.minted && (
                      <Button variant="secondary" size="sm" onClick={() => toast(t('comingSoon'))}>
                        {t('seasons.viewNft')}
                      </Button>
                    )}
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
