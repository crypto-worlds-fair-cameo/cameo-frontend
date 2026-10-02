import { AppProviders } from './providers/AppProviders';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ErrorBoundary } from './errors/ErrorBoundary';
import { GlobalModal } from '@/shared/ui/modal/index';
import { GlobalLoading } from '@/shared/ui/loading/index';
import { GlobalToast } from '@/shared/ui/toast/index';
import Layout from '@/app/layout/Layout';
import { activeLayoutPreset } from '@/app/config/site';
import { appRoutes, fallbackRoute } from '@/app/router/route-config';
import CanvasPage from '@/pages/canvas/CanvasPage';

function App() {
  return (
    <ErrorBoundary scope="app">
      <AppProviders>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<CanvasPage />} />
            <Route element={<Layout {...activeLayoutPreset} />}>
              {appRoutes.map(route => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
              <Route path={fallbackRoute.path} element={fallbackRoute.element} />
            </Route>
          </Routes>

          <GlobalModal />
          <GlobalLoading />
          <GlobalToast />
        </BrowserRouter>
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
