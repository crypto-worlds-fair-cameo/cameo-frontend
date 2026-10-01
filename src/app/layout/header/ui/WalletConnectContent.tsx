import { Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { DialogDescription } from '@/shared/ui/dialog';

export function WalletConnectTitle() {
  const { t } = useTranslation('wallet');
  return t('dialog.title');
}

export function WalletConnectContent() {
  const { t } = useTranslation('wallet');

  return (
    <>
      <DialogDescription>{t('dialog.description')}</DialogDescription>
      <Button variant="secondary" className="w-full justify-start">
        <Wallet size={20} aria-hidden="true" />
        {t('dialog.phantom')}
      </Button>
    </>
  );
}
