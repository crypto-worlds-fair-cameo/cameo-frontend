import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SeasonNftClaimCard, type SeasonNftSummary } from '@/features/season-nft-claim';
import { Button } from '@/shared/ui/button';
import { MediaListItem } from '@/shared/ui/list-item';
import { StatusBadge } from '@/shared/ui/status-badge';
import { useParticipatedSeasonsQuery } from '../api/profile.queries';
import { formatDateRange } from '../lib/profileFormat';
import { SeasonThumbnail } from './SeasonThumbnail';

/**
 * 시안의 목록은 한 줄씩만 보이므로, NFT 카드는 지금 받을 수 있거나 받는 중일 때만 붙인다.
 * 시즌 진행 중·준비 중·기능 꺼짐·수령 대상 아님에는 할 일이 없고, 받은 뒤에는 날짜 줄로 알린다.
 */
function needsNftCard({ availability, claim }: SeasonNftSummary) {
  if (claim.state === 'PROCESSING') return true;
  return (
    availability === 'READY' && claim.eligibility === 'ELIGIBLE' && claim.state === 'UNCLAIMED'
  );
}

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
    <section className="profile-section profile-joined" aria-labelledby={titleId}>
      <div className="profile-section-header">
        <h2 id={titleId}>{t('joined.title')}</h2>
        <img
          className="profile-section-rule"
          src="/images/profile/section-rule.svg"
          alt=""
          aria-hidden="true"
        />
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
                      thumbnail={['#4fb3ff', '#5ec44f']}
                      imageUrl={canvas.finalImageUrl}
                    />
                  }
                  title={canvas.title}
                  description={[
                    formatDateRange(canvas.startsAt, canvas.endsAt, i18n.language),
                    canvas.nft.claim.state === 'CLAIMED' ? t('joined.minted') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  action={
                    <div className="profile-list-actions">
                      <span className="profile-strokes">
                        <span className="profile-stroke-count">{canvas.ownStrokeCount}</span>{' '}
                        {t('joined.strokeLabel', { count: canvas.ownStrokeCount })}
                      </span>
                      {/* 시안의 진행 중 표시는 아이콘 배지, 그 밖의 상태는 공통 배지를 쓴다. */}
                      {canvas.lifecycleStatus === 'active' ? (
                        <span className="profile-status profile-status--active">
                          <img src="/images/profile/status-active.svg" alt="" aria-hidden="true" />
                          {t('status.active')}
                        </span>
                      ) : (
                        <StatusBadge status={canvas.lifecycleStatus}>
                          {t(`status.${canvas.lifecycleStatus}`)}
                        </StatusBadge>
                      )}
                    </div>
                  }
                />
                {needsNftCard(canvas.nft) && (
                  <SeasonNftClaimCard
                    seasonId={canvas.seasonId}
                    source="profile"
                    initialSummary={canvas.nft}
                    previewImageUrl={canvas.finalImageUrl}
                  />
                )}
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
