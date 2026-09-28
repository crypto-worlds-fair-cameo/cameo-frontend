import { lazy } from 'react';
import { siteConfig, layoutPresets } from '../config/site';
import type { ReactNode } from 'react';
import { House } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const UiPage = lazy(() => import('@/pages/ui/UiPage'));
const HomePage = lazy(() => import('@/pages/home/HomePage'));
const NotFoundPage = lazy(() => import('@/pages/not-found/NotFoundPage'));

export interface AppRouteDefinition {
  path: string;
  title: string;
  description: string;
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
    description: 'Cameo 공통 디자인 토큰과 컴포넌트 카탈로그',
    element: <UiPage />,
    noIndex: true,
    showInNavigation: true,
  },
  {
    path: '/',
    title: '시작 가이드',
    description: '보일러플레이트 구조와 다음 프로젝트 시작 체크리스트를 확인합니다.',
    seoTitle: 'React Nest Boilerplate',
    seoDescription:
      'React Nest Boilerplate starter overview with layout presets, routing structure, shared UI conventions, and project startup guidance.',
    seoKeywords:
      'React Nest Boilerplate, frontend starter, route config, layout preset, React Vite starter',
    icon: House,
    element: (
      <HomePage
        repositoryLabel={siteConfig.repositoryLabel}
        description={siteConfig.description}
        activePresetKey={siteConfig.layoutPreset}
        layoutPresets={layoutPresets}
      />
    ),
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
