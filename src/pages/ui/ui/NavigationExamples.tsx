import { Navigation } from '@/shared/ui/navigation';
import { Tabs } from '@/shared/ui/tabs';
import { useNavigationExamples } from '../model/useCatalogExamples';
import { Demo } from './CatalogSection';

export function NavigationExamples() {
  const state = useNavigationExamples();
  return (
    <>
      <h3 className="catalog-group-title">NAVIGATION</h3>
      <div className="catalog-demo-grid">
        <Demo title="08 · Top Navigation Bar" spec="Space Grotesk Bold · 선택된 페이지 표시" wide>
          <Navigation
            label="상단 내비게이션 예시"
            activeHref={state.top}
            onNavigate={state.setTop}
            items={[
              { href: '#main-canvas', label: 'Main Canvas' },
              { href: '#season-canvas', label: 'Season Canvas' },
              { href: '#history', label: 'History' },
            ]}
          />
          <p className="catalog-demo-muted">선택한 화면: {state.top.slice(1).replace(/-/g, ' ')}</p>
        </Demo>
        <Demo title="09 · Tab Navigation" spec="높이 40px · 선택 밑줄 2px · 방향키 이동" wide>
          <Tabs
            label="캔버스 탭 예시"
            value={state.tab}
            onValueChange={state.setTab}
            items={[
              {
                value: 'main',
                label: 'Main Canvas',
                content: '모든 참여자가 함께 만드는 캔버스입니다.',
              },
              {
                value: 'season',
                label: 'Season Canvas',
                content: '시즌별 작품을 모아 볼 수 있습니다.',
              },
              { value: 'history', label: 'History', content: '지금까지의 그리기 기록입니다.' },
            ]}
          />
        </Demo>
        <Demo title="10 · Sidebar Navigation" spec="선택 Border 1px · Radius 12px">
          <Navigation
            label="사이드 내비게이션 예시"
            variant="sidebar"
            activeHref={state.sidebar}
            onNavigate={state.setSidebar}
            items={[
              { href: '#profile', label: 'Profile' },
              { href: '#my-season', label: 'My Season' },
              { href: '#joined', label: 'Joined' },
            ]}
          />
          <p className="catalog-demo-muted">선택: {state.sidebar.slice(1)}</p>
        </Demo>
      </div>
    </>
  );
}
