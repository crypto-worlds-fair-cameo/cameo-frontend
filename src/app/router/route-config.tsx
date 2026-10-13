import { lazy } from 'react';
import type { ReactNode } from 'react';
import { House } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ContentWidth } from '@/app/layout/Layout';
import type { MenuTranslationKey } from '@/app/menu/Menu.types';

const MainCanvasPage = lazy(() => import('@/pages/main-canvas/MainCanvasPage'));
const SeasonCanvasPage = lazy(() => import('@/pages/season-canvas/SeasonCanvasPage'));
const SeasonWorkspacePage = lazy(() => import('@/pages/season-canvas/SeasonWorkspacePage'));
const HistoryPage = lazy(() => import('@/pages/history/HistoryPage'));
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
  /** 시안이 화면 폭 전체를 쓰는 라우트만 지정한다. 미지정 라우트는 레이아웃 기본 폭을 쓴다. */
  contentWidth?: ContentWidth;
  /** 시즌 도화지처럼 화면 안에 자체 나가기·계정이 있으면 공통 헤더를 두지 않는다. */
  showHeader?: boolean;
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: '/season-canvas/:seasonId',
    title: 'Season canvas workspace',
    description: 'Live viewing and drawing for a season',
    element: <SeasonWorkspacePage />,
    contentLayout: 'canvas',
    showHeader: false,
  },
  {
    path: '/',
    title: 'Main Canvas',
    translationKey: 'mainCanvas',
    description: 'Main canvas page',
    seoTitle: 'Main Canvas',
    seoDescription: 'Main canvas page',
    icon: House,
    element: <MainCanvasPage />,
    contentLayout: 'canvas',
    showInNavigation: true,
  },
  {
    path: '/season-canvas',
    title: 'Season Canvas',
    translationKey: 'seasonCanvas',
    description: 'Season canvas page',
    seoTitle: 'Season Canvas',
    seoDescription: 'Season canvas page',
    element: <SeasonCanvasPage />,
    showInNavigation: true,
  },
  {
    path: '/history',
    title: 'History',
    translationKey: 'history',
    description: 'Main canvas snapshot history',
    seoTitle: 'Snapshot history',
    seoDescription: 'Time-based snapshots of the main canvas',
    element: <HistoryPage />,
    showInNavigation: true,
  },
  {
    // 시안의 상단 메뉴에는 없으므로 메뉴에 표시하지 않는다. 진입 버튼 위치는 별도로 정한다.
    path: '/profile',
    title: 'Profile',
    description: 'Your profile, seasons you created, and canvases you joined',
    element: <ProfilePage />,
    contentWidth: 'full',
    noIndex: true,
  },
];

export const navigationItems = appRoutes.filter(route => route.showInNavigation);

export const fallbackRoute: AppRouteDefinition = {
  path: '*',
  title: 'Page not found',
  description: 'Fallback page for an undefined route.',
  seoTitle: 'Page Not Found | React Nest Boilerplate',
  seoDescription:
    'The requested page could not be found in the React Nest Boilerplate frontend starter.',
  seoKeywords: 'React Nest Boilerplate, page not found, 404',
  noIndex: true,
  element: <NotFoundPage />,
};
