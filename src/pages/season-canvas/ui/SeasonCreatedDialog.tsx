import type { RefObject } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { restoreDialogFocus } from './restoreDialogFocus';
import './season-dialog.css';

export function SeasonCreatedDialog({
  createdId,
  onClose,
  restoreFocusTo,
  fallbackFocusTo,
}: {
  createdId: string | null;
  onClose: () => void;
  restoreFocusTo: RefObject<HTMLElement | null>;
  fallbackFocusTo: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation('seasonCanvas');
  return (
    <Dialog open={createdId !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="season-dialog season-notice season-created-dialog"
        showCloseButton={false}
        aria-describedby={undefined}
        onCloseAutoFocus={event => {
          event.preventDefault();
          restoreDialogFocus(restoreFocusTo.current, fallbackFocusTo.current);
        }}
      >
        <DialogTitle>{t('created.title')}</DialogTitle>
        <div className="season-notice__actions">
          <Button asChild>
            <Link to={`/season-canvas/${createdId}`} onClick={onClose}>
              {t('created.view')}
            </Link>
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('created.done')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
