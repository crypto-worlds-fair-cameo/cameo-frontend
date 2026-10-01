import { useMobileNavigation } from '../model/useMobileNavigation';
import type { MenuItem } from '@/app/menu/index';
import { Button } from '@/shared/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet';
import { SidebarTrigger } from '@/shared/ui/sidebar';
import { Menu, UserRound } from 'lucide-react';
import HeaderLogo from '@/app/layout/header/HeaderLogo';
import HeaderNav from '@/app/layout/header/HeaderNav';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { WalletConnectContent, WalletConnectTitle } from './ui/WalletConnectContent';
import { useTranslation } from 'react-i18next';
import { useWalletAuthentication } from './model/useWalletAuthentication';
import { cn } from '@/shared/lib/utils';

interface HeaderProps {
  menuItems: MenuItem[];
  showSidebar?: boolean;
}

const Header = ({ menuItems, showSidebar = false }: HeaderProps) => {
  const navigation = useMobileNavigation();
  const openModal = useModalStore(state => state.openModal);
  const { t } = useTranslation('wallet');
  const auth = useWalletAuthentication();
  const walletLabel = auth.walletAddress
    ? `${auth.walletAddress.slice(0, 4)}…${auth.walletAddress.slice(-4)}`
    : t('connected');
  const displayName = auth.session?.user.displayName?.trim() || t('account');
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
          <Button
            variant={auth.session ? 'secondary' : 'primary'}
            className={cn(
              'max-w-[min(55vw,14rem)]',
              auth.session &&
                'border-gray-200 bg-white px-3 text-black hover:bg-gray-50 active:bg-gray-100'
            )}
            aria-haspopup="dialog"
            aria-label={
              auth.walletAddress ? t('connectedWallet', { address: auth.walletAddress }) : undefined
            }
            loading={auth.checkingSession || auth.isPending}
            onClick={event =>
              openModal({
                title: <WalletConnectTitle />,
                titleClassName: 'pr-12',
                content: <WalletConnectContent />,
                returnFocusElement: event.currentTarget,
              })
            }
          >
            {auth.session ? (
              <>
                <Avatar aria-hidden="true">
                  <AvatarImage
                    src={auth.session.user.avatarUrl || undefined}
                    alt=""
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gray-100 text-gray-600">
                    <UserRound className="size-5" />
                  </AvatarFallback>
                </Avatar>
                <span className="flex min-w-0 flex-col gap-0.5 text-left">
                  <span className="truncate text-xs font-medium leading-tight" title={displayName}>
                    {displayName}
                  </span>
                  <span
                    className="truncate font-data text-xs leading-tight text-gray-600"
                    title={auth.walletAddress}
                  >
                    {walletLabel}
                  </span>
                </span>
              </>
            ) : (
              <span className="truncate">{t('connect')}</span>
            )}
          </Button>
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
