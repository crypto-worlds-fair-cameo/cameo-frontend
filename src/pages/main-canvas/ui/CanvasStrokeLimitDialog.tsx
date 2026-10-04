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

/** 실제 획 완료 또는 이미 사용한 계정의 새 그리기 시도를 알린다. */
export function CanvasStrokeLimitDialog({
  open,
  onOpenChange,
  completed = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completed?: boolean;
}) {
  const { t } = useTranslation('mainCanvas');
  // 정상 완료는 평생 1획 소진을, 새 획 거절은 이미 사용했다는 안내를 표시한다.
  const key = completed ? 'strokeCompleted' : 'strokeLimit';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cameo-light" role="alertdialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t(`${key}.title`)}</DialogTitle>
          <DialogDescription>{t(`${key}.description`)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{t('strokeLimit.confirm')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
