import { useCallback, useRef } from 'react';
import { useMobileNavigation } from '../model/useMobileNavigation';
import type { MenuItem } from '@/app/menu/index';
import { Button } from '@/shared/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar';
import { Skeleton } from '@/shared/ui/skeleton';
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
  const { t: tCommon } = useTranslation('common');
  const { t: tNavigation } = useTranslation('navigation');
  const auth = useWalletAuthentication();
  const accountButtonRef = useRef<HTMLButtonElement>(null);
  const openWalletDialog = useCallback(
    (returnFocusElement = accountButtonRef.current) =>
      openModal({
        title: <WalletConnectTitle />,
        titleClassName: 'pr-12',
        content: <WalletConnectContent />,
        returnFocusElement,
      }),
    [openModal]
  );
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
          {auth.checkingSession ? (
            <Skeleton
              role="status"
              aria-label={tCommon('loading')}
              aria-busy="true"
              className="h-[var(--control-height-md)] w-40 max-w-[min(55vw,14rem)] shrink-0 rounded-[var(--radius-button)] motion-reduce:animate-none"
            />
          ) : (
            <Button
              ref={accountButtonRef}
              variant={auth.isAuthenticated ? 'secondary' : 'primary'}
              className={cn(
                'w-40 max-w-[min(55vw,14rem)]',
                auth.isAuthenticated &&
                  'border-gray-200 bg-white px-3 text-black hover:bg-gray-50 active:bg-gray-100'
              )}
              aria-haspopup="dialog"
              aria-label={
                auth.isAuthenticated && auth.walletAddress
                  ? t('connectedWallet', { address: auth.walletAddress })
                  : undefined
              }
              loading={auth.isPending}
              onClick={event => openWalletDialog(event.currentTarget)}
            >
              {auth.isAuthenticated && auth.session ? (
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
                    <span
                      className="truncate text-xs font-medium leading-tight"
                      title={displayName}
                    >
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
          )}
          <div className="flex items-center gap-2 lg:hidden">
            {showSidebar && <SidebarTrigger className="hidden sm:inline-flex md:hidden" />}
            <Sheet open={navigation.open} onOpenChange={navigation.setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={tNavigation('open')}>
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px]">
                <SheetHeader className="pb-4">
                  <SheetTitle>
                    <HeaderLogo onNavigate={navigation.close} />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    {tNavigation('description')}
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
