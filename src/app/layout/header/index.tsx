import { useMobileNavigation } from '../model/useMobileNavigation';
import type { MenuItem } from '@/app/menu/index';
import { Button } from '@/shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet';
import { SidebarTrigger } from '@/shared/ui/sidebar';
import { Menu } from 'lucide-react';
import HeaderLogo from '@/app/layout/header/HeaderLogo';
import HeaderNav from '@/app/layout/header/HeaderNav';

interface HeaderProps {
  menuItems: MenuItem[];
  showSidebar?: boolean;
}

const Header = ({ menuItems, showSidebar = false }: HeaderProps) => {
  const navigation = useMobileNavigation();
  return (
    <header className="layout-header">
      <div className="layout-header-inner">
        <div className="layout-header-brand flex min-w-0 items-center gap-3">
          {showSidebar && (
            <div className="hidden md:block">
              <SidebarTrigger />
            </div>
          )}
          <HeaderLogo />
        </div>

        <HeaderNav menuItems={menuItems} />

        <div className="layout-header-actions flex items-center gap-2">
          <Button variant="primary">Connect Wallet</Button>
          <div className="flex items-center gap-2 lg:hidden">
            {showSidebar && <SidebarTrigger className="hidden sm:inline-flex md:hidden" />}
            <Sheet open={navigation.open} onOpenChange={navigation.setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px]">
                <SheetHeader className="pb-4">
                  <SheetTitle>
                    <HeaderLogo onNavigate={navigation.close} />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    페이지를 선택해 이동하세요.
                  </SheetDescription>
                </SheetHeader>
                <HeaderNav menuItems={menuItems} stacked onNavigate={navigation.close} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
