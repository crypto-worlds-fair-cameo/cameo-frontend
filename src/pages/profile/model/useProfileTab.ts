import { useLocation, useNavigate, useSearchParams } from 'react-router';

const profileTabs = ['profile', 'seasons', 'joined'] as const;
export type ProfileTab = (typeof profileTabs)[number];

/**
 * 선택한 탭을 `?tab=`에 남겨 새로고침·뒤로 가기·링크 공유에서도 같은 탭을 연다.
 * 기본 탭은 query 없이 페이지 주소만 사용한다. 알 수 없는 값은 기본 탭으로 처리한다.
 */
export function useProfileTab() {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const value = searchParams.get('tab');
  const tab: ProfileTab = profileTabs.find(item => item === value) ?? 'profile';
  const hrefs: Record<ProfileTab, string> = {
    profile: pathname,
    seasons: `${pathname}?tab=seasons`,
    joined: `${pathname}?tab=joined`,
  };

  return { tab, hrefs, select: (href: string) => navigate(href) };
}
