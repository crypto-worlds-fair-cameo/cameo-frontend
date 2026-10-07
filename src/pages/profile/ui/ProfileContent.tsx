import { useTranslation } from 'react-i18next';
import type { AuthenticatedSession } from '@/entities/session';
import { Button } from '@/shared/ui/button';
import { Navigation } from '@/shared/ui/navigation';
import { useProfileActivityQuery } from '../api/profile.queries';
import { useProfileTab } from '../model/useProfileTab';
import { JoinedCanvases } from './JoinedCanvases';
import { MySeasons } from './MySeasons';
import { ProfileHeader } from './ProfileHeader';
import { ActivitySkeleton } from './ProfileSkeleton';
import { ProfileSummary } from './ProfileSummary';
import { ProfileTransactions } from './ProfileTransactions';

/** 로그인한 사용자의 프로필. 왼쪽 탭 메뉴와 탭별 섹션을 조합한다. */
export function ProfileContent({ session }: { session: AuthenticatedSession }) {
  const { t } = useTranslation('profile');
  const { tab, hrefs, select } = useProfileTab();
  const activity = useProfileActivityQuery(session.user.id);
  const walletAddress = session.user.wallets.find(
    wallet => wallet.chainNamespace === 'solana'
  )?.address;
  // 시안처럼 참여한 캔버스 탭에서는 요약 카드와 상단 버튼 없이 목록만 보여준다.
  const showOverview = tab !== 'joined';

  return (
    <div className="profile-page">
      <aside className="profile-sidebar">
        <Navigation
          variant="sidebar"
          label={t('navigation.label')}
          activeHref={hrefs[tab]}
          onNavigate={select}
          items={[
            { href: hrefs.profile, label: t('navigation.profile') },
            { href: hrefs.seasons, label: t('navigation.seasons') },
            { href: hrefs.joined, label: t('navigation.joined') },
          ]}
        />
      </aside>
      <div className="profile-main">
        <ProfileHeader
          user={session.user}
          walletAddress={walletAddress}
          showActions={showOverview}
          onShowJoined={() => select(hrefs.joined)}
        />
        <p className="profile-sample-notice">{t('sampleNotice')}</p>
        {activity.isError ? (
          <div className="profile-activity-error" role="alert">
            <p>{t('activityError.message')}</p>
            <Button variant="secondary" size="sm" onClick={() => void activity.refetch()}>
              {t('activityError.retry')}
            </Button>
          </div>
        ) : activity.isPending ? (
          <div role="status" aria-label={t('loading')}>
            <ActivitySkeleton />
          </div>
        ) : (
          <>
            {showOverview && (
              <ProfileSummary
                joinedAt={activity.data.joinedAt}
                balanceSol={activity.data.balanceSol}
              />
            )}
            {tab === 'profile' && <ProfileTransactions transactions={activity.data.transactions} />}
            {tab === 'seasons' && <MySeasons seasons={activity.data.mySeasons} />}
            {tab === 'joined' && <JoinedCanvases canvases={activity.data.joinedCanvases} />}
          </>
        )}
      </div>
    </div>
  );
}
