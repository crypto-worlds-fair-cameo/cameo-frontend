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
    path: '/guide',
    title: '안내',
    description: '제한된 획 수 규칙으로 모두가 함께 완성하는 실시간 협업 캔버스',
    seoTitle: 'Cameo',
    seoDescription: '제한된 획 수 규칙으로 모두가 함께 완성하는 실시간 협업 캔버스',
    seoKeywords: 'Cameo, Solana, 협업 캔버스, 시즌 도화지',
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
  seoTitle: '페이지를 찾을 수 없음 | Cameo',
  seoDescription: '요청한 페이지를 Cameo에서 찾을 수 없습니다.',
  seoKeywords: 'Cameo, page not found, 404',
  noIndex: true,
  element: <NotFoundPage />,
};
