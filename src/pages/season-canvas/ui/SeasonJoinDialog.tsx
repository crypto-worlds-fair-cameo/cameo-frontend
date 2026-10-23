import { useRef, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { openWalletConnectDialog } from '@/app/layout/header/model/openWalletConnectDialog';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog';
import type { Season } from '../api/seasons.types';
import { formatSol } from '../lib/seasonForm';
import type { SeasonJoinNotice } from '../model/useSeasonJoinFlow';
import { restoreDialogFocus } from './restoreDialogFocus';
import './season-dialog.css';

interface SeasonJoinDialogProps {
  notice: SeasonJoinNotice | null;
  joiningId: string | null;
  onClose: () => void;
  onPay: (season: Season) => void;
  onRetry: (season: Season) => void;
  restoreFocusTo: RefObject<HTMLElement | null>;
  fallbackFocusTo: RefObject<HTMLElement | null>;
  /** 이미 그 시즌 방 안이면 참가 완료 팝업에서 입장 링크를 뺀다. */
  inRoom?: boolean;
}

/** 참가 버튼 뒤의 지갑 연결·정원 초과·참가 완료·실패 안내를 같은 모양의 작은 팝업으로 보여 준다. */
export function SeasonJoinDialog(props: SeasonJoinDialogProps) {
  const { t } = useTranslation('seasonCanvas');
  const queryClient = useQueryClient();
  const { notice } = props;
  const openingWallet = useRef(false);
  const paying = notice?.kind === 'fee' && props.joiningId === notice.season.id;
  const hasDescription = notice?.kind === 'error';
  return (
    <Dialog open={notice !== null} onOpenChange={open => !open && props.onClose()}>
      <DialogContent
        className="season-dialog season-notice"
        showCloseButton={false}
        // 설명문이 있는 안내만 Radix 설명을 연결한다.
        {...(hasDescription ? {} : { 'aria-describedby': undefined })}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (openingWallet.current) {
            openingWallet.current = false;
            return;
          }
          restoreDialogFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
        }}
      >
        {notice?.kind === 'wallet' && (
          <>
            <DialogTitle>
              {t(notice.action === 'create' ? 'join.walletCreateTitle' : 'join.walletTitle')}
            </DialogTitle>
            <div className="season-notice__actions">
              <Button
                onClick={() => {
                  openingWallet.current = true;
                  openWalletConnectDialog(queryClient, props.restoreFocusTo.current);
                  props.onClose();
                }}
              >
                {t('join.connectWallet')}
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">{t('join.cancel')}</Button>
              </DialogClose>
            </div>
          </>
        )}
        {notice?.kind === 'fee' && (
          <>
            <DialogTitle>{t('join.feeTitle')}</DialogTitle>
            <div className="season-notice__actions">
              <Button variant="web3" loading={paying} onClick={() => props.onPay(notice.season)}>
                {paying
                  ? t('join.connecting')
                  : t('join.feePay', { amount: formatSol(notice.season.entryFeeLamports) })}
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">{t('join.cancel')}</Button>
              </DialogClose>
            </div>
          </>
        )}
        {notice?.kind === 'full' && (
          <>
            <DialogTitle>{t('join.fullTitle')}</DialogTitle>
            <div className="season-notice__actions">
              <DialogClose asChild>
                <Button>{t('join.close')}</Button>
              </DialogClose>
            </div>
          </>
        )}
        {notice?.kind === 'joined' && (
          <>
            <DialogTitle>{t('join.joinedTitle')}</DialogTitle>
            <div className="season-notice__actions">
              <DialogClose asChild>
                <Button variant={props.inRoom ? 'default' : 'secondary'}>{t('join.done')}</Button>
              </DialogClose>
              {!props.inRoom && (
                <Button asChild>
                  <Link to={`/season-canvas/${notice.seasonId}`}>{t('detail.enter')}</Link>
                </Button>
              )}
            </div>
          </>
        )}
        {notice?.kind === 'error' && (
          <>
            <DialogTitle>
              {t(notice.payment ? 'join.paymentFailedTitle' : 'join.errorTitle')}
            </DialogTitle>
            <DialogDescription>
              {notice.payment ? t('join.paymentFailedDescription') : t(`errors.${notice.error}`)}
            </DialogDescription>
            <div className="season-notice__actions">
              <Button
                variant="web3"
                loading={props.joiningId === notice.season.id}
                onClick={() => props.onRetry(notice.season)}
              >
                {props.joiningId === notice.season.id ? t('detail.joining') : t('join.retry')}
              </Button>
              <DialogClose asChild>
                <Button variant="secondary">{t('join.cancel')}</Button>
              </DialogClose>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
