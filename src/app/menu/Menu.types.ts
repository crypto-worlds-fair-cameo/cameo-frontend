import type { LucideIcon } from 'lucide-react';

export interface MenuItem {
    path: string;
    title: string;
    description?: string;
    icon?: LucideIcon;
    children?: MenuItem[];
}
