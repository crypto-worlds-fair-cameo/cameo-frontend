import type { MenuItem } from '@/app/menu/index';
import { useLocation, useNavigate } from 'react-router';
import { Navigation } from '@/shared/ui/navigation';

interface HeaderNavProps {
  menuItems: MenuItem[];
  stacked?: boolean;
  onNavigate?: () => void;
}

const HeaderNav = ({ menuItems, stacked = false, onNavigate }: HeaderNavProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className={stacked ? undefined : 'layout-header-nav hidden lg:block'}>
      <Navigation
        label="주 메뉴"
        items={menuItems.map(item => ({ href: item.path, label: item.title }))}
        activeHref={pathname}
        variant={stacked ? 'sidebar' : 'top'}
        onNavigate={path => {
          navigate(path);
          onNavigate?.();
        }}
      />
    </div>
  );
};

export default HeaderNav;
