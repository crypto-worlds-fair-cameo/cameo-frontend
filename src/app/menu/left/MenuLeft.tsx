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

interface MenuLeftProps {
    menuItems: MenuItem[];
}

export function MenuLeft({ menuItems }: MenuLeftProps) {
    return (
        <Sidebar collapsible="icon" variant="sidebar">
            <SidebarHeader>
                <MenuLogo />
            </SidebarHeader>

            <SidebarContent>
                <MenuGroup label="Workspace" menuItems={menuItems} />
            </SidebarContent>

            <SidebarFooter>
                <SidebarTrigger />
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    );
}
