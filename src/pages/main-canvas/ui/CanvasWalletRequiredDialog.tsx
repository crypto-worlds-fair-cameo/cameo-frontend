import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';

/**
 * 지갑을 연결하지 않은 방문자가 실제 획을 그리려 할 때 지갑 연결로 안내한다.
 * 지갑 연결 창은 헤더가 소유하므로 이 창은 헤더의 연결 버튼 위치만 알려 주고 닫힌다.
 */
export function CanvasWalletRequiredDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('mainCanvas');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 다른 획 안내와 같이 화면을 어둡게 덮지 않고 테두리가 있는 창만 도화지 위에 띄운다. */}
      <DialogContent
        className="cameo-light main-canvas-dialog"
        role="alertdialog"
        showCloseButton={false}
      >
        {/* 디자인은 공통 획 안내 창보다 제목·본문·버튼 사이가 넓어(약 344px 높이) 이 창에만 간격을 더한다. */}
        <DialogHeader style={{ gap: 28 }}>
          <DialogTitle>{t('walletRequired.title')}</DialogTitle>
          <DialogDescription className="mx-auto max-w-80">
            {t('walletRequired.description')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter style={{ marginTop: 75 }}>
          <DialogClose asChild>
            <Button className="main-canvas-dialog-button main-canvas-dialog-button--compact">
              {t('walletRequired.confirm')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
