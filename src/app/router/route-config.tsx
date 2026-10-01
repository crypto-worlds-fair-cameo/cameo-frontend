import { lazy } from 'react';
import type { ReactNode } from 'react';
import { House } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { MenuTranslationKey } from '@/app/menu/Menu.types';

const UiPage = lazy(() => import('@/pages/ui/UiPage'));
const MainCanvasPage = lazy(() => import('@/pages/main-canvas/MainCanvasPage'));
const SeasonCanvasPage = lazy(() => import('@/pages/season-canvas/SeasonCanvasPage'));
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
}

export const appRoutes: AppRouteDefinition[] = [
  {
    path: '/ui',
    title: '공통 UI',
    translationKey: 'ui',
    description: 'Cameo 공통 디자인 토큰과 컴포넌트 카탈로그',
    element: <UiPage />,
    noIndex: true,
    showInNavigation: true,
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
