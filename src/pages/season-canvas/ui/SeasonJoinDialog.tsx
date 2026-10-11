import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/ui/dialog';
import type { Season } from '../api/seasons.types';
import type { SeasonJoinNotice } from '../model/useSeasonJoinFlow';
import { restoreDialogFocus } from './restoreDialogFocus';

interface SeasonJoinDialogProps {
  notice: SeasonJoinNotice | null;
  joiningId: string | null;
  onClose: () => void;
  onRetry: (season: Season) => void;
  restoreFocusTo: RefObject<HTMLElement | null>;
  fallbackFocusTo: RefObject<HTMLElement | null>;
}

/** 참가 버튼 뒤의 지갑 연결·정원 초과·참가 완료·실패 안내를 같은 모양의 작은 팝업으로 보여 준다. */
export function SeasonJoinDialog(props: SeasonJoinDialogProps) {
  const { t } = useTranslation('seasonCanvas');
  const { notice } = props;
  return (
    <Dialog open={notice !== null} onOpenChange={open => !open && props.onClose()}>
      <DialogContent
        className="season-dialog season-notice"
        showCloseButton={false}
        // 지갑·실패 안내만 설명문이 있으므로 나머지는 Radix의 설명 연결을 끈다.
        {...(notice?.kind === 'error' || notice?.kind === 'wallet'
          ? {}
          : { 'aria-describedby': undefined })}
        onCloseAutoFocus={event => {
          event.preventDefault();
          restoreDialogFocus(props.restoreFocusTo.current, props.fallbackFocusTo.current);
        }}
      >
        {/* 지갑 연결 창은 헤더가 소유하므로 제목 아래에 헤더의 연결 버튼 위치를 덧붙여 안내한다. */}
        {notice?.kind === 'wallet' && (
          <>
            <DialogTitle>
              {t(notice.action === 'create' ? 'join.walletCreateTitle' : 'join.walletTitle')}
            </DialogTitle>
            <DialogDescription>{t('join.walletHint')}</DialogDescription>
            <div className="season-notice__actions">
              <DialogClose asChild>
                <Button>{t('join.close')}</Button>
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
                <Button variant="secondary">{t('join.done')}</Button>
              </DialogClose>
              <Button asChild>
                <Link to={`/season-canvas/${notice.seasonId}`}>{t('detail.enter')}</Link>
              </Button>
            </div>
          </>
        )}
        {notice?.kind === 'error' && (
          <>
            <DialogTitle>{t('join.errorTitle')}</DialogTitle>
            <DialogDescription>{t(`errors.${notice.error}`)}</DialogDescription>
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
