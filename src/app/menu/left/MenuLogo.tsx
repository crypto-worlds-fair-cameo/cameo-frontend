import { Link } from 'react-router';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/sidebar';
import { siteConfig } from '@/app/config/site';

const MenuLogo = () => {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild size="lg" tooltip={siteConfig.name}>
                    <Link to="/" className="gap-3">
                        <span className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                            {siteConfig.shortName}
                        </span>
                        <span className="grid text-left leading-tight">
                            <span className="text-sm font-semibold">{siteConfig.name}</span>
                            <span className="text-xs text-sidebar-foreground/70">
                                {siteConfig.repositoryLabel}
                            </span>
                        </span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
};

export default MenuLogo;
