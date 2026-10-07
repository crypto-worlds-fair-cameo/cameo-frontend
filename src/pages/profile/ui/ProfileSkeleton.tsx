import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/shared/ui/skeleton';

const pulse = 'motion-reduce:animate-none';

/** 세션 확인 전 전체 프로필 자리. 실제 화면과 같은 배치로 표시해 레이아웃 이동을 줄인다. */
export function ProfileSkeleton() {
  const { t } = useTranslation('profile');
  return (
    <div className="profile-page" role="status" aria-busy="true" aria-label={t('loading')}>
      <div className="profile-sidebar">
        <Skeleton className={`h-10 w-full ${pulse}`} />
      </div>
      <div className="profile-main">
        <div className="profile-header">
          <Skeleton className={`size-16 rounded-full ${pulse}`} />
          <Skeleton className={`h-6 w-40 ${pulse}`} />
        </div>
        <ActivitySkeleton />
      </div>
    </div>
  );
}

/** 활동 목록 조회 중 자리. 상태 안내는 감싸는 영역이 담당한다. */
export function ActivitySkeleton() {
  return (
    <div className="profile-activity-skeleton" aria-hidden="true">
      <Skeleton className={`h-24 w-full ${pulse}`} />
      <Skeleton className={`h-40 w-full ${pulse}`} />
    </div>
  );
}
