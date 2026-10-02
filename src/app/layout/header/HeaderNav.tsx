import type { MenuItem } from '@/app/menu/index';
import { useLocation, useNavigate } from 'react-router';
import { Navigation } from '@/shared/ui/navigation';
import { useTranslation } from 'react-i18next';

interface HeaderNavProps {
  menuItems: MenuItem[];
  stacked?: boolean;
  onNavigate?: () => void;
}

const HeaderNav = ({ menuItems, stacked = false, onNavigate }: HeaderNavProps) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('navigation');

  return (
    <div className={stacked ? undefined : 'layout-header-nav hidden lg:block'}>
      <Navigation
        label={t('label')}
        items={menuItems.map(item => ({
          href: item.path,
          label: item.translationKey ? t(`${item.translationKey}.title`) : item.title,
        }))}
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
