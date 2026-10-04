import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from '@/shared/ui/sidebar';
import type { MenuItem } from '@/app/menu/index';
import MenuGroup from '@/app/menu/left/MenuGroup';
import MenuLogo from '@/app/menu/left/MenuLogo';
import { useTranslation } from 'react-i18next';

interface MenuLeftProps {
  menuItems: MenuItem[];
}

export function MenuLeft({ menuItems }: MenuLeftProps) {
  const { t } = useTranslation('navigation');
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <MenuLogo />
      </SidebarHeader>

      <SidebarContent>
        <MenuGroup label={t('workspace')} menuItems={menuItems} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarTrigger />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
