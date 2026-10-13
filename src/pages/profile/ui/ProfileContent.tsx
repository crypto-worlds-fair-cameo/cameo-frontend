import { useTranslation } from 'react-i18next';
import type { AuthenticatedSession } from '@/entities/session';
import { Navigation } from '@/shared/ui/navigation';
import { useProfileTab } from '../model/useProfileTab';
import { JoinedCanvases } from './JoinedCanvases';
import { MySeasons } from './MySeasons';
import { ProfileHeader } from './ProfileHeader';
import { ProfileOverview } from './ProfileOverview';

/** 로그인한 사용자의 프로필. 왼쪽 탭 메뉴와 탭별 섹션을 조합한다. */
export function ProfileContent({ session }: { session: AuthenticatedSession }) {
  const { t } = useTranslation('profile');
  const { tab, hrefs, select } = useProfileTab();
  const walletAddress = session.activeWallet.address;

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
        {/* 시안처럼 참여한 캔버스 탭에서는 상단 버튼 없이 목록만 보여준다. */}
        <ProfileHeader
          user={session.user}
          walletAddress={walletAddress}
          showActions={tab !== 'joined'}
          onShowJoined={() => select(hrefs.joined)}
        />
        {tab === 'profile' && (
          <ProfileOverview
            userId={session.user.id}
            walletAddress={walletAddress}
            createdAt={session.user.createdAt}
          />
        )}
        {tab === 'seasons' && <MySeasons userId={session.user.id} />}
        {tab === 'joined' && <JoinedCanvases userId={session.user.id} />}
      </div>
    </div>
  );
}
