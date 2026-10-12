import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';
import { useModalStore } from '@/shared/ui/modal/model/modalStore';
import {
  walletDialogActionsClassName,
  walletDialogButtonClassName,
} from '../config/walletDialogStyles';

/** 닉네임 저장 후 프로필 생성을 알리고, 프로필로 이동하거나 창을 닫게 한다. */
export function ProfileCreatedContent() {
  const { t } = useTranslation('wallet');
  const closeModal = useModalStore(state => state.closeModal);

  return (
    <div className="wallet-dialog">
      <div role="status" className="flex flex-col items-center gap-6 pt-4">
        <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-background">
          <Check className="size-6" strokeWidth={3.5} aria-hidden="true" />
        </span>
        <DialogDescription className="text-center text-2xl font-normal leading-tight text-foreground">
          {t('nickname.created')}
        </DialogDescription>
      </div>
      <div className={walletDialogActionsClassName}>
        <Button asChild className={walletDialogButtonClassName}>
          <Link to="/profile" onClick={closeModal}>
            {t('nickname.viewProfile')}
          </Link>
        </Button>
        <Button variant="secondary" className={walletDialogButtonClassName} onClick={closeModal}>
          {t('nickname.complete')}
        </Button>
      </div>
    </div>
  );
}
