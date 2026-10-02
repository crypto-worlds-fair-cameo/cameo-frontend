import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';
import { useSessionQuery } from '@/entities/session';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import { useWalletAuthentication } from '../model/useWalletAuthentication';
import { NicknameRegistration } from './NicknameRegistration';

export function WalletConnectTitle() {
  const { t } = useTranslation('wallet');
  const { data: session } = useSessionQuery();
  return t(session ? 'dialog.connectedTitle' : 'dialog.title');
}

export function WalletConnectContent({ editNickname = false }: { editNickname?: boolean }) {
  const { t } = useTranslation('wallet');
  const auth = useWalletAuthentication();

  return (
    <>
      <DialogDescription className={editNickname ? 'sr-only' : undefined}>
        {t(
          editNickname
            ? 'nickname.label'
            : auth.session
              ? 'dialog.connectedDescription'
              : 'dialog.description'
        )}
      </DialogDescription>
      {auth.errorKey && (
        <p role="alert" className="text-sm text-destructive">
          {t(auth.errorKey, { walletName: auth.errorWalletName })}
        </p>
      )}
      {editNickname && auth.session ? (
        <NicknameRegistration key={auth.session.user.id} auth={auth} />
      ) : auth.session ? (
        <>
          {auth.walletAddress && (
            <p className="break-all text-sm text-muted-foreground">{auth.walletAddress}</p>
          )}
          <Button
            variant="secondary"
            className="w-full"
            loading={auth.isPending}
            onClick={auth.logout}
          >
            {t(auth.isPending ? 'disconnecting' : 'disconnect')}
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="primary"
            className="w-full justify-start bg-[#ab9ff2] text-[#1c1c1c] hover:bg-[#ab9ff2]/90 active:bg-[#ab9ff2]/80"
            loading={auth.isPending}
            disabled={auth.checkingSession}
            onClick={() =>
              auth.connect('Phantom', () => {
                const modal = useModalStore.getState();
                modal.openModal({
                  title: t('nickname.title'),
                  titleClassName: 'pr-12',
                  content: <WalletConnectContent editNickname />,
                  returnFocusElement: modal.returnFocusElement,
                });
              })
            }
          >
            {!auth.isPending && (
              <img
                src="/images/phantom.svg"
                alt=""
                aria-hidden="true"
                width={20}
                height={20}
                className="size-5 shrink-0 object-contain"
              />
            )}
            {t(auth.isPending ? 'connecting' : 'dialog.phantom')}
          </Button>
          {auth.errorKey === 'errors.notInstalled' && auth.errorWalletName === 'Phantom' && (
            <Button variant="secondary" asChild className="w-full">
              <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
                {t('installPhantom')}
              </a>
            </Button>
          )}
        </>
      )}
    </>
  );
}
