import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DialogDescription } from '@/shared/ui/dialog';
import { useProfileUpdatedAutoClose } from '../model/useProfileUpdatedAutoClose';

export function ProfileUpdatedContent() {
  const { t } = useTranslation('wallet');
  useProfileUpdatedAutoClose();

  return (
    <div role="status" className="flex flex-col items-center gap-5 py-6">
      <span className="flex size-11 items-center justify-center rounded-full bg-foreground text-background">
        <Check className="size-6" strokeWidth={3.5} aria-hidden="true" />
      </span>
      <DialogDescription className="text-center text-3xl font-normal leading-tight text-foreground sm:text-4xl">
        {t('nickname.updated')}
      </DialogDescription>
    </div>
  );
}
