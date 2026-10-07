import { lazy } from 'react';
import type { ReactNode } from 'react';
import { House } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MenuTranslationKey } from '@/app/menu/Menu.types';

const MainCanvasPage = lazy(() => import('@/pages/main-canvas/MainCanvasPage'));
const SeasonCanvasPage = lazy(() => import('@/pages/season-canvas/SeasonCanvasPage'));
const SeasonWorkspacePage = lazy(() => import('@/pages/season-canvas/SeasonWorkspacePage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const NotFoundPage = lazy(() => import('@/pages/not-found/NotFoundPage'));

export interface AppRouteDefinition {
  path: string;
  title: string;
  description: string;
  translationKey?: MenuTranslationKey;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoImage?: string;
  noIndex?: boolean;
  icon?: LucideIcon;
  element: ReactNode;
  showInNavigation?: boolean;
  // 지정된 라우트에만 작업 영역 레이아웃을 적용한다. 미지정 라우트는 기본 레이아웃을 쓴다.
  contentLayout?: 'canvas';
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: '/season-canvas/:seasonId',
    title: '시즌 캔버스 작업 공간',
    description: '시즌별 실시간 관람과 그리기',
    element: <SeasonWorkspacePage />,
    contentLayout: 'canvas',
  },
  {
    path: '/',
    title: '메인 캔버스',
    translationKey: 'mainCanvas',
    description: '메인 캔버스 페이지',
    seoTitle: '메인 캔버스',
    seoDescription: '메인 캔버스 페이지',
    icon: House,
    element: <MainCanvasPage />,
    contentLayout: 'canvas',
    showInNavigation: true,
  },
  {
    path: '/season-canvas',
    title: '시즌 캔버스',
    translationKey: 'seasonCanvas',
    description: '시즌 캔버스 페이지',
    seoTitle: '시즌 캔버스',
    seoDescription: '시즌 캔버스 페이지',
    element: <SeasonCanvasPage />,
    showInNavigation: true,
  },
  {
    // 시안의 상단 메뉴에는 없으므로 메뉴에 표시하지 않는다. 진입 버튼 위치는 별도로 정한다.
    path: '/profile',
    title: '프로필',
    description: '내 프로필, 만든 시즌과 참여한 캔버스',
    element: <ProfilePage />,
    noIndex: true,
  },
];

export const navigationItems = appRoutes.filter(route => route.showInNavigation);

export const fallbackRoute: AppRouteDefinition = {
  path: '*',
  title: '찾을 수 없음',
  description: '정의되지 않은 경로에 대한 기본 fallback 페이지입니다.',
  seoTitle: 'Page Not Found | React Nest Boilerplate',
  seoDescription:
    'The requested page could not be found in the React Nest Boilerplate frontend starter.',
  seoKeywords: 'React Nest Boilerplate, page not found, 404',
  noIndex: true,
  element: <NotFoundPage />,
};
