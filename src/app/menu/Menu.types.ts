import type { LucideIcon } from 'lucide-react';

export type MenuTranslationKey = 'ui' | 'mainCanvas' | 'seasonCanvas';

export interface MenuItem {
  path: string;
  title: string;
  translationKey?: MenuTranslationKey;
  description?: string;
  icon?: LucideIcon;
  children?: MenuItem[];
}
