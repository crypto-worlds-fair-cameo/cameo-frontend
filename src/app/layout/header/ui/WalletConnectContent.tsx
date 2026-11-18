import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';
import { useSessionQuery } from '@/entities/session';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import {
  useSupportedWallets,
  type SupportedWalletName,
} from '@/shared/lib/solana-wallet/supported-wallets';
import {
  walletDialogActionsClassName,
  walletDialogButtonClassName,
} from '../config/walletDialogStyles';
import { useWalletAuthentication } from '../model/useWalletAuthentication';
import { openWalletDialogStep } from '../model/openWalletDialogStep';
import { WalletConnectedContent } from './WalletConnectedContent';
import { WalletOptionRow } from './WalletOptionRow';
import './wallet-dialog.css';

export function WalletConnectTitle() {
  const { t } = useTranslation('wallet');
  const { data: session } = useSessionQuery();
  // 로그인된 상태는 내용의 큰 "Wallet connected!" 문구가 제목을 대신하므로 보조 기술에만 남긴다.
  return session ? (
    <span className="sr-only">{t('dialog.connectedTitle')}</span>
  ) : (
    t('dialog.title')
  );
}

/**
 * 지갑 선택 → 연결 중 → 거절·실패 단계를 한 창에서 보여 준다. 새 계정은 연결 완료 단계로 넘긴다.
 * 지원 지갑(Phantom·Solflare·Backpack)을 모두 보여 주고, 처음에는 설치된 첫 지갑을 골라 둔다.
 */
export function WalletConnectContent() {
  const { t } = useTranslation('wallet');
  const auth = useWalletAuthentication();
  const closeModal = useModalStore(state => state.closeModal);
  const wallets = useSupportedWallets();
  const [chosen, setChosen] = useState<SupportedWalletName | null>(null);
  // 연결 중·실패 표시는 고른 칸이 아니라 실제로 연결을 시도한 지갑 칸에 붙인다.
  const [attempted, setAttempted] = useState<SupportedWalletName | null>(null);

  // 창이 열린 뒤 로그인이 확인된 경우(기존 계정 로그인, 서버 재연결 후 세션 복구)는 연결 완료 화면만 보여 준다.
  // 연결 해제는 헤더의 계정 메뉴가 맡는다.
  if (auth.session) return <WalletConnectedContent finish />;

  const selected =
    wallets.find(wallet => wallet.name === chosen) ??
    wallets.find(wallet => wallet.installed) ??
    wallets[0]!;
  // 오류 키는 요청 중에는 비어 있으므로, 연결 중·거절·실패 표시는 서로 겹치지 않는다.
  const { errorKey } = auth;
  const rejected = errorKey === 'errors.rejected';
  const status = auth.isPending
    ? t('dialog.connecting')
    : rejected
      ? t('dialog.rejected')
      : errorKey
        ? t('dialog.failed')
        : undefined;
  const statusWallet = attempted ?? selected.name;
  // 고른 지갑이 설치돼 있지 않거나 지갑을 찾지 못했다는 오류가 나면 설치 안내를 함께 보여 준다.
  const installTarget =
    (errorKey === 'errors.notInstalled' &&
      wallets.find(wallet => wallet.name === auth.errorWalletName)) ||
    (!selected.installed ? selected : undefined);

  const connect = () => {
    setAttempted(selected.name);
    auth.connect(selected.name, () =>
      openWalletDialogStep({
        title: t('dialog.connectedTitle'),
        content: <WalletConnectedContent />,
        hideTitle: true,
      })
    );
  };

  return (
    <div className="wallet-dialog">
      <DialogDescription className="sr-only">{t('dialog.description')}</DialogDescription>
      <div className="mt-12 flex flex-col gap-2" role="group" aria-label={t('dialog.title')}>
        {wallets.map(wallet => {
          const showStatus = wallet.name === statusWallet && Boolean(status);
          return (
            <WalletOptionRow
              key={wallet.name}
              walletName={wallet.name}
              label={wallet.name}
              icon={wallet.icon}
              selected={wallet.name === selected.name}
              onSelect={() => setChosen(wallet.name)}
              // 지갑 서명 창이 열려 있는 동안에는 다른 지갑으로 바꾸지 않는다.
              disabled={auth.isPending}
              status={showStatus ? status : undefined}
              invalid={showStatus && Boolean(errorKey)}
              note={wallet.installed ? undefined : t('dialog.notInstalled')}
            />
          );
        })}
      </div>
      {/* 거절은 목록 칸의 짧은 문구로 충분하고, 그 밖의 실패는 해결 방법을 함께 안내한다. */}
      {errorKey && !rejected && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t(errorKey, { walletName: auth.errorWalletName ?? statusWallet })}
        </p>
      )}
      <div className={walletDialogActionsClassName}>
        {/* 지갑 서명 창이 열려 있는 동안에는 다시 요청하지 않도록 취소만 남긴다. */}
        {!auth.isPending && (
          <Button
            className={walletDialogButtonClassName}
            disabled={auth.checkingSession}
            onClick={connect}
          >
            {t(errorKey ? 'dialog.tryAgain' : 'dialog.next')}
          </Button>
        )}
        {installTarget && (
          <Button variant="secondary" asChild className={walletDialogButtonClassName}>
            <a href={installTarget.installUrl} target="_blank" rel="noreferrer">
              {t('install', { walletName: installTarget.name })}
            </a>
          </Button>
        )}
        <Button variant="secondary" className={walletDialogButtonClassName} onClick={closeModal}>
          {t('dialog.cancel')}
        </Button>
      </div>
    </div>
  );
}
