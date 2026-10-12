import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';
import { useSessionQuery } from '@/entities/session';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
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

/** 지갑 선택 → 연결 중 → 거절·실패 단계를 한 창에서 보여 준다. 새 계정은 연결 완료 단계로 넘긴다. */
export function WalletConnectContent() {
  const { t } = useTranslation('wallet');
  const auth = useWalletAuthentication();
  const closeModal = useModalStore(state => state.closeModal);

  // 창이 열린 뒤 로그인이 확인된 경우(기존 계정 로그인, 서버 재연결 후 세션 복구)는 연결 완료 화면만 보여 준다.
  // 연결 해제는 헤더의 계정 메뉴가 맡는다.
  if (auth.session) return <WalletConnectedContent finish />;

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

  return (
    <div className="wallet-dialog">
      <DialogDescription className="sr-only">{t('dialog.description')}</DialogDescription>
      <WalletOptionRow
        className="mt-12"
        label={t('dialog.phantom')}
        status={status}
        invalid={Boolean(errorKey)}
      />
      {/* 거절은 목록 칸의 짧은 문구로 충분하고, 그 밖의 실패는 해결 방법을 함께 안내한다. */}
      {errorKey && !rejected && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {t(errorKey, { walletName: auth.errorWalletName })}
        </p>
      )}
      <div className={walletDialogActionsClassName}>
        {/* 지갑 서명 창이 열려 있는 동안에는 다시 요청하지 않도록 취소만 남긴다. */}
        {!auth.isPending && (
          <Button
            className={walletDialogButtonClassName}
            disabled={auth.checkingSession}
            onClick={() =>
              auth.connect('Phantom', () =>
                openWalletDialogStep({
                  title: t('dialog.connectedTitle'),
                  content: <WalletConnectedContent />,
                  hideTitle: true,
                })
              )
            }
          >
            {t(errorKey ? 'dialog.tryAgain' : 'dialog.next')}
          </Button>
        )}
        {errorKey === 'errors.notInstalled' && auth.errorWalletName === 'Phantom' && (
          <Button variant="secondary" asChild className={walletDialogButtonClassName}>
            <a href="https://phantom.com/download" target="_blank" rel="noreferrer">
              {t('installPhantom')}
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
