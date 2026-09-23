import type { MenuItem } from '@/app/menu/index';
import { NavLink } from 'react-router';
import { cn } from '@/shared/lib/utils';

interface HeaderNavProps {
    menuItems: MenuItem[];
    stacked?: boolean;
    onNavigate?: () => void;
}

const HeaderNav = ({ menuItems, stacked = false, onNavigate }: HeaderNavProps) => {
    return (
        <nav
            className={cn(
                'flex items-center gap-2',
                stacked && 'flex-col items-stretch',
                !stacked && 'hidden lg:flex',
            )}
        >
            {menuItems.map((item) => (
                <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                        cn(
                            'rounded-full px-4 py-2 text-sm transition',
                            stacked && 'rounded-2xl border border-border/70 px-4 py-3',
                            isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                        )
                    }
                >
                    {item.title}
                </NavLink>
            ))}
        </nav>
    );
};

export default HeaderNav;
