import { Check, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import {
  walletDialogActionsClassName,
  walletDialogButtonClassName,
} from '../config/walletDialogStyles';
import { formatWalletAddress } from '../lib/formatWalletAddress';
import { useWalletAuthentication } from '../model/useWalletAuthentication';
import { openWalletDialogStep } from '../model/openWalletDialogStep';
import { NicknameRegistrationContent } from './NicknameRegistration';
import { WalletOptionRow } from './WalletOptionRow';

/**
 * 지갑 연결 완료를 알린다. 새 계정은 Next로 닉네임 만들기에 넘기고,
 * 이미 로그인된 계정(finish)은 더 할 단계가 없으므로 Done으로 창을 닫는다.
 */
export function WalletConnectedContent({ finish = false }: { finish?: boolean }) {
  const { t } = useTranslation('wallet');
  const { walletAddress } = useWalletAuthentication();
  const closeModal = useModalStore(state => state.closeModal);

  return (
    <div className="wallet-dialog">
      <div role="status" className="flex flex-col items-center gap-6">
        <span aria-hidden="true" className="relative flex size-[72px] items-center justify-center">
          <Wallet className="size-14" strokeWidth={1.25} />
          <span className="absolute top-0.5 right-0.5 flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="size-4" strokeWidth={3} />
          </span>
        </span>
        <DialogDescription className="text-center text-2xl font-normal leading-tight text-foreground">
          {t('dialog.connectedTitle')}
        </DialogDescription>
      </div>
      {walletAddress && (
        <WalletOptionRow
          className="mt-12"
          label={
            <>
              {t('dialog.phantom')}{' '}
              <span className="font-data" title={walletAddress}>
                {formatWalletAddress(walletAddress)}
              </span>
            </>
          }
        />
      )}
      <div className={walletDialogActionsClassName}>
        {finish ? (
          <Button className={walletDialogButtonClassName} onClick={closeModal}>
            {t('dialog.done')}
          </Button>
        ) : (
          <Button
            className={walletDialogButtonClassName}
            onClick={() =>
              openWalletDialogStep({
                title: t('nickname.title'),
                content: <NicknameRegistrationContent />,
              })
            }
          >
            {t('dialog.next')}
          </Button>
        )}
      </div>
    </div>
  );
}
