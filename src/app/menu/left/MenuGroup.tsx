import { NavLink, useLocation } from 'react-router';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/shared/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import type { MenuItem } from '@/app/menu/index';
import { ChevronRight, CircleSmall } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MenuGroupProps {
  label?: string;
  menuItems: MenuItem[];
}

const MenuGroup = ({ label, menuItems }: MenuGroupProps) => {
  const { pathname } = useLocation();
  const { t } = useTranslation('navigation');
  const getTitle = (item: MenuItem) =>
    item.translationKey ? t(`${item.translationKey}.title`) : item.title;
  const getDescription = (item: MenuItem) =>
    item.translationKey
      ? t(`${item.translationKey}.description`)
      : (item.description ?? item.title);

  const isActive = (path: string) => {
    return path === '/' ? pathname === path : pathname.startsWith(path);
  };

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {menuItems.map(menu => {
            if (!menu.children?.length) {
              return (
                <SidebarMenuItem key={menu.path}>
                  <SidebarMenuButton
                    asChild
                    tooltip={getDescription(menu)}
                    isActive={isActive(menu.path)}
                  >
                    <NavLink to={menu.path}>
                      {(menu.icon && <menu.icon />) || <CircleSmall />}
                      <span>{getTitle(menu)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }

            return (
              <Collapsible
                key={menu.path}
                asChild
                className="group/collapsible"
                defaultOpen={isActive(menu.path)}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      tooltip={getDescription(menu)}
                      isActive={isActive(menu.path)}
                    >
                      {(menu.icon && <menu.icon />) || <CircleSmall />}
                      <span>{getTitle(menu)}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {menu.children.map(child => (
                        <SidebarMenuSubItem key={child.path}>
                          <SidebarMenuSubButton asChild isActive={isActive(child.path)}>
                            <NavLink to={child.path}>
                              <span>{getTitle(child)}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};

export default MenuGroup;
