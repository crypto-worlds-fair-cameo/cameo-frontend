import '@/app/layout/layout.css';
import { Suspense, useEffect, useRef } from 'react';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { useRouteScroll } from './model/useRouteScroll';
import { Outlet, useLocation, matchPath } from 'react-router';
import { RouteLoading } from '@/shared/ui/loading/index';
import { menuConfig } from '@/app/menu/Menu.data';
import Footer from '@/app/layout/Footer';
import Header from '@/app/layout/header/index';
import { MenuLeft } from '@/app/menu/left/index';
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar';
import { appRoutes } from '@/app/router/route-config';

export type LayoutMode = 'web' | 'mobile';
export type LayoutFrame = 'full' | 'mobile' | 'tablet' | 'laptop' | 'desktop';
export type ContentWidth = 'compact' | 'content' | 'wide' | 'full';

export interface LayoutProps {
  mode?: LayoutMode;
  frame?: LayoutFrame;
  contentWidth?: ContentWidth;
  showHeader?: boolean;
  showSidebar?: boolean;
  showFooter?: boolean;
}

const Layout = ({
  mode = 'web',
  frame = 'full',
  contentWidth = 'wide',
  showHeader = true,
  showSidebar = true,
  showFooter = true,
}: LayoutProps) => {
  const { key, pathname } = useLocation();
  // 페이지가 app을 참조하지 않도록, 바깥 레이아웃 선택은 app의 라우트 메타데이터로 관리한다.
  const isCanvas = appRoutes.some(
    route =>
      matchPath({ path: route.path, end: true }, pathname) && route.contentLayout === 'canvas'
  );
  // 캔버스는 기기 종류와 관계없이 화면 높이를 고정한다. 기존 mobile 모드의 문서 스크롤
  // 잠금과 main 스크롤 소유권을 재사용하고, 캔버스 전용 CSS에서 main의 스크롤도 막는다.
  const scrollMode = isCanvas ? 'mobile' : mode;
  const mainRef = useRef<HTMLElement>(null);
  useRouteScroll(scrollMode, mainRef);
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.scrollMode = scrollMode;

    return () => {
      // 라우트 전환 시 캔버스의 스크롤 설정이 일반 페이지에 남지 않도록 정리한다.
      if (html.dataset.scrollMode === scrollMode) {
        delete html.dataset.scrollMode;
      }
    };
  }, [scrollMode]);

  return (
    <SidebarProvider>
      {showSidebar && <MenuLeft menuItems={menuConfig} />}

      <SidebarInset
        className="layout-shell"
        data-mode={scrollMode}
        data-frame={frame}
        data-content-layout={isCanvas ? 'canvas' : undefined}
      >
        {showHeader && <Header menuItems={menuConfig} showSidebar={showSidebar} />}

        <main ref={mainRef} className="layout-main">
          <div className="layout-content" data-content-width={contentWidth}>
            <ErrorBoundary resetKey={key} scope="page">
              <Suspense fallback={<RouteLoading />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        {/* 캔버스는 헤더 아래 전체 공간을 사용한다. 일반 페이지에는 기존 푸터 설정을 적용한다. */}
        {showFooter && mode === 'web' && !isCanvas && <Footer />}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
