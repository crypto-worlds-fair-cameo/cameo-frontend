import '@/app/layout/layout.css';
import { Suspense, useEffect, useRef } from 'react';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { useRouteScroll } from './model/useRouteScroll';
import { Outlet, useLocation } from 'react-router';
import { RouteLoading } from '@/shared/ui/loading/index';
import { menuConfig } from '@/app/menu/Menu.data';
import Footer from '@/app/layout/Footer';
import Header from '@/app/layout/header/index';
import { MenuLeft } from '@/app/menu/left/index';
import { SidebarInset, SidebarProvider } from '@/shared/ui/sidebar';

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
    const { key } = useLocation();
    const mainRef = useRef<HTMLElement>(null);
    useRouteScroll(mode, mainRef);
    useEffect(() => {
        const html = document.documentElement;
        html.dataset.scrollMode = mode;

        return () => {
            if (html.dataset.scrollMode === mode) {
                delete html.dataset.scrollMode;
            }
        };
    }, [mode]);

    return (
        <SidebarProvider>
            {showSidebar && <MenuLeft menuItems={menuConfig} />}

            <SidebarInset className="layout-shell" data-mode={mode} data-frame={frame}>
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

                {showFooter && mode === 'web' && <Footer />}
            </SidebarInset>
        </SidebarProvider>
    );
};

export default Layout;
