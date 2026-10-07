import { CircleAlert, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSessionQuery } from '@/entities/session';
import { Button } from '@/shared/ui/button';
import { ErrorState } from '@/shared/ui/error-state/ErrorState';
import { ProfileContent } from './ui/ProfileContent';
import { ProfileSkeleton } from './ui/ProfileSkeleton';
import './ui/profile.css';

/**
 * 프로필 페이지 진입점. 세션 상태에 따라 오류·로딩·미로그인·프로필 화면을 나눈다.
 * 닉네임·사진·지갑 주소는 세션에서 읽고, 닉네임 저장은 기존 API를 사용한다.
 * 가입일·잔액·거래 내역·시즌 목록은 API가 생길 때까지 샘플 요청 함수가 제공한다.
 */
const ProfilePage = () => {
  const { t } = useTranslation('profile');
  const session = useSessionQuery();

  // 한 번도 조회하지 못한 경우만 전체 오류로 처리한다. 재조회 실패는 기존 화면을 유지한다.
  if (session.isError && session.data === undefined) {
    return (
      <ErrorState
        role="alert"
        symbol={<CircleAlert />}
        title={t('error.title')}
        description={t('error.description')}
        actions={<Button onClick={() => void session.refetch()}>{t('error.retry')}</Button>}
      />
    );
  }
  if (session.isPending) return <ProfileSkeleton />;
  // 로그인은 헤더의 지갑 연결이 담당하므로 이 페이지는 안내만 표시한다.
  if (!session.data) {
    return (
      <ErrorState
        symbol={<Wallet />}
        title={t('signedOut.title')}
        description={t('signedOut.description')}
        actions={null}
      />
    );
  }
  return <ProfileContent session={session.data} />;
};

export default ProfilePage;
