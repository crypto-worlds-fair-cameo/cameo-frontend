import type { MenuItem } from '@/app/menu/index';
import { navigationItems } from '@/app/router/route-config';

export const menuConfig: MenuItem[] = navigationItems.map(route => ({
  path: route.path,
  title: route.title,
  description: route.description,
  icon: route.icon,
}));
