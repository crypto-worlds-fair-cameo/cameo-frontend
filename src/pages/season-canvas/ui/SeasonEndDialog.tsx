import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import './season-management-dialogs.css';

interface SeasonEndDialogProps {
  open: boolean;
  title: string;
  participantCount: number;
  loading?: boolean;
  canConfirm?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** 개설자가 시즌 이름을 정확히 입력한 경우에만 강제 종료 요청을 실행한다. */
export function SeasonEndDialog(props: SeasonEndDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={open => !props.loading && props.onOpenChange(open)}>
      <DialogContent
        className="season-management-dialog season-end-dialog"
        showCloseButton={false}
        onEscapeKeyDown={event => props.loading && event.preventDefault()}
        onPointerDownOutside={event => props.loading && event.preventDefault()}
      >
        <SeasonEndContent {...props} />
      </DialogContent>
    </Dialog>
  );
}

function SeasonEndContent({
  title,
  participantCount,
  loading = false,
  canConfirm = true,
  onOpenChange,
  onConfirm,
}: SeasonEndDialogProps) {
  const { t } = useTranslation('seasonCanvas');
  const inputId = useId();
  const [confirmation, setConfirmation] = useState('');
  const matches = title.length > 0 && confirmation === title;
  const confirm = (event: FormEvent) => {
    event.preventDefault();
    if (matches && canConfirm && !loading) onConfirm();
  };
  return (
    <form className="season-management-body" onSubmit={confirm}>
      <div className="season-end-warning" aria-hidden="true">
        <img src="/images/season-warning.svg" alt="" width={24} height={24} />
      </div>
      <DialogTitle>{t('end.title')}</DialogTitle>
      <DialogDescription className="season-end-description">
        <span>{t('end.participants', { count: participantCount })}</span>
        <span>{t('end.finalWarning')}</span>
      </DialogDescription>
      <div className="season-end-confirmation">
        <label htmlFor={inputId}>
          {t('end.typeBefore')}
          <strong>{title}</strong>
          {t('end.typeAfter')}
        </label>
        <Input
          id={inputId}
          placeholder={title}
          value={confirmation}
          disabled={loading}
          data-confirmed={matches}
          autoComplete="off"
          onChange={event => setConfirmation(event.target.value)}
        />
      </div>
      <div className="season-end-spacer" aria-hidden="true" />
      <Button
        type="submit"
        variant="destructive"
        className="season-management-button season-end-submit"
        disabled={!matches || !canConfirm}
        loading={loading}
      >
        {t('end.confirm')}
      </Button>
      <Button
        variant="secondary"
        className="season-management-button"
        disabled={loading}
        onClick={() => onOpenChange(false)}
      >
        {t('end.cancel')}
      </Button>
    </form>
  );
}
